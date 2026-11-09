// dsh-managed-workspaces: the model-facing tool.
//
// The tool calls exactly the store methods the Web UI calls through HTTP, so an
// operation has one implementation and two callers.

import { ManagedWorkspaceError } from './store.js'

const ACTIONS = ['status', 'list', 'create', 'adopt', 'attach', 'detach', 'migrate', 'register', 'forget']

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: ACTIONS,
      description: 'status reads the current session workspace; list reads every managed workspace and the existing workspaces that are not managed yet; create makes a new workspace folder; adopt registers an existing folder (or every existing sidebar workspace) without moving it; attach/detach add or remove one linked folder; migrate moves the workspace directory while keeping its conversations usable; register re-registers a workspace in the sidebar; forget removes the plugin record without deleting any folder.',
    },
    name: {
      type: 'string',
      description: 'Folder name for action=create, created under the configured base directory.',
    },
    folder: {
      type: 'string',
      description: 'Absolute path of an existing folder: the folder to link for action=attach, or the existing workspace to adopt for action=adopt.',
    },
    all: {
      type: 'boolean',
      description: 'For action=adopt: adopt every sidebar workspace this plugin does not manage yet.',
    },
    destination: {
      type: 'string',
      description: 'Absolute destination path for action=migrate. It must not exist yet; the workspace directory is moved there.',
    },
    mode: {
      type: 'string',
      enum: ['auto', 'anchor', 'clean'],
      description: 'For action=migrate: auto keeps the original path as a link when the workspace still has sessions (required for conversations to keep working) and re-registers a session-less workspace at the new path; anchor always keeps the original path as a link; clean refuses a workspace that still has sessions.',
    },
    alias: {
      type: 'string',
      description: 'Link name under the workspace _roots directory. Defaults to the folder name; ignored for detach when omitted.',
    },
    workspace: {
      type: 'string',
      description: 'Managed workspace id or name. Omit to use the workspace containing the current session directory.',
    },
  },
  required: ['action'],
}

const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Human-readable result of the action.' },
  },
  required: ['summary'],
}

function statusLabel(view) {
  const registration = view.registered ? 'registered' : 'not registered'
  const directory = view.directory === 'ok' ? 'folder ok' : 'folder missing'
  const origin = view.origin === 'adopted' ? 'adopted' : 'created by DSH'
  return `${origin}, ${registration}, ${directory}`
}

function linkLines(view) {
  if (view.links.length === 0) return ['  (no linked folders)']
  return view.links.map((link) => `  - ${link.alias} -> ${link.target} [${link.health}]`)
}

function workspaceBlock(view) {
  const lines = [`Workspace "${view.name}" at ${view.path} [${statusLabel(view)}]`]
  if (view.relocatedTo !== null && view.relocatedTo !== undefined) {
    lines.push(`Content location: ${view.relocatedTo} (the original path is kept as a link so recorded sessions stay usable)`)
  }
  lines.push(`Sessions: ${view.sessionCount ?? 0}`)
  lines.push('Linked folders:', ...linkLines(view))
  return lines.join('\n')
}

function listBlock(state) {
  const candidates = Array.isArray(state.candidates) ? state.candidates : []
  const sections = []
  if (state.workspaces.length === 0) {
    sections.push(`No managed workspaces yet. Base directory: ${state.baseDirectory}`)
  } else {
    sections.push(`Base directory: ${state.baseDirectory}`, ...state.workspaces.map(workspaceBlock))
  }
  if (candidates.length > 0) {
    sections.push(
      'Existing sidebar workspaces that this plugin does not manage yet (adopt them with action=adopt, all=true, or action=adopt with "folder"):',
      ...candidates.map((candidate) => `  - ${candidate.title} (${candidate.path})`),
    )
  }
  return sections.join('\n\n')
}

/**
 * Build the `managed_workspace` tool definition.
 * @param {object} ctx - plugin context used to read the calling session.
 * @param {import('./store.js').ManagedWorkspaceStore} store - state owner.
 * @returns {object} registry-ready tool definition.
 */
