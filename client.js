// dsh-managed-workspaces: Web client half.
//
// Registers a 工作区 action in the sidebar footer and one overlay dialog that
// manages the host-side workspace manifest through the plugin's HTTP routes.

window.__ModuleLoader__.load({
  id: 'dsh-managed-workspaces',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'managedWorkspaces'
    const API = '/dsh-managed-workspaces/api/'

    const zh = {
      title: '托管工作区',
      subtitle: 'DSH 在指定根目录下创建的工作区，可关联多个文件夹',
      close: '关闭',
      loading: '正在读取工作区状态…',
      baseLabel: '工作区根目录',
      baseHint: '新建的工作区会创建为该目录下的一个子文件夹；正在使用的工作区不会被移动。',
      save: '保存',
      browse: '浏览…',
      createLabel: '新建工作区',
      createPlaceholder: '例如：我的项目',
      create: '新建',
      createHint: '会创建 <根目录>/<名称>/，其中 _roots/ 存放关联文件夹的链接。',
      workspacesLabel: '已托管的工作区',
      workspacesEmpty: '还没有托管工作区。',
      candidatesLabel: '已有工作区（未接入）',
      candidatesHint: '侧边栏里已存在、但还没纳入插件管理的工作区。接入不会移动或新建任何文件。',
      adopt: '接入',
      adoptAll: '全部接入',
      'origin.adopted': '已接入',
      'status.registered': '已注册',
      'status.unregistered': '未注册',
      'status.missing': '目录缺失',
      linksLabel: '关联文件夹',
      linksEmpty: '还没有关联文件夹。',
      'health.ok': '正常',
      'health.target-missing': '目标不存在',
      'health.link-missing': '链接丢失',
      'health.conflict': '冲突',
      register: '注册到侧边栏',
      repair: '修复',
      migrate: '迁移…',
      migrateCancel: '取消',
      migrateStart: '开始迁移',
      migrateTitle: '迁移到新位置',
      migrateDestination: '目标路径（必须尚不存在）',
      migrateHint: '会移动工作区目录；普通文件不受影响。',
      migrateAnchorHint: '该工作区有 {count} 个会话。迁移后原路径会保留为指向新位置的目录链接，历史对话继续可用（会话记录里的工作目录不可修改）。',
      migrateCleanHint: '该工作区没有会话，将直接迁移并在侧边栏更新为新路径。',
      migrateConfirm: '现在迁移工作区「{name}」？\n\n{detail}\n\n目标：{destination}',
      migratedTo: '实际位置',
      forget: '从插件移除',
      forgetConfirm: '从插件移除工作区「{name}」？\n只会删除侧边栏注册与插件记录，不会删除任何文件夹或会话。',
      forgetAdopted: '移出插件',
      forgetAdoptedConfirm: '把工作区「{name}」移出插件管理？\n不会删除任何文件，也不会取消它在侧边栏的注册。',
      detach: '解除关联',
      attach: '关联',
      linkFolder: '要关联的文件夹（绝对路径）',
      linkAlias: '别名（可选，默认取文件夹名）',
      rootsHint: '关联文件夹通过 {roots}/<别名> 出现在工作区内；解除关联只删除链接，不删除原文件夹。',
      footerHint: '工作区出现在侧边栏后，在该行新建会话即可开始工作。',
    }

    const en = {
      title: 'Managed workspaces',
      subtitle: 'Workspaces DSH creates under a base directory, with linked folders',
      close: 'Close',
      loading: 'Reading workspace state…',
      baseLabel: 'Workspace base directory',
      baseHint: 'New workspaces are created as a subfolder of this directory; existing workspaces are never moved.',
      save: 'Save',
      browse: 'Browse…',
      createLabel: 'New workspace',
      createPlaceholder: 'For example: my project',
      create: 'Create',
      createHint: 'Creates <base>/<name>/; the _roots/ folder holds links to associated folders.',
      workspacesLabel: 'Managed workspaces',
      workspacesEmpty: 'No managed workspaces yet.',
      candidatesLabel: 'Existing workspaces (not managed)',
      candidatesHint: 'Workspaces already in the sidebar that this plugin does not manage yet. Adopting moves and creates nothing.',
      adopt: 'Adopt',
      adoptAll: 'Adopt all',
      'origin.adopted': 'Adopted',
      'status.registered': 'Registered',
      'status.unregistered': 'Not registered',
      'status.missing': 'Folder missing',
      linksLabel: 'Linked folders',
      linksEmpty: 'No linked folders yet.',
      'health.ok': 'OK',
      'health.target-missing': 'Target missing',
      'health.link-missing': 'Link missing',
      'health.conflict': 'Conflict',
      register: 'Register in sidebar',
      repair: 'Repair',
      migrate: 'Migrate…',
      migrateCancel: 'Cancel',
      migrateStart: 'Migrate',
      migrateTitle: 'Migrate to a new location',
      migrateDestination: 'Destination path (must not exist yet)',
      migrateHint: 'Moves the workspace directory; ordinary files are unaffected.',
      migrateAnchorHint: 'This workspace has {count} session(s). After migrating, the original path stays as a directory link to the new location so the recorded conversations keep working (a session records its working directory immutably).',
      migrateCleanHint: 'No session uses this workspace, so it is moved and re-registered at the new path directly.',
      migrateConfirm: 'Migrate workspace "{name}" now?\n\n{detail}\n\nDestination: {destination}',
      migratedTo: 'Content location',
      forget: 'Remove from plugin',
      forgetConfirm: 'Remove workspace "{name}" from the plugin?\nOnly the sidebar registration and the plugin record are removed; no folder or session is deleted.',
      forgetAdopted: 'Stop managing',
      forgetAdoptedConfirm: 'Stop managing workspace "{name}"?\nNo file is deleted and its sidebar registration is kept.',
      detach: 'Unlink',
      attach: 'Link',
      linkFolder: 'Folder to link (absolute path)',
      linkAlias: 'Alias (optional, defaults to the folder name)',
      rootsHint: 'A linked folder appears inside the workspace as {roots}/<alias>; unlinking removes only the link, never the folder.',
      footerHint: 'Once the workspace appears in the sidebar, start a session from its row.',
    }

    const CSS = `
.dsh-mws-foot{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 8px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--dsw-font-xs-13);cursor:pointer;}
.dsh-mws-foot:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dsh-mws-foot:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px;}
.dsh-mws-foot-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dsh-mws-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,14,26,.42);}
.dsh-mws-dialog{display:flex;flex-direction:column;width:min(760px,100%);max-height:min(84vh,820px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl);box-shadow:var(--dsw-elevation-panel);font-family:var(--dsw-font-family);overflow:hidden;outline:none;}
.dsh-mws-head{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.dsh-mws-title{font-size:15px;font-weight:600;line-height:1.35;}
.dsh-mws-subtitle{margin-top:3px;font-size:12px;color:var(--dsw-alias-label-tertiary);}
.dsh-mws-close{margin-left:auto;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);font-size:18px;line-height:1;cursor:pointer;}
.dsh-mws-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dsh-mws-body{padding:14px 18px 18px;overflow:auto;}
.dsh-mws-content{display:flex;flex-direction:column;gap:16px;}
.dsh-mws-section{display:flex;flex-direction:column;gap:8px;}
.dsh-mws-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);}
.dsh-mws-row{display:flex;align-items:center;gap:8px;}
.dsh-mws-grow{flex:1;min-width:0;}
.dsh-mws-input{height:30px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;}
.dsh-mws-input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:0;border-color:transparent;}
.dsh-mws-btn{height:30px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;}
.dsh-mws-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
.dsh-mws-btn:disabled{opacity:.5;cursor:default;}
.dsh-mws-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px;}
.dsh-mws-primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted);}
.dsh-mws-primary:hover:not(:disabled){filter:brightness(1.05);background:var(--dsw-alias-state-business-primary);}
.dsh-mws-danger{color:var(--dsw-alias-state-error-primary);}
.dsh-mws-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}
.dsh-mws-warn{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-warn-primary);}
.dsh-mws-error{padding:9px 11px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;margin-bottom:12px;}
.dsh-mws-card{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);padding:10px;}
.dsh-mws-card-head{display:flex;align-items:flex-start;gap:8px;}
.dsh-mws-disclosure{width:20px;height:20px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer;}
.dsh-mws-card-text{flex:1;min-width:0;}
.dsh-mws-card-name{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;}
.dsh-mws-path{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dsh-mws-chip{padding:1px 7px;border-radius:999px;font-size:11px;font-weight:500;line-height:1.6;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);}
.dsh-mws-chip.ok{color:var(--dsw-alias-state-success-primary);}
.dsh-mws-chip.warn{color:var(--dsw-alias-state-warn-primary);}
.dsh-mws-chip.bad{color:var(--dsw-alias-state-error-primary);}
.dsh-mws-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.dsh-mws-card-body{display:flex;flex-direction:column;gap:8px;margin:10px 0 0 28px;}
.dsh-mws-link{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);font-size:12px;}
.dsh-mws-code{font-family:var(--dsw-font-family);font-size:12px;color:var(--dsw-alias-label-secondary);}
.dsh-mws-arrow{color:var(--dsw-alias-label-tertiary);}
.dsh-mws-addlink{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);}
.dsh-mws-migrate{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);}
.dsh-mws-candidate{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);}
@media (max-width:520px){.dsh-mws-backdrop{padding:0;}.dsh-mws-dialog{max-height:100vh;height:100vh;border-radius:0;}}
`

    function apply(ctx) {
      const translate = (key) => {
        try {
          return ctx.locale.bind(NS)(key)
        } catch {
          return key
        }
      }

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-managed-workspaces: locale')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-dsh-managed-workspaces', '')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => {
          try {
            style.remove()
          } catch {
            // The document may already be tearing down.
          }
        }
      }, 'dsh-managed-workspaces: styles')

      let snapshot = { open: false, loading: false, data: null, error: null, busy: null }
      const listeners = new Set()
      const getSnapshot = () => snapshot
      const setSnapshot = (patch) => {
        snapshot = { ...snapshot, ...patch }
        for (const listener of listeners) listener()
      }
      const subscribe = (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
      const messageOf = (error) => (error instanceof Error ? error.message : String(error))

      async function call(action, payload) {
        const response = await fetch(API + action, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-dsh-managed-workspaces': '1' },
          body: JSON.stringify(payload ?? {}),
          credentials: 'same-origin',
        })
        const text = await response.text()
        let body
        try {
          body = JSON.parse(text)
        } catch {
          throw new Error(`HTTP ${response.status}`)
        }
        if (!response.ok || body === null || body.ok !== true) {
          const detail = body !== null && body.error !== undefined ? body.error.message : undefined
          throw new Error(detail ?? `HTTP ${response.status}`)
        }
        return body
      }

      async function refresh() {
        setSnapshot({ loading: true, error: null })
        try {
          const body = await call('state')
          setSnapshot({ data: body, loading: false })
        } catch (error) {
          setSnapshot({ loading: false, error: messageOf(error) })
        }
      }

      async function mutate(action, payload) {
        setSnapshot({ busy: action, error: null })
        try {
          await call(action, payload)
          setSnapshot({ busy: null })
          await refresh()
          return true
        } catch (error) {
          setSnapshot({ busy: null, error: messageOf(error) })
          return false
        }
      }

      async function pickFolder() {
        try {
          const picker = ctx.get('remote')?.directoryPicker
          if (picker === undefined || typeof picker.pick !== 'function') return null
          const result = await picker.pick()
          return result !== null && result !== undefined && result.ok === true && typeof result.value === 'string'
            ? result.value
            : null
        } catch {
          return null
        }
      }

      function icon() {
        return h(
          'svg',
          { width: 15, height: 15, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
          h('path', {
            d: 'M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4l1.2 1.4h4.4A1.5 1.5 0 0 1 13 5.9v5.6A1.5 1.5 0 0 1 11.5 13h-8A1.5 1.5 0 0 1 2 11.5z',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.2',
            'stroke-linejoin': 'round',
          }),
          h('path', {
            d: 'M8 7.2v3.6M6.2 9h3.6',
            stroke: 'currentColor',
            'stroke-width': '1.2',
            'stroke-linecap': 'round',
          }),
        )
      }

      function FooterButton(props) {
        const t = props.t ?? translate
        const state = React.useSyncExternalStore(subscribe, getSnapshot)
        const wide = props.wide === true
        const open = () => {
          setSnapshot({ open: true })
          if (snapshot.data === null && snapshot.loading === false) refresh()
        }
        return h(
          'button',
          {
            type: 'button',
            className: wide ? 'dsh-mws-foot dsh-mws-foot-wide' : 'dsh-mws-foot',
            title: t('title'),
            'aria-label': t('title'),
            'aria-haspopup': 'dialog',
            'aria-expanded': state.open ? 'true' : 'false',
            onClick: open,
          },
          icon(),
          wide ? h('span', { className: 'dsh-mws-foot-label' }, t('title')) : null,
        )
      }

      function Overlay(props) {
        const t = props.t ?? translate
        const state = React.useSyncExternalStore(subscribe, getSnapshot)
        const dialogRef = React.useRef(null)
        React.useEffect(() => {
          if (!state.open) return undefined
          const onKey = (event) => {
            if (event.key === 'Escape') setSnapshot({ open: false })
          }
          window.addEventListener('keydown', onKey, true)
          return () => window.removeEventListener('keydown', onKey, true)
        }, [state.open])
        React.useEffect(() => {
          if (state.open && snapshot.data === null && snapshot.loading === false) refresh()
          if (state.open && dialogRef.current !== null) {
            try {
              dialogRef.current.focus()
            } catch {
              // Focus is best effort.
            }
          }
        }, [state.open])
        if (!state.open) return null
        return h(
          'div',
          {
            className: 'dsh-mws-backdrop',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) setSnapshot({ open: false })
            },
          },
          h(
            'div',
            {
              className: 'dsh-mws-dialog',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': t('title'),
              tabIndex: -1,
              ref: dialogRef,
            },
            h(
              'div',
              { className: 'dsh-mws-head' },
              h(
                'div',
                null,
                h('div', { className: 'dsh-mws-title' }, t('title')),
                h('div', { className: 'dsh-mws-subtitle' }, t('subtitle')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-mws-close',
                  'aria-label': t('close'),
                  onClick: () => setSnapshot({ open: false }),
                },
                '×',
              ),
            ),
            h(
              'div',
              { className: 'dsh-mws-body' },
              state.error !== null ? h('div', { className: 'dsh-mws-error', role: 'alert' }, state.error) : null,
              state.loading && state.data === null ? h('div', { className: 'dsh-mws-hint' }, t('loading')) : null,
              state.data !== null
                ? h(Content, { t, data: state.data, busy: state.busy })
                : null,
            ),
          ),
        )
      }

      function Content(props) {
        const t = props.t
        const data = props.data
        const busy = props.busy
        const [base, setBase] = React.useState(data.baseDirectory)
        React.useEffect(() => setBase(data.baseDirectory), [data.baseDirectory])
        const candidates = data.candidates ?? []
        return h(
          'div',
          { className: 'dsh-mws-content' },
          h(
            'section',
            { className: 'dsh-mws-section' },
            h('div', { className: 'dsh-mws-label' }, t('baseLabel')),
            h(
              'div',
              { className: 'dsh-mws-row' },
              h('input', {
                className: 'dsh-mws-input dsh-mws-grow',
                value: base,
                spellCheck: false,
                onChange: (event) => setBase(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') mutate('config', { baseDirectory: base })
                },
              }),
              h(
                'button',
                {
                  className: 'dsh-mws-btn',
                  type: 'button',
                  disabled: busy !== null,
                  onClick: async () => {
                    const picked = await pickFolder()
                    if (picked !== null) setBase(picked)
                  },
                },
                t('browse'),
              ),
              h(
                'button',
                {
                  className: 'dsh-mws-btn dsh-mws-primary',
                  type: 'button',
                  disabled: busy !== null,
                  onClick: () => mutate('config', { baseDirectory: base }),
                },
                t('save'),
              ),
            ),
            h('div', { className: 'dsh-mws-hint' }, t('baseHint')),
            data.warnings.length > 0 ? h('div', { className: 'dsh-mws-warn' }, data.warnings.join(' ')) : null,
          ),
          h(CreateForm, { t, busy }),
          data.candidates !== undefined && candidates.length > 0
            ? h(
                'section',
                { className: 'dsh-mws-section' },
                h(
                  'div',
                  { className: 'dsh-mws-row' },
                  h('div', { className: 'dsh-mws-label dsh-mws-grow' }, t('candidatesLabel') + ' (' + candidates.length + ')'),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-mws-btn',
                      disabled: busy !== null,
                      onClick: () => mutate('adopt', { all: true }),
                    },
                    t('adoptAll'),
                  ),
                ),
                h('div', { className: 'dsh-mws-hint' }, t('candidatesHint')),
                candidates.map((candidate) =>
                  h(
                    'div',
                    { key: candidate.path, className: 'dsh-mws-candidate' },
                    h(
                      'div',
                      { className: 'dsh-mws-card-text' },
                      h('div', { className: 'dsh-mws-card-name' }, candidate.title),
                      h('div', { className: 'dsh-mws-path', title: candidate.path }, candidate.path),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-mws-btn',
                        disabled: busy !== null,
                        onClick: () => mutate('adopt', { folder: candidate.path }),
                      },
                      t('adopt'),
                    ),
                  ),
                ),
              )
            : null,
          h(
            'section',
            { className: 'dsh-mws-section' },
            h('div', { className: 'dsh-mws-label' }, t('workspacesLabel')),
            data.workspaces.length === 0
              ? h('div', { className: 'dsh-mws-hint' }, t('workspacesEmpty'))
              : data.workspaces.map((workspace) => h(WorkspaceCard, { key: workspace.id, t, ws: workspace, busy })),
          ),
          h('div', { className: 'dsh-mws-hint' }, t('footerHint')),
        )
      }

      function CreateForm(props) {
        const t = props.t
        const busy = props.busy
        const [name, setName] = React.useState('')
        const submit = async () => {
          if (name.trim() === '') return
          const ok = await mutate('create', { name })
          if (ok) setName('')
        }
        return h(
          'section',
          { className: 'dsh-mws-section' },
          h('div', { className: 'dsh-mws-label' }, t('createLabel')),
          h(
            'div',
            { className: 'dsh-mws-row' },
            h('input', {
              className: 'dsh-mws-input dsh-mws-grow',
              value: name,
              placeholder: t('createPlaceholder'),
              spellCheck: false,
              onChange: (event) => setName(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit()
              },
            }),
            h(
              'button',
              {
                className: 'dsh-mws-btn dsh-mws-primary',
                type: 'button',
                disabled: busy !== null || name.trim() === '',
                onClick: submit,
              },
              t('create'),
            ),
          ),
          h('div', { className: 'dsh-mws-hint' }, t('createHint')),
        )
      }

      function WorkspaceCard(props) {
        const t = props.t
        const ws = props.ws
        const busy = props.busy
        const [expanded, setExpanded] = React.useState(false)
        const [migrating, setMigrating] = React.useState(false)
        const statusKey =
          ws.directory !== 'ok'
            ? 'status.missing'
            : ws.registered
              ? 'status.registered'
              : 'status.unregistered'
        const tone = ws.directory !== 'ok' ? 'bad' : ws.registered ? 'ok' : 'warn'
        return h(
          'div',
          { className: 'dsh-mws-card' },
          h(
            'div',
            { className: 'dsh-mws-card-head' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-mws-disclosure',
                'aria-expanded': expanded ? 'true' : 'false',
                'aria-label': ws.name,
                onClick: () => setExpanded(!expanded),
              },
              expanded ? '▾' : '▸',
            ),
            h(
              'div',
              { className: 'dsh-mws-card-text' },
              h(
                'div',
                { className: 'dsh-mws-card-name' },
                ws.name,
                ws.origin === 'adopted' ? h('span', { className: 'dsh-mws-chip' }, t('origin.adopted')) : null,
                h('span', { className: 'dsh-mws-chip ' + tone }, t(statusKey)),
              ),
              h('div', { className: 'dsh-mws-path', title: ws.path }, ws.path),
              ws.relocatedTo !== null && ws.relocatedTo !== undefined
                ? h('div', { className: 'dsh-mws-hint' }, t('migratedTo') + ': ' + ws.relocatedTo)
                : null,
            ),
            h(
              'div',
              { className: 'dsh-mws-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-mws-btn',
                  disabled: busy !== null || ws.directory !== 'ok',
                  onClick: () => {
                    setExpanded(true)
                    setMigrating(true)
                  },
                },
                t('migrate'),
              ),
              !ws.registered
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-mws-btn',
                      disabled: busy !== null || ws.directory !== 'ok',
                      onClick: () => mutate('register', { id: ws.id }),
                    },
                    t('register'),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-mws-btn',
                  disabled: busy !== null,
                  onClick: () => mutate('repair', { id: ws.id }),
                },
                t('repair'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-mws-btn dsh-mws-danger',
                  disabled: busy !== null,
                  onClick: () => {
                    const adopted = ws.origin === 'adopted'
                    const template = adopted ? t('forgetAdoptedConfirm') : t('forgetConfirm')
                    if (window.confirm(template.replace('{name}', ws.name))) mutate('forget', { id: ws.id })
                  },
                },
                ws.origin === 'adopted' ? t('forgetAdopted') : t('forget'),
              ),
            ),
          ),
          expanded
            ? h(
                'div',
                { className: 'dsh-mws-card-body' },
                migrating ? h(MigrateForm, { t, ws, busy, onClose: () => setMigrating(false) }) : null,
                h('div', { className: 'dsh-mws-label' }, t('linksLabel')),
                ws.links.length === 0
                  ? h('div', { className: 'dsh-mws-hint' }, t('linksEmpty'))
                  : ws.links.map((link) => h(LinkRow, { key: link.alias, t, ws, link, busy })),
                h(AddLinkForm, { t, ws, busy }),
                h('div', { className: 'dsh-mws-hint' }, t('rootsHint').replace('{roots}', '_roots')),
              )
            : null,
        )
      }

      function MigrateForm(props) {
        const t = props.t
        const ws = props.ws
        const busy = props.busy
        const [destination, setDestination] = React.useState('')
        const detail =
          ws.sessionCount > 0
            ? t('migrateAnchorHint').replace('{count}', String(ws.sessionCount))
            : t('migrateCleanHint')
        const submit = async () => {
          const value = destination.trim()
          if (value === '') return
          const confirmed = window
            .confirm(t('migrateConfirm').replace('{name}', ws.name).replace('{detail}', detail).replace('{destination}', value))
          if (!confirmed) return
          const ok = await mutate('migrate', { id: ws.id, destination: value, mode: 'auto' })
          if (ok) {
            setDestination('')
            props.onClose()
          }
        }
        const browse = async () => {
          const picked = await pickFolder()
          if (picked === null) return
          const name = ws.path.split(/[\\/]/).filter(Boolean).pop() ?? 'workspace'
          const separator = picked.includes('\\') ? '\\' : '/'
          setDestination(picked.replace(/[\\/]+$/, '') + separator + name)
        }
        return h(
          'div',
          { className: 'dsh-mws-migrate' },
          h('div', { className: 'dsh-mws-label' }, t('migrateTitle')),
          h(
            'div',
            { className: 'dsh-mws-row' },
            h('input', {
              className: 'dsh-mws-input dsh-mws-grow',
              value: destination,
              placeholder: t('migrateDestination'),
              spellCheck: false,
              onChange: (event) => setDestination(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit()
              },
            }),
            h('button', { type: 'button', className: 'dsh-mws-btn', onClick: browse }, t('browse')),
          ),
          h('div', { className: 'dsh-mws-hint' }, detail),
          h('div', { className: 'dsh-mws-hint' }, t('migrateHint')),
          h(
            'div',
            { className: 'dsh-mws-row' },
            h(
              'button',
              { type: 'button', className: 'dsh-mws-btn', disabled: busy !== null, onClick: () => props.onClose() },
              t('migrateCancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-mws-btn dsh-mws-primary',
                disabled: busy !== null || destination.trim() === '',
                onClick: submit,
              },
              t('migrateStart'),
            ),
          ),
        )
      }

      function LinkRow(props) {
        const t = props.t
        const ws = props.ws
        const link = props.link
        const busy = props.busy
        return h(
          'div',
          { className: 'dsh-mws-link' },
          h('code', { className: 'dsh-mws-code' }, '_roots/' + link.alias),
          h('span', { className: 'dsh-mws-arrow' }, '→'),
          h('span', { className: 'dsh-mws-path dsh-mws-grow', title: link.target }, link.target),
          h('span', { className: 'dsh-mws-chip ' + (link.health === 'ok' ? 'ok' : 'bad') }, t('health.' + link.health)),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-mws-btn',
              disabled: busy !== null,
              onClick: () => mutate('detach', { id: ws.id, alias: link.alias }),
            },
            t('detach'),
          ),
        )
      }

      function AddLinkForm(props) {
        const t = props.t
        const ws = props.ws
        const busy = props.busy
        const [folder, setFolder] = React.useState('')
        const [alias, setAlias] = React.useState('')
        const submit = async () => {
          if (folder.trim() === '') return
          const payload = { id: ws.id, folder }
          if (alias.trim() !== '') payload.alias = alias
          const ok = await mutate('attach', payload)
          if (ok) {
            setFolder('')
            setAlias('')
          }
        }
        return h(
          'div',
          { className: 'dsh-mws-addlink' },
          h(
            'div',
            { className: 'dsh-mws-row' },
            h('input', {
              className: 'dsh-mws-input dsh-mws-grow',
              value: folder,
              placeholder: t('linkFolder'),
              spellCheck: false,
              onChange: (event) => setFolder(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit()
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-mws-btn',
                onClick: async () => {
                  const picked = await pickFolder()
                  if (picked !== null) setFolder(picked)
                },
              },
              t('browse'),
            ),
          ),
          h(
            'div',
            { className: 'dsh-mws-row' },
            h('input', {
              className: 'dsh-mws-input dsh-mws-grow',
              value: alias,
              placeholder: t('linkAlias'),
              spellCheck: false,
              onChange: (event) => setAlias(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit()
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-mws-btn dsh-mws-primary',
                disabled: busy !== null || folder.trim() === '',
                onClick: submit,
              },
              t('attach'),
            ),
          ),
        )
      }

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-managed-workspaces',
            order: 40,
            label: translate('title'),
            locale: NS,
          },
          FooterButton,
        ),
      )

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-managed-workspaces',
            order: 900,
            locale: NS,
          },
          Overlay,
        ),
      )

      return () => {
        listeners.clear()
      }
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
