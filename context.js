// dsh-managed-workspaces: prompt context for sessions inside a managed workspace.
//
// The working-directory context already states the current directory; this
// contribution explains the workspace root, the linked folders, and the two
// consequences the model cannot discover by itself: search and sandbox roots.

/**
 * Render the managed-workspace prompt section for one workspace.
 * @param {{name: string, path: string, links: Array<{alias: string, target: string}>}} workspace - workspace facts.
 * @param {string} linksDirectoryName - reserved links directory name.
 * @returns {string} the prompt text.
 */
export function renderContext(workspace, linksDirectoryName) {
  const links = workspace.links
  const lines = [
    `Managed workspace "${workspace.name}"`,
    `Root: "${workspace.path}"`,
  ]
  if (links.length === 0) {
    lines.push('Linked folders: none.')
  } else {
    lines.push(`Linked folders (each is a directory link at "<root>/${linksDirectoryName}/<alias>"):`)
    for (const link of links) {
      lines.push(`- "${link.alias}" -> "${link.target}"`)
    }
  }
  lines.push(
    'Path rules: relative paths resolve from Root. Work inside a linked folder through the path '
      + `"${linksDirectoryName}/<alias>/..." (or its absolute target path).`,
  )
  if (links.length > 0) {
    lines.push(
      'Searching: glob and grep read through an explicit path, so search a linked folder with '
        + `path "${linksDirectoryName}/<alias>"; a search rooted at Root may not descend into the links.`,
    )
    lines.push(
      'Sandbox: linked targets lie outside the session workspace root, so workspace-write denies writes there. '
        + 'Switch the session to danger-full-access when a task must modify linked folders.',
    )
  }
  return lines.join('\n')
}

/**
 * Register the system-prompt contribution for managed workspaces.
 * @param {object} ctx - plugin context providing `systemPrompt` and `workingDirectory`.
 * @param {import('./store.js').ManagedWorkspaceStore} store - state owner.
 * @returns {() => void} disposer.
 */
export function registerManagedWorkspaceContext(ctx, store) {
  const dispose = ctx.systemPrompt.context({
    name: 'workspace:managed',
    order: 300,
    interpolate: false,
    text: (context) => {
      const session = context.agent?.session
      if (session === undefined) return ''
      let directory
      try {
        directory = ctx.workingDirectory.get(session)
      } catch {
        directory = session.header.cwd
      }
      const found = store.findWorkspaceForPath(directory)
      if (found === null) return ''
      const linksDirectoryName = store.manifest?.linksDirectoryName ?? '_roots'
      return renderContext(
        {
          name: found.workspace.name,
          path: found.workspace.path,
          links: found.workspace.links.map((link) => ({ alias: link.alias, target: link.target })),
        },
        linksDirectoryName,
      )
    },
  })
  return typeof dispose === 'function' ? dispose : () => {}
}
