import test from 'node:test'
import assert from 'node:assert/strict'

import { ManagedWorkspaceError } from '../store.js'
import { createManagedWorkspaceTool, validateToolArgs } from '../tool.js'

const RECORD = {
  id: 'w1',
  name: 'demo',
  path: 'D:\\demo',
  createdAt: '2026-01-01T00:00:00.000Z',
  origin: 'created',
  links: [],
}

function view(overrides = {}) {
  return {
    id: 'w1',
    name: 'demo',
    path: 'D:\\demo',
    relocatedTo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    origin: 'created',
    directory: 'ok',
    registered: true,
    workspaceId: 'w1',
    sessionCount: 0,
    links: [],
    ...overrides,
  }
}

function makeTool(store) {
  return createManagedWorkspaceTool({ get: () => undefined }, store)
}

function baseStore(overrides = {}) {
  return {
    manifest: { linksDirectoryName: '_roots' },
    async load() {},
    listSync: () => [RECORD],
    findWorkspaceForPath: () => null,
    ...overrides,
  }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ManagedWorkspaceError, `expected ManagedWorkspaceError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

test('validateToolArgs enforces the declared schema', () => {
  assert.deepEqual(validateToolArgs({ action: 'list' }), { action: 'list' })
  assert.deepEqual(validateToolArgs({ action: 'migrate', destination: 'D:\\x', mode: 'anchor' }), {
    action: 'migrate',
    destination: 'D:\\x',
    mode: 'anchor',
  })

  assert.throws(() => validateToolArgs(null), /must be a JSON object/)
  assert.throws(() => validateToolArgs({}), /"action" is required/)
  assert.throws(() => validateToolArgs({ action: 'explode' }), /unknown action/)
  assert.throws(() => validateToolArgs({ action: 'list', nope: true }), /unknown argument/)
  assert.throws(() => validateToolArgs({ action: 'create', name: 7 }), /must be a string/)
  assert.throws(() => validateToolArgs({ action: 'adopt', all: 'yes' }), /must be a boolean/)
  assert.throws(() => validateToolArgs({ action: 'migrate', mode: 'sideways' }), /unknown migration mode/)
})

test('the tool rejects malformed arguments before touching the store', async () => {
  const tool = makeTool(baseStore({
    async create() {
      throw new Error('store must not be reached')
    },
  }))
  await expectCode(tool.execute({ action: 'create', name: 7 }, {}), 'invalid-arguments')
  await expectCode(tool.execute({ action: 'nope' }, {}), 'invalid-action')
})

test('repair is exposed as a tool action and reports conflicts', async () => {
  const tool = makeTool(baseStore({
    async repair(id) {
      assert.equal(id, 'w1')
      return { repaired: ['anchor'], conflicts: ['link web: target folder is missing'], workspace: view({ links: [] }) }
    },
  }))
  const result = await tool.execute({ action: 'repair', workspace: 'w1' }, {})
  assert.match(result.summary, /Repaired: anchor\./)
  assert.match(result.summary, /Conflicts:/)
  assert.match(result.summary, /target folder is missing/)
})

test('repair reports a healthy workspace as needing nothing', async () => {
  const tool = makeTool(baseStore({
    async repair() {
      return { repaired: [], conflicts: [], workspace: view() }
    },
  }))
  const result = await tool.execute({ action: 'repair', workspace: 'w1' }, {})
  assert.match(result.summary, /Nothing needed repair\./)
  assert.doesNotMatch(result.summary, /Conflicts:/)
})

test('a migration summary surfaces sessions that could not be re-attached', async () => {
  const tool = makeTool(baseStore({
    async migrate(id, destination, options) {
      assert.equal(id, 'w1')
      assert.equal(destination, 'D:\\new')
      assert.deepEqual(options, { mode: undefined })
      return {
        mode: 'anchor',
        source: 'D:\\demo',
        destination: 'D:\\new',
        movedBy: 'rename',
        sessionCount: 2,
        attachedSessions: 1,
        attachErrors: ['session-b: its cwd does not resolve'],
        linkErrors: [],
        workspace: view({ relocatedTo: 'D:\\new', sessionCount: 2 }),
      }
    },
  }))
  const result = await tool.execute({ action: 'migrate', workspace: 'w1', destination: 'D:\\new' }, {})
  assert.match(result.summary, /only 1 of the 2 recorded session\(s\) could be re-attached/)
  assert.match(result.summary, /Session warnings:/)
  assert.match(result.summary, /session-b/)
})

test('a migration without attachment problems keeps the plain explanation', async () => {
  const tool = makeTool(baseStore({
    async migrate() {
      return {
        mode: 'anchor',
        source: 'D:\\demo',
        destination: 'D:\\new',
        movedBy: 'rename',
        sessionCount: 3,
        attachedSessions: 0,
        attachErrors: [],
        linkErrors: [],
        workspace: view({ relocatedTo: 'D:\\new', sessionCount: 3 }),
      }
    },
  }))
  const result = await tool.execute({ action: 'migrate', workspace: 'w1', destination: 'D:\\new' }, {})
  assert.match(result.summary, /the 3 recorded session\(s\) and their conversations keep working/)
  assert.doesNotMatch(result.summary, /Session warnings:/)
})

test('detach still requires an alias even though attach defaults it', async () => {
  const tool = makeTool(baseStore())
  await expectCode(tool.execute({ action: 'detach', workspace: 'w1' }, {}), 'invalid-alias')
})
