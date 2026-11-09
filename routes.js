// dsh-managed-workspaces: HTTP routes for the browser half.
//
// The host plugin owns the operations; these routes are a thin JSON transport
// for the Web GUI. They are registered on the harness web server and removed
// with the plugin fiber.

import { ManagedWorkspaceError, errorMessage } from './store.js'

const API_PREFIX = '/dsh-managed-workspaces/api/'
const GUARD_HEADER = 'x-dsh-managed-workspaces'
const MAX_BODY_BYTES = 64 * 1024

function errorPayload(error) {
  if (error instanceof ManagedWorkspaceError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    }
  }
  return { code: 'internal', message: errorMessage(error) }
}

function sendJson(response, status, payload) {
  if (response.writableEnded || response.destroyed) return
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      throw new ManagedWorkspaceError('body-too-large', `request body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function routeHandler(operation) {
  return async (request, response) => {
    try {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: { code: 'method-not-allowed', message: 'POST required' } })
        return
      }
      if (request.headers[GUARD_HEADER] !== '1') {
        sendJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'missing request marker header' } })
        return
      }
      const body = await readBody(request)
      let args = {}
      if (body.trim().length > 0) {
        try {
          args = JSON.parse(body)
        } catch {
          sendJson(response, 400, { ok: false, error: { code: 'bad-json', message: 'request body is not JSON' } })
          return
        }
      }
      if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        sendJson(response, 400, { ok: false, error: { code: 'bad-json', message: 'request body must be a JSON object' } })
        return
      }
      const result = await operation(args, request)
      sendJson(response, 200, { ok: true, ...(result ?? {}) })
    } catch (error) {
      const status = error instanceof ManagedWorkspaceError && error.code === 'body-too-large' ? 413 : 200
      sendJson(response, status, { ok: false, error: errorPayload(error) })
    }
  }
}

/**
 * Register every plugin route on the hosting web server.
 * @param {object} ctx - plugin context providing `webServer`.
 * @param {import('./store.js').ManagedWorkspaceStore} store - state owner.
 * @returns {() => void} disposer removing every route.
 */
export function registerRoutes(ctx, store) {
  const webServer = ctx.webServer
  const disposers = []
  const route = (name, operation) => {
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: API_PREFIX + name,
        handler: routeHandler(operation),
      }),
    )
  }

  route('state', async () => store.state())
  route('config', async (args) => store.setBaseDirectory(args.baseDirectory))
  route('create', async (args) => store.create(args.name))
  route('adopt', async (args) => (args.all === true ? store.adoptAll() : store.adopt(args.folder)))
  route('migrate', async (args) => store.migrate(args.id, args.destination, { mode: args.mode }))
  route('attach', async (args) => store.attach(args.id, args.folder, args.alias))
  route('detach', async (args) => store.detach(args.id, args.alias))
  route('register', async (args) => store.register(args.id))
  route('forget', async (args) => store.forget(args.id))
  route('repair', async (args) => store.repair(args.id))

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // A route already removed by a reload must not block the rest.
      }
    }
  }
}
