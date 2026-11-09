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
      'menu.manage': '打开托管面板',
      'menu.attach': '关联文件夹…',
      'menu.migrate': '迁移…',
      'menu.repair': '修复',
      'menu.forget': '移出插件',
      'menu.adopt': '接入托管工作区',
      'flow.title': '添加工作区',
      'flow.subtitle': '由「托管工作区」接管添加流程',
      'flow.create': '新建托管工作区',
      'flow.createHint': '在根目录下创建一个新工作区文件夹',
      'flow.namePlaceholder': '工作区名称',
      'flow.pick': '选择已有文件夹',
      'flow.pickHint': '把已存在的文件夹添加为工作区（官方流程）',
      'flow.adopt': '接入已有工作区',
      'flow.adoptHint': '把侧边栏里尚未托管的工作区纳入插件',
      'flow.manage': '打开托管面板',
      'flow.cancel': '取消',
      'flow.busy': '处理中…',
      'flow.none': '没有待接入的工作区。',
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
      'menu.manage': 'Open managed workspace panel',
      'menu.attach': 'Link a folder…',
      'menu.migrate': 'Migrate…',
      'menu.repair': 'Repair',
      'menu.forget': 'Remove from plugin',
      'menu.adopt': 'Adopt into managed workspaces',
      'flow.title': 'Add workspace',
      'flow.subtitle': 'The managed-workspace plugin handles this flow',
      'flow.create': 'New managed workspace',
      'flow.createHint': 'Create a new workspace folder under the base directory',
      'flow.namePlaceholder': 'Workspace name',
      'flow.pick': 'Choose an existing folder',
      'flow.pickHint': 'Add an existing folder as a workspace (original flow)',
      'flow.adopt': 'Adopt an existing workspace',
      'flow.adoptHint': 'Bring a sidebar workspace that is not managed yet under the plugin',
      'flow.manage': 'Open the managed workspace panel',
      'flow.cancel': 'Cancel',
      'flow.busy': 'Working…',
      'flow.none': 'No workspace is waiting to be adopted.',
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
.dsh-mws-flow-backdrop{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,14,26,.35);}
.dsh-mws-flow-dialog{display:flex;flex-direction:column;gap:10px;width:min(520px,100%);max-height:min(80vh,640px);overflow:auto;padding:16px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl);box-shadow:var(--dsw-elevation-panel);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);}
.dsh-mws-flow-head{display:flex;align-items:flex-start;gap:10px;}
.dsh-mws-flow-option{display:flex;flex-direction:column;gap:3px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);cursor:pointer;text-align:left;font:inherit;color:inherit;}
.dsh-mws-flow-option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
.dsh-mws-flow-option:disabled{opacity:.5;cursor:default;}
.dsh-mws-flow-option-title{font-size:13px;font-weight:600;}
.dsh-mws-flow-option-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);}
.dsh-mws-flow-candidate{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);font-size:12px;}
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

      const caseInsensitivePaths =
        typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)

      function normalizeClientPath(value) {
        const raw = String(value ?? '').replace(/[\\/]+$/, '').replace(/\//g, '\\')
        return caseInsensitivePaths ? raw.toLowerCase() : raw
      }

      function findManagedByPath(path) {
        const needle = normalizeClientPath(path)
        const list = snapshot.data?.workspaces ?? []
        for (const workspace of list) {
          if (normalizeClientPath(workspace.path) === needle) return workspace
          if (typeof workspace.relocatedTo === 'string' && normalizeClientPath(workspace.relocatedTo) === needle) {
            return workspace
          }
        }
        return undefined
      }

      function openPanel(focusId, focusMode) {
        setSnapshot({ open: true, focusId: focusId ?? null, focusMode: focusMode ?? null })
        if (snapshot.data === null && snapshot.loading === false) refresh()
      }

      function closePanel() {
        setSnapshot({ open: false, focusId: null, focusMode: null })
      }

      refresh().catch(() => {})

      ctx.inject(['contextMenus'], (scope) => {
        scope.effect(
          () =>
            scope.contextMenus.register({
              id: 'managed-workspace.actions',
              target: 'workspace',
              order: 250,
              resolve: async ({ path }) => {
                if (snapshot.data === null && snapshot.loading === false) await refresh()
                const managed = findManagedByPath(path)
                if (managed === undefined) {
                  return [
                    {
                      id: 'managed-adopt',
                      label: translate('menu.adopt'),
                      separatorBefore: true,
                      run: () => {
                        mutate('adopt', { folder: path })
                      },
                    },
                  ]
                }
                const adopted = managed.origin === 'adopted'
                return [
                  {
                    id: 'managed-manage',
                    label: translate('menu.manage'),
                    separatorBefore: true,
                    run: () => openPanel(managed.id),
                  },
                  {
                    id: 'managed-attach',
                    label: translate('menu.attach'),
                    run: () => openPanel(managed.id, 'attach'),
                  },
                  {
                    id: 'managed-migrate',
                    label: translate('menu.migrate'),
                    run: () => openPanel(managed.id, 'migrate'),
                  },
                  {
                    id: 'managed-repair',
                    label: translate('menu.repair'),
                    run: () => {
                      mutate('repair', { id: managed.id })
                    },
                  },
                  {
                    id: 'managed-forget',
                    label: adopted ? translate('forgetAdopted') : translate('forget'),
                    danger: true,
                    run: () => {
                      const template = adopted ? translate('forgetAdoptedConfirm') : translate('forgetConfirm')
                      if (window.confirm(template.replace('{name}', managed.name))) {
                        mutate('forget', { id: managed.id })
                      }
                    },
                  },
                ]
              },
            }),
          'dsh-managed-workspaces: workspace context menu',
        )
      })

      function Overlay(props) {
        const t = props.t ?? translate
        const state = React.useSyncExternalStore(subscribe, getSnapshot)
        const dialogRef = React.useRef(null)
        React.useEffect(() => {
          if (!state.open) return undefined
          const onKey = (event) => {
            if (event.key === 'Escape') closePanel()
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
              if (event.target === event.currentTarget) closePanel()
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
                  onClick: () => closePanel(),
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
                ? h(Content, {
                    t,
                    data: state.data,
                    busy: state.busy,
                    focusId: state.focusId,
                    focusMode: state.focusMode,
                  })
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
              : data.workspaces.map((workspace) =>
                  h(WorkspaceCard, {
                    key: workspace.id,
                    t,
                    ws: workspace,
                    busy,
                    focus: props.focusId === workspace.id ? props.focusMode : undefined,
                  }),
                ),
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
        const focus = props.focus
        const [expanded, setExpanded] = React.useState(false)
        const [migrating, setMigrating] = React.useState(false)
        const cardRef = React.useRef(null)
        React.useEffect(() => {
          if (focus === undefined) return
          setExpanded(true)
          if (focus === 'migrate') setMigrating(true)
          if (cardRef.current !== null) {
            try {
              cardRef.current.scrollIntoView({ block: 'nearest' })
            } catch {
              // Scrolling is best effort.
            }
          }
        }, [focus])
        const statusKey =
          ws.directory !== 'ok'
            ? 'status.missing'
            : ws.registered
              ? 'status.registered'
              : 'status.unregistered'
        const tone = ws.directory !== 'ok' ? 'bad' : ws.registered ? 'ok' : 'warn'
        return h(
          'div',
          { className: 'dsh-mws-card', ref: cardRef },
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

      /**
       * Occupant of the sidebar "Add workspace" directory hole. It shadows the
       * official picker deterministically (lower `priority` wins a single slot)
       * and preserves the official path by delegating a chosen folder back to the
       * flow owner, which registers it and opens a session.
       */
      function ManagedDirectoryFlow(props) {
        const t = props.t ?? translate
        const open = props.open === true
        const busy = props.busy === true
        const state = React.useSyncExternalStore(subscribe, getSnapshot)
        const [name, setName] = React.useState('')
        const [showCreate, setShowCreate] = React.useState(false)
        const [working, setWorking] = React.useState(false)
        React.useEffect(() => {
          if (!open) {
            setShowCreate(false)
            setName('')
            return
          }
          if (snapshot.data === null && snapshot.loading === false) refresh()
        }, [open])
        if (!open) return null
        const disabled = busy || working
        const candidates = state.data?.candidates ?? []

        const createManaged = async () => {
          const value = name.trim()
          if (value === '' || disabled) return
          setWorking(true)
          try {
            const body = await call('create', { name: value })
            setName('')
            setShowCreate(false)
            props.onPicked(body.workspace.path)
          } catch (error) {
            props.onError(messageOf(error))
          } finally {
            setWorking(false)
          }
        }
        const pickExisting = async () => {
          if (disabled) return
          const picked = await pickFolder()
          if (picked !== null) props.onPicked(picked)
        }
        const adoptCandidate = async (candidate) => {
          if (disabled) return
          setWorking(true)
          try {
            await call('adopt', { folder: candidate.path })
            await refresh()
            props.onPicked(candidate.path)
          } catch (error) {
            props.onError(messageOf(error))
          } finally {
            setWorking(false)
          }
        }
        const manage = () => {
          openPanel(null, null)
          props.onCancel()
        }
        const option = (key, title, hint, onClick) =>
          h(
            'button',
            { key, type: 'button', className: 'dsh-mws-flow-option', disabled, onClick },
            h('span', { className: 'dsh-mws-flow-option-title' }, title),
            hint === '' ? null : h('span', { className: 'dsh-mws-flow-option-hint' }, hint),
          )

        return h(
          'div',
          {
            className: 'dsh-mws-flow-backdrop',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) props.onCancel()
            },
          },
          h(
            'div',
            {
              className: 'dsh-mws-flow-dialog',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': t('flow.title'),
            },
            h(
              'div',
              { className: 'dsh-mws-flow-head' },
              h(
                'div',
                { className: 'dsh-mws-grow' },
                h('div', { className: 'dsh-mws-title' }, t('flow.title')),
                h('div', { className: 'dsh-mws-subtitle' }, t('flow.subtitle')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-mws-close',
                  'aria-label': t('flow.cancel'),
                  onClick: () => props.onCancel(),
                },
                '×',
              ),
            ),
            option('create', t('flow.create'), t('flow.createHint'), () => setShowCreate(!showCreate)),
            showCreate
              ? h(
                  'div',
                  { className: 'dsh-mws-row' },
                  h('input', {
                    className: 'dsh-mws-input dsh-mws-grow',
                    value: name,
                    placeholder: t('flow.namePlaceholder'),
                    spellCheck: false,
                    onChange: (event) => setName(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') createManaged()
                    },
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-mws-btn dsh-mws-primary',
                      disabled: disabled || name.trim() === '',
                      onClick: createManaged,
                    },
                    t('create'),
                  ),
                )
              : null,
            option('pick', t('flow.pick'), t('flow.pickHint'), pickExisting),
            option('manage', t('flow.manage'), '', manage),
            h('div', { className: 'dsh-mws-label' }, t('flow.adopt')),
            h('div', { className: 'dsh-mws-hint' }, t('flow.adoptHint')),
            candidates.length === 0 ? h('div', { className: 'dsh-mws-hint' }, t('flow.none')) : null,
            candidates.map((candidate) =>
              h(
                'div',
                { key: candidate.path, className: 'dsh-mws-flow-candidate' },
                h(
                  'div',
                  { className: 'dsh-mws-card-text' },
                  h('div', { className: 'dsh-mws-card-name' }, candidate.title),
                  h('div', { className: 'dsh-mws-path', title: candidate.path }, candidate.path),
                ),
                h(
                  'button',
                  { type: 'button', className: 'dsh-mws-btn', disabled, onClick: () => adoptCandidate(candidate) },
                  t('adopt'),
                ),
              ),
            ),
            busy || working ? h('div', { className: 'dsh-mws-hint' }, t('flow.busy')) : null,
          ),
        )
      }

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

      // A single-slot hole resolves to the lowest `priority` occupant, so this
      // registration deterministically takes over the sidebar add-workspace flow.
      ctx.slots.inject('sidebar.workspaces.directoryFlow', () =>
        ctx.slots.register(
          {
            name: 'sidebar.workspaces.directoryFlow',
            id: 'dsh-managed-workspaces-flow',
            priority: -1,
            locale: NS,
          },
          ManagedDirectoryFlow,
        ),
      )

      return () => {
        listeners.clear()
      }
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
