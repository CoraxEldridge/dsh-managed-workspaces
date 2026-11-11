import test from 'node:test'
import assert from 'node:assert/strict'

import { ManagedWorkspaceError } from '../store.js'
import { registerRoutes } from '../routes.js'

function fakeWebServer() {
  const routes = new Map()
  return {
    routes,
    register(route) {
      routes.set(route.path, route.handler)
      return () => routes.delete(route.path)
    },
  }
}

function fakeRequest({ method = 'POST', headers = {}, chunks = [] }) {
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    },
  }
}

function fakeResponse() {
  return {
    status: null,
    headers: null,
    body: '',
    writableEnded: false,
    destroyed: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(text) {
      this.body = text ?? ''
      this.writableEnded = true
    },
  }
}

const STATE = {
  baseDirectory: 'D:\\base',
  linksDirectoryName: '_roots',
  manifestPath: 'C:\\Users\\me\\.dsh\\managed-workspaces\\manifest.json',
  warnings: [],
  workspaces: [],
  candidates: [],
}

function fakeConnection(rejection) {
  return {
    calls: 0,
    requestRejection() {
      this.calls += 1
      return rejection
    },
  }
}

function makeStore(overrides = {}) {
  return {
    async state() {
      return STATE
    },
    async create() {
      return { workspace: { id: 'w1', name: 'demo' } }
    },
    ...overrides,
  }
}

async function call(webServer, name, { method = 'POST', guard = true, body = '{}', chunks } = {}) {
  const handler = webServer.routes.get(`/dsh-managed-workspaces/api/${name}`)
  assert.ok(handler, `route "${name}" is registered`)
  const request = fakeRequest({
    method,
    headers: guard ? { 'x-dsh-managed-workspaces': '1' } : {},
    chunks: chunks ?? (body === null ? [] : [body]),
  })
  const response = fakeResponse()
  await handler(request, response)
  return { response, payload: response.body === '' ? null : JSON.parse(response.body) }
}

test('routes answer state and create with a JSON envelope', async () => {
  const webServer = fakeWebServer()
  const dispose = registerRoutes({ webServer, connection: fakeConnection() }, makeStore())
  const state = await call(webServer, 'state')
  assert.equal(state.response.status, 200)
  assert.equal(state.payload.ok, true)
  assert.equal(state.payload.baseDirectory, 'D:\\base')

  const created = await call(webServer, 'create', { body: JSON.stringify({ name: 'demo' }) })
  assert.equal(created.response.status, 200)
  assert.equal(created.payload.workspace.name, 'demo')
  dispose()
  assert.equal(webServer.routes.size, 0)
})

test('routes reject a missing marker, a wrong method, and malformed JSON', async () => {
  const webServer = fakeWebServer()
  registerRoutes({ webServer, connection: fakeConnection() }, makeStore())

  const unmarked = await call(webServer, 'state', { guard: false })
  assert.equal(unmarked.response.status, 403)
  assert.equal(unmarked.payload.error.code, 'forbidden')

  const wrongMethod = await call(webServer, 'state', { method: 'GET' })
  assert.equal(wrongMethod.response.status, 405)
  assert.equal(wrongMethod.payload.error.code, 'method-not-allowed')

  const badJson = await call(webServer, 'state', { body: '{oops' })
  assert.equal(badJson.response.status, 400)
  assert.equal(badJson.payload.error.code, 'bad-json')

  const arrayBody = await call(webServer, 'state', { body: '[]' })
  assert.equal(arrayBody.response.status, 400)
  assert.equal(arrayBody.payload.error.code, 'bad-json')
})

test('an oversized body is drained and answered with 413', async () => {
  const webServer = fakeWebServer()
  let reached = false
  registerRoutes({ webServer, connection: fakeConnection() }, makeStore({
    async create() {
      reached = true
      return {}
    },
  }))
  const oversized = 'x'.repeat(70 * 1024)
  const result = await call(webServer, 'create', {
    chunks: [oversized, 'trailing-chunk'],
  })
  assert.equal(reached, false)
  assert.equal(result.response.status, 413)
  assert.equal(result.response.headers.connection, 'close')
  assert.equal(result.payload.error.code, 'body-too-large')
})

test('store errors keep their code in the envelope', async () => {
  const webServer = fakeWebServer()
  registerRoutes({ webServer, connection: fakeConnection() }, makeStore({
    async create() {
      throw new ManagedWorkspaceError('exists', 'workspace folder already exists: D:\\base\\demo')
    },
  }))
  const result = await call(webServer, 'create', { body: JSON.stringify({ name: 'demo' }) })
  assert.equal(result.response.status, 200)
  assert.equal(result.payload.ok, false)
  assert.equal(result.payload.error.code, 'exists')
  assert.match(result.payload.error.message, /already exists/)
})

test('the connection fence answers before the marker header and never reaches the store', async () => {
  const webServer = fakeWebServer()
  const connection = fakeConnection(401)
  let reached = false
  registerRoutes({ webServer, connection }, makeStore({
    async state() {
      reached = true
      return STATE
    },
  }))
  // No marker header: a hostile same-origin page would attach it, which is
  // exactly why the fence has to run first.
  const unauthorized = await call(webServer, 'state', { guard: false })
  assert.equal(unauthorized.response.status, 401)
  assert.equal(unauthorized.payload.error.code, 'unauthorized')
  assert.equal(reached, false)

  const forbidden = await (async () => {
    const server = fakeWebServer()
    registerRoutes({ webServer: server, connection: fakeConnection(403) }, makeStore())
    return call(server, 'state')
  })()
  assert.equal(forbidden.response.status, 403)
  assert.equal(forbidden.payload.error.code, 'forbidden')

  assert.ok(connection.calls >= 1)
})

test('routes refuse to mount when the connection fence is unavailable', () => {
  assert.throws(
    () => registerRoutes({ webServer: fakeWebServer() }, makeStore()),
    (error) => error.code === 'fence-unavailable' && /connection/.test(error.message),
  )
  assert.throws(
    () => registerRoutes({ webServer: fakeWebServer(), connection: {} }, makeStore()),
    (error) => error.code === 'fence-unavailable',
  )
})
