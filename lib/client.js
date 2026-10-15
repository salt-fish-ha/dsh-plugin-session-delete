// Hand-written client bundle for dsh-plugin-session-delete.
// Uses only DSH's public client surface: slots, the Typert remote namespace, the
// session list, locale, and React. No private DOM or API routes, no bundler required.
window.__ModuleLoader__.load({id:'dsh-plugin-session-delete',factory:function(require){
'use strict';
function createPlugin(require) {
  const React = require('react');
  const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
  const { Tooltip, MenuItemButton, IconTrashOutlineRegular, IconWarningTriangleOutlineRegular } = primitives;
  const h = React.createElement;

  /** Our own dictionary; the active language is supplied by DSH, never the OS. */
  const MESSAGES = Object.freeze({
    en: Object.freeze({
      'action.delete': 'Delete conversation',
      'menu.deleteSession': 'Delete conversation',
      'dialog.title': 'Delete this conversation?',
      'dialog.body': 'This permanently deletes the conversation and its stored history, cached projections and workspace entry. It cannot be undone. If it is running, it is stopped first.',
      'dialog.cancel': 'Cancel',
      'dialog.confirm': 'Delete permanently',
      'dialog.deleting': 'Deleting…',
      'error.title': 'Delete failed',
    }),
    zh: Object.freeze({
      'action.delete': '删除对话',
      'menu.deleteSession': '删除对话',
      'dialog.title': '删除这个对话？',
      'dialog.body': '将永久删除该对话及其已保存的历史记录、投影缓存与工作区索引，且无法恢复。如果它正在运行，会先停止它。',
      'dialog.cancel': '取消',
      'dialog.confirm': '永久删除',
      'dialog.deleting': '正在删除…',
      'error.title': '删除失败',
    }),
  });

  const CSS = `
.dsh-session-delete-icon{border-radius:var(--dsw-radius-xs);cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dsh-session-delete-icon:hover{color:var(--dsw-alias-label-primary)}
.dsh-session-delete-scrim{position:fixed;inset:0;z-index:60;background:light-dark(#0000004d,#0000008c);display:flex;align-items:center;justify-content:center;padding:24px}
.dsh-session-delete-panel{box-sizing:border-box;width:min(440px,100%);background:var(--dsw-alias-bg-module-platform,light-dark(#ffffff,#353638));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2,light-dark(#0000001a,#ffffff1f));border-radius:12px;box-shadow:0 12px 32px #0000003d;padding:20px;display:flex;flex-direction:column;gap:10px}
.dsh-session-delete-head{display:flex;align-items:center;gap:8px;font-size:15px;line-height:22px;font-weight:600}
.dsh-session-delete-head svg{flex:none;color:var(--dsw-alias-label-warning,var(--dsw-alias-label-secondary))}
.dsh-session-delete-subject{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-weight:500}
.dsh-session-delete-body{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dsh-session-delete-error{font-size:12px;line-height:18px;color:light-dark(#c62a2f,#ff6369);overflow-wrap:anywhere}
.dsh-session-delete-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.dsh-session-delete-btn{font:inherit;font-size:13px;line-height:20px;cursor:pointer;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,light-dark(#0000001a,#ffffff1f));background:var(--dsw-alias-interactive-bg-hover,light-dark(#2631480f,#ffffff14));color:var(--dsw-alias-label-primary);padding:6px 14px}
.dsh-session-delete-btn:hover{background:var(--dsw-alias-interactive-bg-active,light-dark(#2631481a,#ffffff24))}
.dsh-session-delete-btn[disabled]{opacity:.55;cursor:default}
.dsh-session-delete-btn-danger{background:light-dark(#c62a2f,#e5484d);border-color:transparent;color:#fff}
.dsh-session-delete-btn-danger:hover{background:light-dark(#ad2429,#d93b40)}
`;

  // The local half of the Remote contract. The client never imports the Host module, so the
  // descriptor is duplicated here verbatim — including the strict codec's `create` factory,
  // which is the only thing DSH calls (`create().parse(value)`).
  const SESSION_DELETE_CONTRIBUTION = {
    package: 'dsh-plugin-session-delete',
    descriptors: [
      {
        id: 'dsh-plugin-session-delete#sessionDelete/delete',
        service: 'sessionDelete',
        namespace: 'sessionDelete',
        method: 'delete',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'request',
            wire: 'request',
            source: 'json',
            codec: {
              mode: 'strict',
              typeSymbol: 'dsh-plugin-session-delete#SessionDeleteRequest',
              create: () => ({
                parse(value) {
                  if (value === null || typeof value !== 'object') {
                    throw new TypeError('session-delete: request must be an object');
                  }
                  const sessionId = value.sessionId;
                  if (typeof sessionId !== 'string' || sessionId.length === 0) {
                    throw new TypeError('session-delete: request.sessionId must be a non-empty string');
                  }
                  return value;
                },
              }),
            },
          },
        ],
        result: {
          mode: 'strict',
          typeSymbol: 'dsh-plugin-session-delete#SessionDeleteResult',
          create: () => ({ parse: (value) => value }),
        },
      },
    ],
  };

  const CSS_TAG = '@deepseek-ai/dsh-plugin-session-delete/confirm.css';
  function installCss() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') !== null) return;
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-plugin-session-delete';
    tag.dataset.pluginCss = CSS_TAG;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  /** Read the active language from DSH's locale seat; fall back to English. */
  function readLanguage(locale) {
    try {
      const active = locale?.getSnapshot?.()?.active;
      if (typeof active !== 'string' || active.length === 0) return 'en';
      return active.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } catch { return 'en'; }
  }

  /** Subscribe to language changes; returns synchronous idempotent cleanup. */
  function observeLanguage(locale, onChange) {
    let alive = true;
    let previous = readLanguage(locale);
    const publish = () => {
      if (!alive) return;
      const next = readLanguage(locale);
      if (next !== previous) { previous = next; onChange(next); }
    };
    let unsubscribe = () => {};
    try { unsubscribe = locale?.subscribe?.(publish) || (() => {}); } catch { unsubscribe = () => {}; }
    return () => { if (!alive) return; alive = false; try { unsubscribe(); } catch { /* already gone */ } };
  }

  function format(template, vars) {
    if (vars === undefined) return template;
    return template.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole));
  }

  /** A translator bound to the seat's locale, re-rendering on language change. */
  function useTranslator(locale) {
    const [language, setLanguage] = React.useState(() => readLanguage(locale));
    React.useEffect(() => observeLanguage(locale, setLanguage), [locale]);
    return React.useCallback((key, vars) => {
      const table = MESSAGES[language] ?? MESSAGES.en;
      return format(table[key] ?? MESSAGES.en[key] ?? key, vars);
    }, [language]);
  }

  /**
   * One pending deletion, shared by the row entry that opens it and the overlay dialog
   * that confirms it, so the 16px row strip never grows into a form.
   */
  const pendingStore = { current: null, listeners: new Set() };
  function setPending(next) {
    pendingStore.current = next;
    for (const listener of [...pendingStore.listeners]) {
      try { listener(next); } catch { /* a UI callback cannot break the store */ }
    }
  }
  function usePending() {
    const [value, setValue] = React.useState(pendingStore.current);
    React.useEffect(() => {
      const listener = (next) => setValue(next);
      pendingStore.listeners.add(listener);
      setValue(pendingStore.current);
      return () => { pendingStore.listeners.delete(listener); };
    }, []);
    return value;
  }

  /** The confirmation dialog, mounted on `shell.overlay`. */
  function DeleteConfirmDialog({ deleteSession, localeSeat }) {
    const request = usePending();
    const t = useTranslator(localeSeat);
    const [busy, setBusy] = React.useState(false);
    const [failure, setFailure] = React.useState(undefined);

    React.useEffect(() => {
      if (request === null) { setBusy(false); setFailure(undefined); }
    }, [request]);

    React.useEffect(() => {
      if (request === null) return undefined;
      const onKey = (event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        if (!busy) setPending(null);
      };
      document.addEventListener('keydown', onKey, true);
      return () => { document.removeEventListener('keydown', onKey, true); };
    }, [request, busy]);

    if (request === null) return null;

    const title = typeof request.displayTitle === 'string' && request.displayTitle.trim() !== ''
      ? request.displayTitle.trim()
      : request.sessionId;

    const confirm = () => {
      if (busy) return;
      setBusy(true);
      setFailure(undefined);
      Promise.resolve()
        .then(() => deleteSession(request.sessionId))
        .then(() => { setBusy(false); setPending(null); })
        .catch((error) => {
          setBusy(false);
          setFailure(error?.message !== undefined ? String(error.message) : String(error));
        });
    };

    return h('div', {
        className: 'dsh-session-delete-scrim',
        onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) setPending(null); },
      },
      h('div', {
          className: 'dsh-session-delete-panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('dialog.title'),
        },
        h('div', { className: 'dsh-session-delete-head' },
          h(IconWarningTriangleOutlineRegular, { size: 16 }),
          h('span', null, t('dialog.title')),
        ),
        h('div', { className: 'dsh-session-delete-subject' }, title),
        h('p', { className: 'dsh-session-delete-body' }, t('dialog.body')),
        failure === undefined ? null
          : h('div', { className: 'dsh-session-delete-error' }, t('error.title') + ': ' + failure),
        h('div', { className: 'dsh-session-delete-actions' },
          h('button', {
            type: 'button',
            className: 'dsh-session-delete-btn',
            disabled: busy,
            onClick: () => { if (!busy) setPending(null); },
          }, t('dialog.cancel')),
          h('button', {
            type: 'button',
            className: 'dsh-session-delete-btn dsh-session-delete-btn-danger',
            disabled: busy,
            onClick: confirm,
          }, busy ? t('dialog.deleting') : t('dialog.confirm')),
        ),
      ),
    );
  }

  /** Hover button on one Session row, after ui-workspace's archive (100) and pin (200). */
  function DeleteSessionRowButton({ sessionId, displayTitle, localeSeat }) {
    const t = useTranslator(localeSeat);
    const label = t('action.delete');
    return h(Tooltip, { label, side: 'bottom', align: 'end', delayMs: 500 },
      h('button', {
        type: 'button',
        className: 'dsh-session-delete-icon',
        'aria-label': label,
        title: label,
        onClick: () => { setPending({ sessionId, displayTitle }); },
      }, h(IconTrashOutlineRegular, { size: 14 })),
    );
  }

  /** The same action inside the row's “…” menu, so it is discoverable without hovering. */
  function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, localeSeat }) {
    const t = useTranslator(localeSeat);
    const [, setMenuOpen] = useMenuOpenState();
    return h(MenuItemButton, {
      danger: true,
      separatorBefore: true,
      icon: h(IconTrashOutlineRegular, { size: 14 }),
      onSelect: () => { setMenuOpen(false); setPending({ sessionId, displayTitle }); },
      children: t('menu.deleteSession'),
    });
  }

  return {
    inject: ['slots', 'remote', 'locale', 'sessions', 'connection'],
    apply(ctx) {
      installCss();

      // A Remote namespace only exists after the client publishes its local descriptor half,
      // and it is a separate Cordis capability that must then be injected in a CHILD fiber.
      let namespace;
      let disposal;
      let mounting;
      const waiting = [];

      function installNamespace(scope) {
        const service = scope.remote.sessionDelete;
        namespace = service;
        while (waiting.length > 0) waiting.shift()(service);
        scope.effect(() => () => { if (namespace === service) namespace = undefined; }, 'session-delete.namespace');
      }

      function mount() {
        if (mounting !== undefined) return mounting;
        mounting = Promise.resolve()
          .then(() => ctx.remote.$mount(SESSION_DELETE_CONTRIBUTION))
          .then((handle) => {
            disposal = typeof handle === 'function' ? handle : handle?.dispose;
            ctx.inject(['remote.sessionDelete'], installNamespace);
          })
          .catch((error) => { mounting = undefined; throw error; });
        return mounting;
      }

      const tryMount = () => { mount().catch(() => { /* retried on the next connection change */ }); };
      tryMount();
      ctx.effect(() => {
        let unsubscribe = () => {};
        try { unsubscribe = ctx.connection?.state?.subscribe?.(tryMount) || (() => {}); } catch { unsubscribe = () => {}; }
        return () => {
          try { unsubscribe(); } catch { /* already gone */ }
          try { disposal?.(); } catch { /* already withdrawn */ }
        };
      }, 'session-delete.mount');

      async function acquireNamespace() {
        if (namespace !== undefined) return namespace;
        await mount();
        if (namespace !== undefined) return namespace;
        return new Promise((resolve) => { waiting.push(resolve); });
      }

      async function deleteSession(sessionId) {
        const service = await acquireNamespace();
        const result = await service.delete({ sessionId });
        if (result !== undefined && result.ok === false) throw result.error;
        // The sidebar list owns its own store: refresh it so the row leaves immediately,
        // rather than waiting for the next list reconciliation.
        try { await ctx.sessions?.refreshList?.(); } catch { /* the row also disappears on the next list read */ }
        return result;
      }

      const locale = ctx.locale;

      ctx.slots.inject('sidebar.workspaces.session.row.action', () => ctx.slots.register({
        name: 'sidebar.workspaces.session.row.action',
        id: 'session-delete',
        order: 300,
        label: () => 'Delete conversation',
      }, (props) => h(DeleteSessionRowButton, { ...props, localeSeat: locale })));

      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
        name: 'sidebar.workspaces.session.menu.item',
        id: 'session-delete',
        order: 500,
      }, (props) => h(DeleteSessionMenuItem, { ...props, localeSeat: locale })));

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'session-delete-confirm',
        order: 95,
      }, () => h(DeleteConfirmDialog, { deleteSession, localeSeat: locale })));
    },
  };
}

return createPlugin(require);
}});
