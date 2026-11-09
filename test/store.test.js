import test from 'node:test'
import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ManagedWorkspaceError,
  ManagedWorkspaceStore,
  defaultAlias,
  isUnder,
  uniqueAlias,
  validateSegment,
} from '../store.js'

async function makeStore(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-mws-'))
  t.after(async () => {
    await rm(root, { recursive: true, force: true })
  })
  const store = new ManagedWorkspaceStore({
    home: join(root, 'home'),
    now: () => '2026-01-01T00:00:00.000Z',
  })
  await store.load()
  await store.setBaseDirectory(join(root, 'base'))
  return { root, store }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ManagedWorkspaceError, `expected ManagedWorkspaceError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

/** Minimal in-memory stand-in for the host workspace registry. */
function fakeRegistry(rows = []) {
  const list = rows.map((row, index) => ({
    id: row.id ?? `w-${index}`,
    path: row.path,
    title: row.title ?? 'workspace',
  }))
  return {
    rows: list,
    list: () => list,
    async create(path, title) {
      const found = list.find((row) => row.path.toLowerCase() === path.toLowerCase())
      if (found !== undefined) return found
      const row = { id: `w-${list.length}`, path, title: title ?? 'workspace' }
      list.push(row)
      return row
    },
    async delete(id) {
      const index = list.findIndex((row) => row.id === id)
      if (index >= 0) list.splice(index, 1)
    },
  }
}

test('validateSegment accepts ordinary and CJK names and rejects unsafe segments', () => {
  assert.equal(validateSegment('demo'), 'demo')
  assert.equal(validateSegment('项目 A'), '项目 A')
  assert.throws(() => validateSegment('a/b'), /not allowed/)
  assert.throws(() => validateSegment('a\\b'), /not allowed/)
  assert.throws(() => validateSegment('CON'), /reserved/)
  assert.throws(() => validateSegment('name.'), /dot or a space/)
  assert.throws(() => validateSegment('   '), /blank/)
  assert.throws(() => validateSegment('..'), /"\." or "\.\."/)
})

test('alias helpers derive and dedupe segments', () => {
  assert.equal(defaultAlias('D:\\repos\\web'), 'web')
  assert.equal(defaultAlias('/home/me/web'), 'web')
  assert.equal(uniqueAlias([], 'web'), 'web')
  assert.equal(uniqueAlias(['web'], 'web'), 'web-2')
  assert.equal(uniqueAlias(['web', 'web-2'], 'web'), 'web-3')
})

test('isUnder compares host paths case-insensitively on Windows', () => {
  const sep = process.platform === 'win32' ? '\\' : '/'
  const base = `${sep}tmp${sep}base`
  assert.equal(isUnder(`${base}${sep}child`, base), true)
  assert.equal(isUnder(base, base), true)
  assert.equal(isUnder(`${base}-other`, base), false)
})

test('create makes the workspace folder with _roots and persists it', async (t) => {
  const { root, store } = await makeStore(t)
  const result = await store.create('demo')
  assert.equal(result.workspace.name, 'demo')
  assert.equal(result.workspace.directory, 'ok')
  assert.equal(result.registered, false)
  assert.equal(result.workspace.links.length, 0)

  const entries = await readdir(result.workspace.path)
  assert.deepEqual(entries, ['_roots'])

  const manifest = JSON.parse(await readFile(join(root, 'home', 'managed-workspaces', 'manifest.json'), 'utf8'))
  assert.equal(manifest.workspaces.length, 1)
  assert.equal(manifest.workspaces[0].path, result.workspace.path)

  const state = await store.state()
  assert.equal(state.workspaces.length, 1)
  assert.equal(state.baseDirectory, join(root, 'base'))
})

test('create rejects an existing folder and invalid names', async (t) => {
  const { store } = await makeStore(t)
  await store.create('demo')
  await expectCode(store.create('demo'), 'exists')
  await expectCode(store.create('a/b'), 'invalid-name')
})

test('attach creates a link, is idempotent, and detach removes only the link', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const workspaceId = created.workspace.id
  const target = join(root, 'repo-web')
  await mkdir(target)
  await writeFile(join(target, 'index.js'), 'export {}\n')

  const attached = await store.attach(workspaceId, target)
  assert.equal(attached.created, true)
  assert.equal(attached.link.alias, 'repo-web')
  assert.equal(attached.link.health, 'ok')

  const linkPath = join(created.workspace.path, '_roots', 'repo-web')
  const node = await lstat(linkPath)
  assert.equal(node.isSymbolicLink(), true)
  assert.equal((await realpath(linkPath)).toLowerCase(), (await realpath(target)).toLowerCase())

  const again = await store.attach(workspaceId, target)
  assert.equal(again.created, false)
  assert.equal(again.link.alias, 'repo-web')

  const state = await store.state()
  assert.equal(state.workspaces[0].links.length, 1)
  assert.equal(state.workspaces[0].links[0].health, 'ok')

  await store.detach(workspaceId, 'repo-web')
  await assert.rejects(lstat(linkPath), /ENOENT/)
  assert.equal(await readFile(join(target, 'index.js'), 'utf8'), 'export {}\n')

  const after = await store.state()
  assert.equal(after.workspaces[0].links.length, 0)
})

test('attach refuses workspace-internal folders and occupied link paths', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const workspaceId = created.workspace.id

  const inside = join(created.workspace.path, 'inner')
  await mkdir(inside)
  await expectCode(store.attach(workspaceId, inside), 'invalid-link')

  const target = join(root, 'occupied')
  await mkdir(target)
  await mkdir(join(created.workspace.path, '_roots', 'occupied'))
  await expectCode(store.attach(workspaceId, target), 'conflict')
})

test('detach refuses to remove a real directory at the link path', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const workspaceId = created.workspace.id
  const target = join(root, 'web')
  await mkdir(target)
  await store.attach(workspaceId, target)

  const linkPath = join(created.workspace.path, '_roots', 'web')
  await rm(linkPath)
  await mkdir(linkPath)

  await expectCode(store.detach(workspaceId, 'web'), 'conflict')
})

test('aliases dedupe when two targets share a basename', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const workspaceId = created.workspace.id
  const first = join(root, 'a', 'web')
  const second = join(root, 'b', 'web')
  await mkdir(first, { recursive: true })
  await mkdir(second, { recursive: true })

  const one = await store.attach(workspaceId, first)
  const two = await store.attach(workspaceId, second)
  assert.equal(one.link.alias, 'web')
  assert.equal(two.link.alias, 'web-2')
})

test('repair recreates _roots and missing links', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const workspaceId = created.workspace.id
  const target = join(root, 'repo')
  await mkdir(target)
  await store.attach(workspaceId, target)

  await rm(join(created.workspace.path, '_roots'), { recursive: true, force: true })
  const repaired = await store.repair(workspaceId)
  assert.equal(repaired.conflicts.length, 0)
  assert.ok(repaired.repaired.length >= 2)
  assert.equal((await lstat(join(created.workspace.path, '_roots', 'repo'))).isSymbolicLink(), true)
})

test('findWorkspaceForPath resolves the home and linked target prefixes', async (t) => {
  const { root, store } = await makeStore(t)
  const created = await store.create('demo')
  const target = join(root, 'repo')
  await mkdir(target)
  await store.attach(created.workspace.id, target)

  assert.equal(store.findWorkspaceForPath(join(created.workspace.path, 'sub', 'file.txt')).via, 'home')
  const viaLink = store.findWorkspaceForPath(join(target, 'src', 'a.js'))
  assert.equal(viaLink.via, 'link')
  assert.equal(viaLink.alias, 'repo')
  assert.equal(store.findWorkspaceForPath(join(root, 'elsewhere')), null)
})

test('a corrupt manifest is quarantined and reported as a warning', async (t) => {
  const { root } = await makeStore(t)
  const manifestPath = join(root, 'home', 'managed-workspaces', 'manifest.json')
  await mkdir(join(root, 'home', 'managed-workspaces'), { recursive: true })
  await writeFile(manifestPath, '{ not json')

  const store = new ManagedWorkspaceStore({ home: join(root, 'home') })
  await store.load()
  const state = await store.state()
  assert.deepEqual(state.workspaces, [])
  assert.ok(state.warnings.some((warning) => warning.includes('unreadable')))

  const files = await readdir(join(root, 'home', 'managed-workspaces'))
  assert.equal(files.length, 1)
  assert.match(files[0], /manifest\.json\.corrupt-/)
})

test('the configured base directory survives a reload', async (t) => {
  const { root, store } = await makeStore(t)
  await store.create('demo')
  const reloaded = new ManagedWorkspaceStore({ home: join(root, 'home') })
  await reloaded.load()
  const state = await reloaded.state()
  assert.equal(state.baseDirectory, join(root, 'base'))
  assert.equal(state.workspaces.length, 1)
})

test('candidates lists registered workspaces that are not managed yet', async (t) => {
  const { root, store } = await makeStore(t)
  const existing = join(root, 'existing')
  await mkdir(existing)
  store.setRegistry(fakeRegistry([{ path: existing, title: '现有项目' }]))

  const state = await store.state()
  assert.deepEqual(state.workspaces, [])
  assert.equal(state.candidates.length, 1)
  assert.equal(state.candidates[0].title, '现有项目')
  assert.equal(state.candidates[0].path, await realpath(existing))
})

test('adopt registers an existing folder and leaves it untouched', async (t) => {
  const { root, store } = await makeStore(t)
  const existing = join(root, 'existing')
  await mkdir(existing)
  await writeFile(join(existing, 'README.md'), 'x')
  store.setRegistry(fakeRegistry([{ path: existing, title: '现有项目' }]))

  const result = await store.adopt(existing)
  assert.equal(result.adopted, true)
  assert.equal(result.workspace.origin, 'adopted')
  assert.equal(result.workspace.registered, true)
  assert.equal(result.workspace.name, '现有项目')
  assert.deepEqual(await readdir(existing), ['README.md'])

  const again = await store.adopt(existing)
  assert.equal(again.adopted, false)

  const target = join(root, 'linked')
  await mkdir(target)
  await store.attach(result.workspace.id, target)
  assert.ok((await readdir(existing)).includes('_roots'))
})

test('adoptAll adopts every candidate and skips managed ones', async (t) => {
  const { root, store } = await makeStore(t)
  const first = join(root, 'a')
  const second = join(root, 'b')
  await mkdir(first)
  await mkdir(second)
  store.setRegistry(fakeRegistry([
    { path: first, title: 'A' },
    { path: second, title: 'B' },
  ]))
  await store.adopt(first)

  const result = await store.adoptAll()
  assert.deepEqual(result.adopted, ['B'])
  assert.deepEqual(result.skipped, [])
  assert.deepEqual(result.failed, [])

  const state = await store.state()
  assert.equal(state.workspaces.length, 2)
  assert.equal(state.candidates.length, 0)
})

test('adopted display names dedupe when two folders share a basename', async (t) => {
  const { root, store } = await makeStore(t)
  const first = join(root, 'a', 'web')
  const second = join(root, 'b', 'web')
  await mkdir(first, { recursive: true })
  await mkdir(second, { recursive: true })
  store.setRegistry(fakeRegistry([
    { path: first, title: 'web' },
    { path: second, title: 'web' },
  ]))

  const one = await store.adopt(first)
  const two = await store.adopt(second)
  assert.equal(one.workspace.name, 'web')
  assert.equal(two.workspace.name, 'web (2)')
})

test('forget keeps an adopted registration but drops a created one', async (t) => {
  const { root, store } = await makeStore(t)
  const registry = fakeRegistry([])
  store.setRegistry(registry)
  const created = await store.create('demo')
  const adoptedPath = join(root, 'existing')
  await mkdir(adoptedPath)
  const adopted = await store.adopt(adoptedPath)

  const createdForget = await store.forget(created.workspace.id)
  assert.equal(createdForget.unregistered, true)
  assert.equal(createdForget.keptRegistration, false)

  const adoptedForget = await store.forget(adopted.workspace.id)
  assert.equal(adoptedForget.unregistered, false)
  assert.equal(adoptedForget.keptRegistration, true)
  assert.ok(registry.rows.some((row) => row.path.toLowerCase() === adoptedPath.toLowerCase()))
  assert.ok(!registry.rows.some((row) => row.path.toLowerCase() === created.workspace.path.toLowerCase()))
})

test('repair refuses to recreate a missing adopted workspace folder', async (t) => {
  const { root, store } = await makeStore(t)
  const existing = join(root, 'existing')
  await mkdir(existing)
  store.setRegistry(fakeRegistry([{ path: existing, title: 'X' }]))
  const adopted = await store.adopt(existing)
  await rm(existing, { recursive: true, force: true })

  await expectCode(store.repair(adopted.workspace.id), 'missing')
  await assert.rejects(lstat(existing), /ENOENT/)
})
