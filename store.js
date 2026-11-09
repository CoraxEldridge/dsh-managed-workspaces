// dsh-managed-workspaces: state + filesystem core.
//
// A managed workspace is a directory DSH creates under a configurable base
// directory. It is registered in the harness workspace registry (the registry
// itself lives in the host plugin), and additional folders are associated with
// it as directory links under `<workspace>/_roots/<alias>`.
//
// This module has no framework imports: it is usable from the host plugin and
// from `node --test` directly.

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readlink, realpath, rename, stat, symlink, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, basename, parse, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const IS_WIN = process.platform === 'win32'
const execFileAsync = promisify(execFile)
const MANIFEST_VERSION = 1
const LINKS_DIRECTORY = '_roots'
const MAX_SEGMENT = 64
const RESERVED_SEGMENTS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const INVALID_SEGMENT_CHARS = /[<>:"/\\|?*\u0000-\u001f]/

/** An error carrying a stable code that routes and tools can report. */
export class ManagedWorkspaceError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'ManagedWorkspaceError'
    this.code = code
    if (details !== undefined) this.details = details
  }
}

function fail(code, message, details) {
  throw new ManagedWorkspaceError(code, message, details)
}

/** Normalize one absolute-or-relative spelling into an absolute, separator-stable path. */
export function normalizePath(value) {
  let out = resolve(value)
  while (out.length > 1 && out.endsWith(sep)) out = out.slice(0, -1)
  return out
}

/** Compare two path spellings the way the host filesystem does. */
export function samePath(left, right) {
  const a = normalizePath(left)
  const b = normalizePath(right)
  return IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** Whether `child` equals `parent` or lies beneath it (lexical, host case rules). */
export function isUnder(child, parent) {
  const target = IS_WIN ? normalizePath(child).toLowerCase() : normalizePath(child)
  const root = IS_WIN ? normalizePath(parent).toLowerCase() : normalizePath(parent)
  if (target === root) return true
  const prefix = root.endsWith(sep) ? root : root + sep
  return target.startsWith(prefix)
}

/** Expand `~`, `~/…`, and `~\…` against the OS home directory. */
export function expandHomePath(value) {
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2))
  return value
}

/** Validate one directory name used as a workspace folder or a link alias. */
export function validateSegment(value, field = 'name') {
  if (typeof value !== 'string') fail('invalid-name', `${field} must be a string`)
  const name = value.trim()
  if (name.length === 0) fail('invalid-name', `${field} must not be blank`)
  if (name.length > MAX_SEGMENT) fail('invalid-name', `${field} must be at most ${MAX_SEGMENT} characters`)
  if (name === '.' || name === '..') fail('invalid-name', `${field} must not be "." or ".."`)
  if (INVALID_SEGMENT_CHARS.test(name)) fail('invalid-name', `${field} contains a character that is not allowed in a folder name: ${JSON.stringify(value)}`)
  if (/[. ]$/.test(name)) fail('invalid-name', `${field} must not end with a dot or a space`)
  if (RESERVED_SEGMENTS.test(name)) fail('invalid-name', `${field} is a reserved Windows device name: ${JSON.stringify(name)}`)
  return name
}

/** Derive a safe alias from a folder's final path segment. */
export function defaultAlias(target) {
  const base = normalizePath(target).split(sep).filter(Boolean).pop() ?? 'folder'
  const cleaned = base.replace(INVALID_SEGMENT_CHARS, '-').replace(/[. ]+$/g, '').trim().slice(0, MAX_SEGMENT)
  return cleaned.length > 0 && cleaned !== '.' && cleaned !== '..' && !RESERVED_SEGMENTS.test(cleaned) ? cleaned : 'folder'
}