export function createManagedWorkspaceTool(ctx, store) {
  function currentCwd(exec) {
    const session = exec.agent?.session
    if (session === undefined) return undefined
    try {
      return ctx.get('workingDirectory')?.get(session) ?? session.header.cwd
    } catch {
      return session.header.cwd
    }
  }

  function resolveTarget(args, exec) {
    const records = store.listSync()
    const requested = typeof args.workspace === 'string' ? args.workspace.trim() : ''
    if (requested.length > 0) {
      const match =
        records.find((record) => record.id === requested) ??
        records.find((record) => record.name.toLowerCase() === requested.toLowerCase())
      if (match === undefined) {
        throw new ManagedWorkspaceError(
          'not-found',
          `unknown managed workspace "${requested}"; available: ${records.map((record) => record.name).join(', ') || '(none)'}`,
        )
      }
      return match
    }
    const cwd = currentCwd(exec)
    const found = cwd === undefined ? null : store.findWorkspaceForPath(cwd)
    if (found !== null) return found.workspace
    throw new ManagedWorkspaceError(
      'workspace-required',
      records.length === 0
        ? 'no managed workspace exists yet; create one with action=create'
        : `the current directory is not inside a managed workspace; name one with "workspace" (available: ${records.map((record) => record.name).join(', ')})`,
    )
  }

  return {
    name: 'managed_workspace',
    description: [
      'Manage DSH workspaces: folders the harness creates under a configured base directory, each of which can own several linked folders, plus existing folders adopted into the same management.',
      'A linked folder appears inside the workspace as _roots/<alias> and its absolute path stays valid.',
      'status reports the workspace of the current session; list reports managed workspaces and the existing sidebar workspaces that are not managed yet; create makes a workspace folder and registers it in the sidebar; adopt registers an existing folder (or every existing sidebar workspace with all=true) without moving or creating anything; attach/detach add or remove a linked folder; register restores a sidebar registration; forget removes only the plugin record and never deletes files.',
    ].join(' '),
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT,
      render(_args, value) {
        return [{ type: 'text', text: String(value.summary) }]
      },
    },
    async execute(args, exec) {
      const action = args.action
      if (!ACTIONS.includes(action)) {
        throw new ManagedWorkspaceError('invalid-action', `unknown action: ${JSON.stringify(action)}`)
      }
      await store.load()

      if (action === 'list') {
        const state = await store.state()
        return { summary: listBlock(state) }
      }

      if (action === 'status') {
        const cwd = currentCwd(exec)
        const found = cwd === undefined ? null : store.findWorkspaceForPath(cwd)
        if (found === null) {
          const state = await store.state()
          return {
            summary: `The current directory (${cwd ?? 'unknown'}) is not inside a managed workspace.\n\n${listBlock(state)}`,
          }
        }
        const view = await store.view(found.workspace)
        const route = found.via === 'link' ? `through linked folder "${found.alias}"` : 'through the workspace root'
        return { summary: `${workspaceBlock(view)}\nCurrent directory resolves to this workspace ${route}.` }
      }

      if (action === 'create') {
        const result = await store.create(args.name)
        const warning = result.warning === undefined ? '' : `\nWarning: ${result.warning}`
        return {
          summary: `Created ${workspaceBlock(result.workspace)}${warning}\nStart a session from this workspace in the sidebar to work in it.`,
        }
      }

      if (action === 'adopt') {
        if (args.all === true) {
          const result = await store.adoptAll()
          const lines = []
          lines.push(
            result.adopted.length === 0
              ? 'No existing workspace needed adoption.'
              : `Adopted ${result.adopted.length} workspace(s): ${result.adopted.join(', ')}.`,
          )
          if (result.skipped.length > 0) lines.push(`Already managed: ${result.skipped.join(', ')}.`)
          if (result.failed.length > 0) lines.push(`Failed:\n${result.failed.map((entry) => `  - ${entry}`).join('\n')}`)
          lines.push('Adoption created no folders and moved nothing; links can be added with action=attach.')
          return { summary: lines.join('\n') }
        }
        if (typeof args.folder !== 'string' || args.folder.trim().length === 0) {
          throw new ManagedWorkspaceError('invalid-target', 'action=adopt requires "folder", or "all": true')
        }
        const result = await store.adopt(args.folder)
        const headline = result.adopted
          ? `Adopted the existing folder as a managed workspace without moving or creating anything inside it.`
          : 'This folder is already managed.'
        const warning = result.warning === undefined ? '' : `\nWarning: ${result.warning}`
        return { summary: `${headline}\n${workspaceBlock(result.workspace)}${warning}` }
      }

      if (action === 'migrate') {
        const record = resolveTarget(args, exec)
        if (typeof args.destination !== 'string' || args.destination.trim().length === 0) {
          throw new ManagedWorkspaceError('invalid-target', 'action=migrate requires "destination"')
        }
        const result = await store.migrate(record.id, args.destination, { mode: args.mode })
        const explanation =
          result.mode === 'anchor'
            ? `The original path is kept as a directory link to the new location, so the ${result.sessionCount} recorded session(s) and their conversations keep working.`
            : 'The workspace had no sessions, so it was re-registered at the new path with no link left behind.'
        const linkNote =
          result.linkErrors.length === 0 ? '' : `\nLink warnings: ${result.linkErrors.join('; ')}`
        return {
          summary: `Moved the workspace content from ${result.source} to ${result.destination} (${result.movedBy}).\n${explanation}${linkNote}\n${workspaceBlock(result.workspace)}`,
        }
      }

      if (action === 'register') {
        const record = resolveTarget(args, exec)
        const result = await store.register(record.id)
        return { summary: `Re-registered the workspace.\n${workspaceBlock(result.workspace)}` }
      }

      if (action === 'forget') {
        const record = resolveTarget(args, exec)
        const result = await store.forget(record.id)
        const registration = result.keptRegistration
          ? ' Its sidebar registration was kept because the folder existed before the plugin.'
          : result.unregistered
            ? ' Its sidebar registration was removed.'
            : ''
        return {
          summary: `Removed workspace "${result.removed}" from the plugin record${registration} Files were not deleted: ${result.path}`,
        }
      }

      if (action === 'attach') {
        const record = resolveTarget(args, exec)
        if (typeof args.folder !== 'string' || args.folder.trim().length === 0) {
          throw new ManagedWorkspaceError('invalid-target', 'action=attach requires "folder"')
        }
        const result = await store.attach(record.id, args.folder, args.alias)
        const outcome = result.created ? 'Linked' : 'Already linked'
        return {
          summary: `${outcome} ${result.link.target} as _roots/${result.link.alias} [${result.link.health}].\n${workspaceBlock(result.workspace)}`,
        }
      }

      if (action === 'detach') {
        const record = resolveTarget(args, exec)
        if (typeof args.alias !== 'string' || args.alias.trim().length === 0) {
          throw new ManagedWorkspaceError('invalid-alias', 'action=detach requires "alias"')
        }
        const result = await store.detach(record.id, args.alias)
        return {
          summary: `Removed the link "${result.removed}" from the workspace. The linked folder itself was not touched.\n${workspaceBlock(result.workspace)}`,
        }
      }

      throw new ManagedWorkspaceError('invalid-action', `action ${JSON.stringify(action)} is not executable`)
    },
  }
}
