// dsh-managed-workspaces: Host half.
//
// Owns the workspace manifest, the workspace folders and their linked folders,
// the browser JSON routes, the `managed_workspace` tool, and the prompt context.
// The Web client half lives in client.js.

import { ManagedWorkspaceStore } from './store.js'
import { registerRoutes } from './routes.js'
import { createManagedWorkspaceTool } from './tool.js'
import { registerManagedWorkspaceContext } from './context.js'

export const name = 'dsh-managed-workspaces'

/** Mount every capability the host provides, each disposed with this plugin fiber. */
export function apply(ctx) {
  const warn = (message) => {
    try {
      ctx.logger?.warn?.(String(message))
    } catch {
      // Logging must never break the plugin.
    }
  }

  const store = new ManagedWorkspaceStore({ logger: warn })
  ctx.effect(() => () => store.dispose(), 'dsh-managed-workspaces: store')
  store.load().catch((error) => warn(`failed to load the managed workspace manifest: ${error?.message ?? error}`))

  ctx.inject(['webServer', 'connection'], (scope) => {
    scope.effect(() => registerRoutes(scope, store), 'dsh-managed-workspaces: routes')
  })

  ctx.inject(['workspaceRegistry'], (scope) => {
    store.setRegistry(scope.workspaceRegistry)
    scope.effect(() => () => store.setRegistry(null), 'dsh-managed-workspaces: registry')
  })

  ctx.inject(['tools'], (scope) => {
    scope.effect(
      () => scope.tools.register(createManagedWorkspaceTool(scope, store)),
      'dsh-managed-workspaces: tool',
    )
  })

  ctx.inject(['workingDirectory', 'systemPrompt'], (scope) => {
    scope.effect(
      () => registerManagedWorkspaceContext(scope, store),
      'dsh-managed-workspaces: context',
    )
  })
}
