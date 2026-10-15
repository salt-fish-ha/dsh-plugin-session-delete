# dsh-plugin-session-delete

**Permanently delete a conversation from the DSH sidebar.**

DSH ships no session deletion: `@deepseek-ai/dsh-session-persistence` documents
*"No deletion or retention API — pruning stored sessions is out-of-band backend maintenance"*,
and the session Remote surface has no `delete`. This plugin is that out-of-band maintenance,
wired to a normal sidebar action.

## What it adds

- A **trash icon button** on each sidebar conversation row's hover strip, after the shipped
  archive (100) and pin (200) buttons.
- A **"Delete conversation" item** in the row's `…` menu, so it is reachable without hovering.
- A **confirmation dialog** (in `shell.overlay`) naming the conversation, because the action
  is irreversible.

Both entries register on seats declared by `@deepseek-ai/dsh-client-ui-workspace`:
`sidebar.workspaces.session.row.action` and `sidebar.workspaces.session.menu.item`.

## What "delete" removes

| Artifact | How |
|---|---|
| Session log directory (`<DSH home>/sessions/<project>/<sessionId>/`, every stored generation and `session.lock`) | `fs.rm` — no API exists |
| Projection-cache record | `ctx.sessionProjectionCache.requireTable().delete(id)` |
| Workspace membership | `Workspace#detachSession(id)` |
| Archive / pin bookkeeping | `registry.unarchiveSession(id)`, `registry.unpinSession(id)` |
| Connected clients | `ctx.emit('api-session/removed', id)` |

Ordering is deliberate: the log path is resolved **before** anything else, and workspace
accounting runs **before** the log is removed, because `sessionKnown` rebuilds from
`sessionPersistence.list()`.

## Safety

- **Refuses a live session.** No supported API can stop a running session's owner, so the
  plugin reports "close it first" instead of deleting files under a live writer.
- **Rejects hostile ids** — anything containing a path separator, control character, `.` or
  `..` is refused before touching the filesystem.
- **Confirms before deleting**, and shows the Host's error text in the dialog on failure.
- The panel is shown on every execution path (Host logic is covered by a self-test that
  builds a throwaway store and asserts logs, cache rows, bystanders, refusal and traversal
  guards).

## Installing and updating

Place the package at `<profile>/node_modules/dsh-plugin-session-delete/` and register it in the
profile manifest:

```json
{
  "dependencies": { "dsh-plugin-session-delete": "file:../../plugins/dsh-plugin-session-delete" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-plugin-session-delete"] } }
}
```

**A full application restart is required** after installing or updating this plugin. DSH's HMR
does apply the bundle-list change live — it re-reads the package manifest and applies
`cordis.patch.yml` within seconds — but it does not swap JavaScript module generations:
*"Package replacements require restarting the process to load a fresh JavaScript module
generation."* Quit DSH completely (tray icon, not just the window) and reopen it. Verified
behaviour on DSH 0.2.0-rc.2: after registering the bundle, the running Host read this package's
`package.json` and `cordis.patch.yml` but never re-read `lib/index.js`.

Changes to `lib/client.js` alone are picked up without a restart, because `dsh-client-hmr`
polls the served artifact — but only once the row is loaded.

## Verified on a live installation

Checked against DSH 0.2.0-rc.2 on Windows with the plugin installed in a `desktop` profile.

**Load path.** After a full restart the Host imported `lib/index.js`, registered the Typert
reflection (`lib/typert.host.js` + `lib/remote.js`), applied `cordis.patch.yml`, and pulled
`lib/client.js` into the served browser graph — all within about two seconds of process start.
The control for that signal: a bundle present in `dependencies` but *not* in
`dsh.profile.bundles` was not read at startup at all.

**Row UI.** The hover strip renders the trash button and the `…` menu renders the delete item.
The confirmation dialog shows the conversation title with the danger-styled confirm button.

**A real deletion.** Deleting a conversation removed all three artifact groups together:

- its `<DSH home>/sessions/<project>/<sessionId>/` log directory,
- its `<DSH home>/storages/session_projcache/sessions/<sessionId>.json` record,
- its entry in `workspace.json`'s `sessionIds`, with `archivedSessionIds` and
  `pinnedSessionIds` left clean.

Afterwards the store held 13 session logs against 13 projection-cache records with no orphan in
either direction, no leftover `session.lock` anywhere, and every other conversation — in that
workspace and in the two unrelated workspaces — untouched. Note that DSH writes no log files
(`%APPDATA%\DeepSeek Harness`, `%LOCALAPPDATA%\DeepSeek Harness` and `<DSH home>/logs` do not
exist), so that state was read directly from the store.

## Install on another machine

The plugin has **no runtime dependencies and no build step**, so it transfers as-is. Fully quit
DSH before installing, and restart it afterwards.

**From the package file.** Copy `dsh-plugin-session-delete-<version>.tgz` to the target machine,
then in DSH open the **Plugins** page, choose **Add plugin**, and enter the **absolute path** to
the tarball. DSH runs `pnpm add <path>` inside the profile, appends the package to
`dsh.profile.bundles`, and reloads. The tarball uses npm's `package/` layout.

**From a directory.** Copy the package folder to
`<profile>/node_modules/dsh-plugin-session-delete/` and add it to the profile manifest as shown
above. No lockfile change is needed for composition.

Either way the bundle list is applied live, but **the new Host module generation only loads on a
fresh process**, so restart DSH.

Re-pack from this source tree with:

```sh
mkdir -p /tmp/stage/package
cp package.json cordis.patch.yml README.md LICENSE /tmp/stage/package/
cp -r lib locale /tmp/stage/package/
tar -czf dsh-plugin-session-delete-0.1.0.tgz -C /tmp/stage package
```
## Not covered

- **Attachments.** `<DSH home>/attachments/v1/objects/…` is content-addressed and shared
  across sessions; deleting objects could break other conversations.
- **Spill files.** `<spill root>/session-<hash>/…` has no per-session cleanup API; only the
  age-based startup sweep removes them.
- Cross-process: deleting behind a *second* running DSH leaves that process's in-memory
  store stale until it restarts.

## Layout

```text
package.json        dsh.bundle.patch + dsh.client
cordis.patch.yml    inserts the plugin row
lib/index.js        Host plugin: SessionDeleteService, the real deletion
lib/remote.js       strict wire descriptor (hand-authored, no schema library)
lib/typert.host.js  TYPERT reflection for the ./typert export
lib/client.js       hand-written client bundle: row button, menu item, confirm dialog
locale/{en,zh}.json plugin title/description
```

No build step and no third-party runtime dependency: the Host half imports only `node:*`, and
the client half needs only the browser module table's `react` and
`@deepseek-ai/dsh-client-ui-primitives`.

## License

MIT.
