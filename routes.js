// dsh-managed-workspaces: HTTP routes for the browser half.
//
// The host plugin owns the operations; these routes are a thin JSON transport
// for the Web GUI. They are registered on the harness web server and removed
// with the plugin fiber.

import { ManagedWorkspaceError, errorMessage } from './store.js'

const API_PREFIX = '/dsh-managed-workspaces/api/'
const GUARD_HEADER = 'x-dsh-managed-workspaces'
const MAX_BODY_BYTES = 64 * 1024

/**
 * Route admission has two generations, and the plugin supports both.
 *
 * Before DSH 0.3 the WebServer dispatched every registered route without
 * authenticating it, so the plugin asked `connection.requestRejection` for the
 * Host/Origin fence and the browser credential itself. DSH 0.3 moved admission
 * into the WebServer: a route declares `auth`, the request is authenticated
 * before dispatch, and the handler receives the admitted `Peer`. Connection
 * dropped `requestRejection` in the same change, which is why the panel went
 * blank on the newer host — the plugin refused to mount any route.
 *
 * `admissionOf` therefore returns a per-request guard that works on both:
 *  - legacy host: ask Connection, which returns 401/403 or undefined;
 *  - current host: require the owner Peer the WebServer already admitted.
 * Anything else fails closed, so no route ever runs unfenced.
 */
function connectionOf(ctx) {
  try {
    if (typeof ctx?.get === 'function') {
      const service = ctx.get('connection')
      if (service !== undefined && service !== null) return service
    }
  } catch {
    // An unavailable optional service is not an error here.
  }
  try {
    return ctx?.connection ?? undefined
  } catch {
    return undefined
  }
}

function admissionOf(ctx) {
  const connection = connectionOf(ctx)
  if (connection !== undefined && typeof connection.requestRejection === 'function') {
    return {
      generation: 'legacy',
      // Fail closed when the fence itself throws: an exception here must not
      // become an open route.
      guard: (request) => {
        try {
          return connection.requestRejection(request)
        } catch {
          return 403
        }
      },
    }
  }
  return {
    generation: 'peer',
    guard: (_request, peer) => (peer?.principal?.kind === 'owner' ? undefined : 403),
  }
}

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

function sendJson(response, status, payload, extraHeaders) {
  if (response.writableEnded || response.destroyed) return
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(extraHeaders ?? {}),
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  let total = 0
  let tooLarge = false
  for await (const chunk of request) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      // Keep draining without buffering: throwing mid-stream destroys the
      // request socket and the client would never see the 413 response.
      tooLarge = true
      chunks.length = 0
      continue
    }
    if (!tooLarge) chunks.push(chunk)
  }
  if (tooLarge) {
    throw new ManagedWorkspaceError('body-too-large', `request body exceeds ${MAX_BODY_BYTES} bytes`)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function routeHandler(operation, admission) {
  return async (request, response, peer) => {
    try {
      const rejection = admission.guard(request, peer)
      if (rejection !== undefined) {
        sendJson(response, rejection, {
          ok: false,
          error: {
            code: rejection === 401 ? 'unauthorized' : rejection === 503 ? 'unavailable' : 'forbidden',
            message: 'request was not admitted by the harness',
          },
        })
        return
      }
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
      const tooLarge = error instanceof ManagedWorkspaceError && error.code === 'body-too-large'
      const status = tooLarge ? 413 : 200
      sendJson(
        response,
        status,
        { ok: false, error: errorPayload(error) },
        tooLarge ? { connection: 'close' } : undefined,
      )
    }
  }
}

/**
 * Register every plugin route on the hosting web server.
 * @param {object} ctx - plugin context providing `webServer`, and `connection` on hosts that still fence routes explicitly.
 * @param {import('./store.js').ManagedWorkspaceStore} store - state owner.
 * @returns {() => void} disposer removing every route.
 */
export function registerRoutes(ctx, store) {
  const webServer = ctx.webServer
  const admission = admissionOf(ctx)
  const disposers = []
  const route = (name, operation) => {
    disposers.push(
      webServer.register({
        kind: 'exact',
        path: API_PREFIX + name,
        // Current hosts authenticate before dispatch; older hosts ignore the
        // field and are guarded per request by the legacy fence instead.
        auth: 'required',
        handler: routeHandler(operation, admission),
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