/** Pick the first alias not already used in the workspace. */
export function uniqueAlias(used, preferred) {
  const taken = new Set(used)
  if (!taken.has(preferred)) return preferred
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${preferred}-${index}`
    if (!taken.has(candidate)) return candidate
  }
  return `${preferred}-${randomUUID().slice(0, 8)}`
}

/** Resolve the harness home used for the plugin manifest. */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv && fromEnv.length > 0 ? normalizePath(fromEnv) : join(homedir(), '.dsh')
}

/** Default base directory for new managed workspaces. */
export function defaultBaseDirectory() {
  return join(homedir(), 'DSH-Workspaces')
}

async function lstatOrNull(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

async function statOrNull(path) {
  try {
    return await stat(path)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

async function isDirectory(path) {
  const info = await statOrNull(path)
  return info !== null && info.isDirectory()
}

async function exists(path) {
  return (await lstatOrNull(path)) !== null
}

async function resolveLink(linkPath) {
  const raw = await readlink(linkPath)
  return normalizePath(isAbsolute(raw) ? raw : resolve(dirname(linkPath), raw))
}

function rejectUnsupportedTarget(target) {
  if (IS_WIN && (target.startsWith('\\\\') || target.startsWith('//'))) {
    fail('unsupported-target', `a network (UNC) folder cannot be linked as a junction: ${target}`)
  }
}

async function createDirectoryLink(target, linkPath) {
  if (IS_WIN) {
    try {
      await symlink(target, linkPath, 'junction')
      return
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'UNKNOWN' && error.code !== 'EACCES') throw error
      await execFileAsync('cmd.exe', ['/d', '/s', '/c', 'mklink', '/J', linkPath, target], { windowsHide: true })
      return
    }
  }
  await symlink(target, linkPath, 'dir')
}

function freshManifest() {
  return {
    schemaVersion: MANIFEST_VERSION,
    baseDirectory: defaultBaseDirectory(),
    linksDirectoryName: LINKS_DIRECTORY,
    workspaces: [],
  }
}

function normalizeManifest(raw, warnings) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push('manifest root was not an object')
    return freshManifest()
  }
  const manifest = freshManifest()
  if (typeof raw.baseDirectory === 'string' && raw.baseDirectory.trim().length > 0) {
    const expanded = expandHomePath(raw.baseDirectory.trim())
    if (isAbsolute(expanded)) manifest.baseDirectory = normalizePath(expanded)
    else warnings.push(`ignored a non-absolute baseDirectory: ${JSON.stringify(raw.baseDirectory)}`)
  }
  if (Array.isArray(raw.workspaces)) {
    for (const entry of raw.workspaces) {
      if (entry === null || typeof entry !== 'object') {
        warnings.push('ignored a malformed workspace record')
        continue
      }
      if (typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.path !== 'string') {
        warnings.push('ignored a workspace record without id/name/path')
        continue
      }
      if (!isAbsolute(entry.path)) {
        warnings.push(`ignored a workspace with a non-absolute path: ${JSON.stringify(entry.path)}`)
        continue
      }
      const links = []
      if (Array.isArray(entry.links)) {
        for (const link of entry.links) {
          if (link === null || typeof link !== 'object') continue
          if (typeof link.alias !== 'string' || typeof link.target !== 'string') continue
          if (!isAbsolute(link.target)) continue
          links.push({
            alias: link.alias,
            target: normalizePath(link.target),
            addedAt: typeof link.addedAt === 'string' ? link.addedAt : new Date(0).toISOString(),
          })
        }
      }
      manifest.workspaces.push({
        id: entry.id,
        name: entry.name,
        path: normalizePath(entry.path),
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date(0).toISOString(),
        origin: entry.origin === 'adopted' ? 'adopted' : 'created',
        links,
      })
    }
  }
  return manifest
}

/**
 * Owns the managed-workspace manifest, the workspace folder layout, and the
 * folder links. All mutations run on one promise chain and persist atomically.
 */
export class ManagedWorkspaceStore {
  constructor(options = {}) {
    this.home = normalizePath(options.home ?? resolveDshHome())
    this.manifestPath = join(this.home, 'managed-workspaces', 'manifest.json')
    this.now = options.now ?? (() => new Date().toISOString())
    this.logger = options.logger ?? (() => {})
    this.registry = null
    this.manifest = null
    this.warnings = []
    this.queue = Promise.resolve()
    this.loadPromise = null
  }

  /** Attach the host workspace registry (optional; the filesystem stays usable without it). */
  setRegistry(registry) {
    this.registry = registry ?? null
  }

  /** Dispose transient state; files and manifest stay on disk. */
  dispose() {
    this.registry = null
  }

  /** Load the manifest once. Repeated calls share the same promise. */
  load() {
    if (this.loadPromise === null) this.loadPromise = this.loadOnce()
    return this.loadPromise
  }

  async loadOnce() {
    let raw = null
    try {
      raw = await readFile(this.manifestPath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (raw === null) {
      this.manifest = freshManifest()
      return this.manifest
    }
    try {
      const parsed = JSON.parse(raw)
      const warnings = []
      this.manifest = normalizeManifest(parsed, warnings)
      this.warnings.push(...warnings)
    } catch (error) {
      const quarantine = `${this.manifestPath}.corrupt-${Date.now()}`
      let moved = false
      try {
        await rename(this.manifestPath, quarantine)
        moved = true
      } catch (moveError) {
        this.warnings.push(`manifest was unreadable and could not be moved aside: ${errorMessage(moveError)}`)
      }
      this.warnings.push(
        moved
          ? `manifest was unreadable and was moved to ${quarantine}: ${errorMessage(error)}`
          : `manifest was unreadable: ${errorMessage(error)}`,
      )
      this.manifest = freshManifest()
    }
    return this.manifest
  }

  /** Run one mutation after the previous one settled. */
  run(operation) {
    const result = this.queue.then(() => operation())
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async persist() {
    const directory = dirname(this.manifestPath)
    await mkdir(directory, { recursive: true })
    const temporary = `${this.manifestPath}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`
    await writeFile(temporary, `${JSON.stringify(this.manifest, null, 2)}\n`, 'utf8')
    await rename(temporary, this.manifestPath)
  }

  requireManifest() {
    if (this.manifest === null) {
      fail('not-ready', 'managed workspace state has not been loaded yet')
    }
    return this.manifest
  }

  mustFind(id) {
    const manifest = this.requireManifest()
    const record = manifest.workspaces.find((entry) => entry.id === id)
    if (record === undefined) fail('not-found', `unknown managed workspace: ${JSON.stringify(id)}`)
    return record
  }

  linksDirectory(record) {
    return join(record.path, this.requireManifest().linksDirectoryName ?? LINKS_DIRECTORY)
  }

  /** The registered workspace id for a record, or null. */
  registryWorkspaceId(record) {
    if (this.registry === null) return null
    const match = this.registry.list().find((workspace) => samePath(workspace.path, record.path))
    return match === undefined ? null : String(match.id)
  }

  /** All managed workspace records (loaded state only). */
  listSync() {
    return this.manifest === null ? [] : [...this.manifest.workspaces]
  }

  /** Whether a path is a filesystem root, which cannot become a workspace. */
  isFilesystemRoot(path) {
    const root = parse(normalizePath(path)).root
    return root.length > 0 && samePath(root, path)
  }

  /** The display title the workspace registry holds for a path, when registered. */
  registryTitle(path) {
    if (this.registry === null) return null
    const match = this.registry.list().find((workspace) => samePath(workspace.path, path))
    if (match === undefined) return null
    const title = typeof match.title === 'string' ? match.title.trim() : ''
    return title.length > 0 ? title : null
  }

  /** A display name not yet used by another managed workspace. */
  uniqueName(preferred) {
    const taken = new Set(this.listSync().map((record) => record.name.toLowerCase()))
    if (!taken.has(preferred.toLowerCase())) return preferred
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${preferred} (${index})`
      if (!taken.has(candidate.toLowerCase())) return candidate
    }
    return `${preferred} (${randomUUID().slice(0, 4)})`
  }

  /** Registry workspaces that are not managed by this plugin yet. */
  candidates() {
    if (this.registry === null || this.manifest === null) return []
    const out = []
    for (const workspace of this.registry.list()) {
      if (typeof workspace.path !== 'string') continue
      if (this.isFilesystemRoot(workspace.path)) continue
      if (this.manifest.workspaces.some((record) => samePath(record.path, workspace.path))) continue
      const title = typeof workspace.title === 'string' && workspace.title.trim().length > 0 ? workspace.title.trim() : basename(workspace.path)
      out.push({ path: normalizePath(workspace.path), title, workspaceId: String(workspace.id) })
    }
    return out
  }

  /** Resolve the managed workspace that owns an absolute path. */
  findWorkspaceForPath(path) {
    if (this.manifest === null || typeof path !== 'string') return null
    for (const workspace of this.manifest.workspaces) {
      if (isUnder(path, workspace.path)) return { workspace, via: 'home' }
    }
    for (const workspace of this.manifest.workspaces) {
      for (const link of workspace.links) {
        if (isUnder(path, link.target)) return { workspace, via: 'link', alias: link.alias, link }
      }
    }
    return null
  }

  async linkView(record, link) {
    const linkPath = join(this.linksDirectory(record), link.alias)
    const node = await lstatOrNull(linkPath)
    let health
    if (node === null) {
      health = 'link-missing'
    } else if (!node.isSymbolicLink()) {
      health = 'conflict'
    } else {
      const actual = await resolveLink(linkPath)
      if (!samePath(actual, link.target)) health = 'conflict'
      else health = (await isDirectory(link.target)) ? 'ok' : 'target-missing'
    }
    return { alias: link.alias, target: link.target, linkPath, health }
  }

  async view(record) {
    const links = []
    for (const link of record.links) links.push(await this.linkView(record, link))
    const workspaceId = this.registryWorkspaceId(record)
    return {
      id: record.id,
      name: record.name,
      path: record.path,
      createdAt: record.createdAt,
      origin: record.origin === 'adopted' ? 'adopted' : 'created',
      directory: (await isDirectory(record.path)) ? 'ok' : 'missing',
      registered: workspaceId !== null,
      workspaceId,
      links,
    }
  }

  async buildState() {
    const manifest = this.requireManifest()
    const workspaces = []
    for (const record of manifest.workspaces) workspaces.push(await this.view(record))
    return {
      baseDirectory: manifest.baseDirectory,
      linksDirectoryName: manifest.linksDirectoryName ?? LINKS_DIRECTORY,
      manifestPath: this.manifestPath,
      warnings: [...this.warnings],
      workspaces,
      candidates: this.candidates(),
    }
  }

  async state() {
    await this.load()
    return this.run(() => this.buildState())
  }

  async ensureBase() {
    const manifest = this.requireManifest()
    const base = manifest.baseDirectory
    await mkdir(base, { recursive: true })
    return base
  }

  async setBaseDirectory(value) {
    await this.load()
    return this.run(async () => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        fail('invalid-base', 'baseDirectory must be a non-blank absolute path')
      }
      const expanded = expandHomePath(value.trim())
      if (!isAbsolute(expanded)) fail('invalid-base', `baseDirectory must be absolute: ${JSON.stringify(value)}`)
      const normalized = normalizePath(expanded)
      const info = await statOrNull(normalized)
      if (info !== null && !info.isDirectory()) fail('invalid-base', `baseDirectory is a file: ${normalized}`)
      this.requireManifest().baseDirectory = normalized
      await this.persist()
      return { baseDirectory: normalized }
    })
  }

  async registerRecord(record) {
    if (this.registry === null) fail('registry-unavailable', 'the harness workspace registry is not available')
    const workspace = await this.registry.create(record.path, record.name)
    return String(workspace.id)
  }

  async create(name) {
    await this.load()
    return this.run(async () => {
      const value = validateSegment(name)
      const base = await this.ensureBase()
      const directory = join(base, value)
      if (await exists(directory)) fail('exists', `workspace folder already exists: ${directory}`)
      await mkdir(join(directory, this.requireManifest().linksDirectoryName ?? LINKS_DIRECTORY), { recursive: true })
      const canonical = normalizePath(await realpath(directory))
      const record = {
        id: `mws-${randomUUID()}`,
        name: value,
        path: canonical,
        createdAt: this.now(),
        origin: 'created',
        links: [],
      }
      this.requireManifest().workspaces.push(record)
      await this.persist()
      let registered = false
      let warning
      try {
        await this.registerRecord(record)
        registered = true
      } catch (error) {
        warning = errorMessage(error)
        this.logger(`workspace "${record.name}" was created but not registered: ${warning}`)
      }
      return { workspace: await this.view(record), registered, ...(warning === undefined ? {} : { warning }) }
    })
  }

  /**
   * Adopt an existing folder as a managed workspace without creating or moving
   * anything inside it. `_roots` appears only when the first link is attached.
   */
  async adopt(folder) {
    await this.load()
    return this.run(async () => this.adoptOne(folder))
  }

  /** Adopt every registered workspace that this plugin does not manage yet. */
  async adoptAll() {
    await this.load()
    return this.run(async () => {
      const adopted = []
      const skipped = []
      const failed = []
      for (const candidate of this.candidates()) {
        try {
          const result = await this.adoptOne(candidate.path)
          if (result.adopted) adopted.push(result.workspace.name)
          else skipped.push(result.workspace.name)
        } catch (error) {
          failed.push(`${candidate.path}: ${errorMessage(error)}`)
        }
      }
      return { adopted, skipped, failed, state: await this.buildState() }
    })
  }

  async adoptOne(folder) {
    if (typeof folder !== 'string' || folder.trim().length === 0) {
      fail('invalid-target', 'folder must be a non-blank absolute path')
    }
    const expanded = expandHomePath(folder.trim())
    if (!isAbsolute(expanded)) fail('invalid-target', `folder must be absolute: ${JSON.stringify(folder)}`)
    const info = await statOrNull(expanded)
    if (info === null) fail('target-missing', `folder does not exist: ${expanded}`)
    if (!info.isDirectory()) fail('invalid-target', `not a directory: ${expanded}`)
    const target = normalizePath(await realpath(expanded))
    if (this.isFilesystemRoot(target)) fail('invalid-target', `a filesystem root cannot become a workspace: ${target}`)
    if (samePath(target, this.requireManifest().baseDirectory)) {
      fail('invalid-target', 'the workspace base directory cannot itself be a workspace')
    }
    const existing = this.requireManifest().workspaces.find((record) => samePath(record.path, target))
    if (existing !== undefined) {
      return { workspace: await this.view(existing), adopted: false }
    }
    const preferred = this.registryTitle(target) ?? basename(target)
    const record = {
      id: `mws-${randomUUID()}`,
      name: this.uniqueName(preferred),
      path: target,
      createdAt: this.now(),
      origin: 'adopted',
      links: [],
    }
    this.requireManifest().workspaces.push(record)
    await this.persist()
    let registered = false
    let warning
    try {
      await this.registerRecord(record)
      registered = true
    } catch (error) {
      warning = errorMessage(error)
      this.logger(`workspace "${record.name}" was adopted but not registered: ${warning}`)
    }
    return {
      workspace: await this.view(record),
      adopted: true,
      registered,
      ...(warning === undefined ? {} : { warning }),
    }
  }

  async attach(id, folder, alias) {
    await this.load()
    return this.run(async () => {
      const record = this.mustFind(id)
      if (typeof folder !== 'string' || folder.trim().length === 0) fail('invalid-target', 'folder must be a non-blank absolute path')
      const expanded = expandHomePath(folder.trim())
      if (!isAbsolute(expanded)) fail('invalid-target', `folder must be absolute: ${JSON.stringify(folder)}`)
      const info = await statOrNull(expanded)
      if (info === null) fail('target-missing', `folder does not exist: ${expanded}`)
      if (!info.isDirectory()) fail('invalid-target', `not a directory: ${expanded}`)
      const target = normalizePath(await realpath(expanded))
      rejectUnsupportedTarget(target)
      if (isUnder(target, record.path)) fail('invalid-link', 'cannot link a folder that lies inside the workspace')
      if (isUnder(record.path, target)) fail('invalid-link', 'cannot link a folder that contains the workspace')

      const existing = record.links.find((link) => samePath(link.target, target))
      if (existing !== undefined) {
        const requested = typeof alias === 'string' && alias.trim().length > 0 ? validateSegment(alias, 'alias') : existing.alias
        if (requested !== existing.alias) {
          fail('already-linked', `folder is already linked as "${existing.alias}"`, { alias: existing.alias })
        }
        return { workspace: await this.view(record), link: await this.linkView(record, existing), created: false }
      }

      const preferred = typeof alias === 'string' && alias.trim().length > 0 ? validateSegment(alias, 'alias') : defaultAlias(target)
      const name = uniqueAlias(record.links.map((link) => link.alias), preferred)
      const roots = this.linksDirectory(record)
      await mkdir(roots, { recursive: true })
      const linkPath = join(roots, name)
      const node = await lstatOrNull(linkPath)
      if (node !== null) {
        if (node.isSymbolicLink() && samePath(await resolveLink(linkPath), target)) {
          const link = { alias: name, target, addedAt: this.now() }
          record.links.push(link)
          await this.persist()
          return { workspace: await this.view(record), link: await this.linkView(record, link), created: false }
        }
        fail('conflict', `path already exists and is not a link to this folder: ${linkPath}`)
      }
      await createDirectoryLink(target, linkPath)
      const link = { alias: name, target, addedAt: this.now() }
      record.links.push(link)
      await this.persist()
      return { workspace: await this.view(record), link: await this.linkView(record, link), created: true }
    })
  }

  async detach(id, alias) {
    await this.load()
    return this.run(async () => {
      const record = this.mustFind(id)
      const name = validateSegment(alias, 'alias')
      const index = record.links.findIndex((link) => link.alias === name)
      if (index < 0) fail('not-found', `workspace "${record.name}" has no link named "${name}"`)
      const link = record.links[index]
      const linkPath = join(this.linksDirectory(record), name)
      const node = await lstatOrNull(linkPath)
      if (node !== null) {
        if (!node.isSymbolicLink()) {
          fail('conflict', `refusing to remove "${linkPath}": it is a real directory or file, not a link`)
        }
        const actual = await resolveLink(linkPath)
        if (!samePath(actual, link.target)) {
          fail('conflict', `refusing to remove "${linkPath}": it points to ${actual}, not ${link.target}`)
        }
        await unlink(linkPath)
      }
      record.links.splice(index, 1)
      await this.persist()
      return { workspace: await this.view(record), removed: name }
    })
  }

  async register(id) {
    await this.load()
    return this.run(async () => {
      const record = this.mustFind(id)
      if (!(await isDirectory(record.path))) {
        fail('missing', `workspace folder is missing; run repair first: ${record.path}`)
      }
      await this.registerRecord(record)
      return { workspace: await this.view(record), registered: true }
    })
  }

  async forget(id) {
    await this.load()
    return this.run(async () => {
      const record = this.mustFind(id)
      // An adopted workspace existed before the plugin: stop managing it but
      // leave its sidebar registration alone, because removing it would hide a
      // project the user created outside this plugin.
      const keepRegistration = record.origin === 'adopted'
      let unregistered = false
      if (!keepRegistration) {
        const workspaceId = this.registryWorkspaceId(record)
        if (workspaceId !== null) {
          await this.registry.delete(workspaceId)
          unregistered = true
        }
      }
      const index = this.requireManifest().workspaces.findIndex((entry) => entry.id === record.id)
      if (index >= 0) this.requireManifest().workspaces.splice(index, 1)
      await this.persist()
      return { removed: record.name, unregistered, keptRegistration: keepRegistration, path: record.path }
    })
  }

  async repair(id) {
    await this.load()
    return this.run(async () => {
      const record = this.mustFind(id)
      const repaired = []
      const conflicts = []
      if (!(await isDirectory(record.path))) {
        if (record.origin === 'adopted') {
          fail('missing', `the adopted workspace folder is missing and will not be recreated: ${record.path}`)
        }
        await mkdir(record.path, { recursive: true })
        repaired.push('workspace folder')
      }
      const roots = this.linksDirectory(record)
      // A created workspace always owns its _roots; an adopted one gets it only
      // when a linked folder actually needs it, so adoption leaves no trace.
      if (!(await isDirectory(roots)) && (record.links.length > 0 || record.origin !== 'adopted')) {
        await mkdir(roots, { recursive: true })
        repaired.push(roots)
      }
      for (const link of record.links) {
        const linkPath = join(roots, link.alias)
        const node = await lstatOrNull(linkPath)
        if (node === null) {
          try {
            await createDirectoryLink(link.target, linkPath)
            repaired.push(link.alias)
          } catch (error) {
            conflicts.push(`${link.alias}: could not create the link (${errorMessage(error)})`)
          }
          continue
        }
        if (!node.isSymbolicLink()) {
          conflicts.push(`${link.alias}: path is occupied by a real directory or file`)
          continue
        }
        const actual = await resolveLink(linkPath)
        if (!samePath(actual, link.target)) {
          conflicts.push(`${link.alias}: link points elsewhere (${actual})`)
          continue
        }
        if (!(await isDirectory(link.target))) conflicts.push(`${link.alias}: target folder is missing (${link.target})`)
      }
      return { repaired, conflicts, workspace: await this.view(record) }
    })
  }
}

/** Render an error as one message string. */
export function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
