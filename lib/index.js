/**
 * Host half of the Session Delete plugin.
 *
 * DSH has no session-deletion API at any layer — `@deepseek-ai/dsh-session-persistence`
 * documents "No deletion or retention API — pruning stored sessions is out-of-band backend
 * maintenance", and the session Remote surface has no delete. So this plugin is that
 * out-of-band maintenance.
 *
 * A conversation visible in the sidebar is usually still RESIDENT in the in-memory session
 * store, and may be the one open in front of the user. That is not the same as "busy": DSH
 * distinguishes running work through the `workspace/session-activity` probe its own
 * `archiveSession` consults, and stops it through `workspaceRegistry.stopSessionActivity`.
 * Deleting therefore stops running work, evicts the in-memory instances, and only then
 * removes the durable artifacts — refusing an open-but-idle conversation would make the
 * feature unusable for exactly the row the user is looking at.
 *
 * Ordering matters twice over:
 *   - the log path is resolved FIRST, because the header index forgets the id afterwards;
 *   - the workspace registry is updated BEFORE the log is removed, because `sessionKnown`
 *     rebuilds from `sessionPersistence.list()`.
 */
import { readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Cordis service key and wire namespace. */
export const name = 'sessionDelete';

/**
 * Only the two services the composition always mounts are required. Everything else is
 * feature-detected with `ctx.get`, so a leaner composition still loads this plugin.
 */
export const inject = ['sessionPersistence', 'workspaceRegistry'];

/**
 * Resolve the DeepSeek Harness data root. Precedence mirrors
 * `@deepseek-ai/dsh-home-paths`: explicit config, then `$DSH_HOME`, then `~/.dsh`.
 * @returns the absolute data root.
 */
export function resolveDshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  return join(homedir(), '.dsh');
}

const describeError = (error) => String(error?.message ?? error);

/** Reject anything that is not a plain session id, so a hostile value can never escape the root. */
function assertSessionId(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 200) {
    throw new TypeError('session-delete: sessionId must be a non-empty string');
  }
  if (sessionId !== sessionId.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')) {
    throw new TypeError('session-delete: sessionId contains path characters');
  }
  if (sessionId === '.' || sessionId === '..') {
    throw new TypeError('session-delete: sessionId is not a directory name');
  }
  return sessionId;
}

/**
 * Find every `<home>/sessions/<project>/<sessionId>` directory holding this session's log.
 * This is the backend's documented layout and doubles as a fallback when the persistence
 * service cannot locate the artifact — a leftover log is worse than a redundant unlink.
 * @param home - resolved data root.
 * @param sessionId - the session to look for.
 * @returns absolute session directories that exist and carry a stored log.
 */
async function findLogDirectories(home, sessionId) {
  const sessionsRoot = join(home, 'sessions');
  let projects;
  try {
    projects = await readdir(sessionsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of projects) {
    if (!entry.isDirectory()) continue;
    const candidate = join(sessionsRoot, entry.name, sessionId);
    try {
      const inner = await readdir(candidate, { withFileTypes: true });
      // A real session directory always carries the stored log; anything else is not ours.
      if (inner.some((child) => child.isFile() && child.name.startsWith('session.'))) found.push(candidate);
    } catch {
      /* absent in this project — keep looking */
    }
  }
  return found;
}

/** Resolve the exact artifact path through the persistence backend when it can. */
async function resolveLogPath(persistence, sessionId) {
  if (persistence === undefined) return undefined;
  try {
    if (typeof persistence.resolveCurrentLog === 'function') {
      const resolved = await persistence.resolveCurrentLog(sessionId);
      if (typeof resolved === 'string') return resolved;
    }
  } catch { /* fall through to the header-based locator */ }
  try {
    const snapshot = typeof persistence.stat === 'function' ? await persistence.stat(sessionId) : undefined;
    if (snapshot !== undefined && typeof persistence.locate === 'function') {
      const located = persistence.locate(snapshot.header);
      if (typeof located?.path === 'string') return located.path;
    }
  } catch { /* the directory sweep still finds it */ }
  return undefined;
}

/**
 * Stop running work and evict the in-memory instances of this session.
 *
 * "Resident" and "busy" are different states: an open conversation sits in `ctx.sessions`
 * while nothing is running. Both probes here are best-effort, so a composition that lacks
 * them still deletes the durable artifacts.
 * @param ctx - the plugin Context.
 * @param registry - the workspace registry, when mounted.
 * @param sessionId - the session being deleted.
 * @param report - the running report, mutated in place.
 */
async function stopAndEvict(ctx, registry, sessionId, report) {
  const sessions = ctx.get('sessions');
  const agents = ctx.get('agents');

  let busy = agents?.get?.(sessionId) !== undefined;
  if (!busy && typeof ctx.waterfall === 'function') {
    try {
      const activity = await ctx.waterfall('workspace/session-activity', { sessionId }, () => Promise.resolve([]));
      busy = Array.isArray(activity) && activity.length > 0;
    } catch { /* the probe is best-effort */ }
  }
  if (busy) {
    try {
      await registry?.stopSessionActivity?.(sessionId);
      report.stopped = true;
    } catch (error) {
      report.skipped.push(`stopActivity: ${describeError(error)}`);
    }
  }

  // Evicting the store entry keeps a detached session from re-entering and re-creating the
  // log we are about to remove, and emits `session/disposed` for connected clients.
  for (const [label, service] of [['sessions', sessions], ['agents', agents]]) {
    if (service === undefined) continue;
    try {
      const live = service.get?.(sessionId);
      if (live === undefined) continue;
      const entry = service.liveEntryFor?.(live);
      if (entry === undefined) continue;
      service.detachEntered?.(entry);
      report.evicted.push(label);
    } catch (error) {
      report.skipped.push(`${label} evict: ${describeError(error)}`);
    }
  }
}

/**
 * Delete one session completely.
 * @param ctx - the plugin Context.
 * @param sessionId - stored session id, e.g. `session-91e11dde-…`.
 * @returns a report of what was removed.
 */
export async function deleteSession(ctx, sessionId) {
  assertSessionId(sessionId);

  const home = resolveDshHome();
  const persistence = ctx.get('sessionPersistence');
  const registry = ctx.get('workspaceRegistry');
  const cache = ctx.get('sessionProjectionCache');
  const removed = [];
  const skipped = [];
  const evicted = [];
  const report = { stopped: false, evicted, skipped };

  // 1. Resolve the artifact while the header index still knows this session.
  const logPath = await resolveLogPath(persistence, sessionId);
  const directories = new Set(await findLogDirectories(home, sessionId));
  if (typeof logPath === 'string') directories.add(dirname(logPath));

  // 2. Stop running work and evict the live instances (open-but-idle included).
  await stopAndEvict(ctx, registry, sessionId, report);

  // 3. Workspace accounting: `sessionKnown` reads the persistence list, so detaching after
  //    the log is gone would fail. Every call here is an idempotent no-op when absent.
  let detached = false;
  try {
    const projects = (await registry?.list?.()) ?? [];
    for (const project of projects) {
      if (project?.sessionIds?.includes(sessionId) === true) {
        await project.detachSession(sessionId);
        detached = true;
      }
    }
    await registry?.unarchiveSession?.(sessionId);
    await registry?.unpinSession?.(sessionId);
  } catch (error) {
    skipped.push(`workspaceRegistry: ${describeError(error)}`);
  }

  // 4. Projection cache through the domain's own write chain, so durable state and the
  //    in-memory table agree; the file is unlinked afterwards as a safety net.
  let cacheRowDeleted = false;
  try {
    const table = cache?.requireTable?.();
    if (table !== undefined && typeof table.delete === 'function') {
      cacheRowDeleted = (await table.delete(sessionId)) === true;
    }
  } catch (error) {
    skipped.push(`sessionProjectionCache: ${describeError(error)}`);
  }
  const cacheFile = join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`);
  await rm(cacheFile, { force: true });

  // 5. The log artifact: the whole session directory, covering every stored generation plus
  //    the ownership lock file.
  for (const target of directories) {
    await rm(target, { recursive: true, force: true });
    removed.push(target);
  }

  // 6. Tell connected clients to drop the row.
  try {
    ctx.emit('api-session/removed', sessionId);
  } catch (error) {
    skipped.push(`emit: ${describeError(error)}`);
  }

  return { sessionId, removed, cacheFile, cacheRowDeleted, detached, stopped: report.stopped, evicted, skipped };
}

/** The Cordis service exposed to the Client through Typert. */
export class SessionDeleteService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Permanently delete one session.
   * @param request - carries the session to delete.
   * @returns the removal report.
   */
  async delete(request) {
    return deleteSession(this.ctx, request?.sessionId);
  }
}

/**
 * Register the service and bind it to the wire namespace. The matching reflection lives in
 * `./typert`, so the Gateway never falls back to source discovery.
 * @param ctx - the plugin Context.
 */
export function apply(ctx) {
  const service = new SessionDeleteService(ctx);
  service.typertRemote = Object.freeze({ service, serviceKey: name, namespace: name });
  ctx.provide(name, service);
}
