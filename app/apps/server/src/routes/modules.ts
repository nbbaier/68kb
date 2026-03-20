import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { modules } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

type AddonManifest = {
  moduleName: string
  moduleDisplayName: string
  moduleDescription: string
  moduleDirectory: string
  moduleVersion: string
  moduleOrder: number
  requiredDependencies: string[]
  optionalDependencies: string[]
  hookEvents: string[]
}

type ModuleListItem = {
  moduleId: number | null
  moduleName: string
  moduleDisplayName: string
  moduleDescription: string
  moduleDirectory: string
  moduleVersion: string
  moduleOrder: number
  moduleActive: 'yes' | 'no'
  isInstalled: boolean
  isAvailable: boolean
  requiredDependencies: string[]
  optionalDependencies: string[]
  missingRequiredDependencies: string[]
  hookEvents: string[]
}

function isSafeModuleDirectory(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

function getAddonsRoot(): string {
  if (process.env.ADDONS_DIR) {
    return resolve(process.env.ADDONS_DIR)
  }

  const candidates = [
    resolve(process.cwd(), '../upload/system/68kb/third_party'),
    resolve(process.cwd(), '../../upload/system/68kb/third_party'),
    resolve(process.cwd(), '../../../upload/system/68kb/third_party'),
    resolve(process.cwd(), 'upload/system/68kb/third_party'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return resolve(process.cwd(), '../../../upload/system/68kb/third_party')
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function getXmlTagValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!match) return ''
  return decodeXmlEntities(stripTags(match[1]))
}

function getXmlTagList(xml: string, tag: string): string[] {
  const block = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!block) return []

  const inner = block[1]
  const nestedMatches = [...inner.matchAll(/<([a-zA-Z0-9_:-]+)[^>]*>([\s\S]*?)<\/\1>/g)]

  const nestedValues = nestedMatches
    .map((match) => decodeXmlEntities(stripTags(match[2])))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (nestedValues.length > 0) {
    return nestedValues
  }

  const flat = decodeXmlEntities(stripTags(inner))
  if (!flat) return []

  return flat
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function discoverHookEvents(addonDir: string, moduleDirectory: string): string[] {
  const extensionPath = join(addonDir, `${moduleDirectory}_extension.php`)
  if (!existsSync(extensionPath)) return []

  let source = ''
  try {
    source = readFileSync(extensionPath, 'utf8')
  } catch {
    return []
  }

  const hooks = new Set<string>()
  for (const match of source.matchAll(/register\(\s*['"]([^'"]+)['"]/g)) {
    const hook = (match[1] ?? '').trim()
    if (hook) hooks.add(hook)
  }
  return Array.from(hooks).sort((a, b) => a.localeCompare(b))
}

function normalizeDependencyList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
}

function parseAddonJson(addonDir: string, moduleDirectory: string): AddonManifest | null {
  const addonJsonPath = join(addonDir, 'addon.json')
  if (!existsSync(addonJsonPath)) return null

  try {
    const raw = JSON.parse(readFileSync(addonJsonPath, 'utf8')) as {
      moduleName?: string
      moduleDisplayName?: string
      moduleDescription?: string
      moduleVersion?: string
      moduleOrder?: number
      dependencies?: {
        required?: string[]
        optional?: string[]
      }
      hookEvents?: string[]
    }

    return {
      moduleName: (raw.moduleName ?? moduleDirectory).trim() || moduleDirectory,
      moduleDisplayName: (raw.moduleDisplayName ?? moduleDirectory).trim() || moduleDirectory,
      moduleDescription: (raw.moduleDescription ?? '').trim(),
      moduleDirectory,
      moduleVersion: (raw.moduleVersion ?? 'v1.0.0').trim() || 'v1.0.0',
      moduleOrder: Number.isFinite(raw.moduleOrder) ? Number(raw.moduleOrder) : 100,
      requiredDependencies: normalizeDependencyList(raw.dependencies?.required),
      optionalDependencies: normalizeDependencyList(raw.dependencies?.optional),
      hookEvents: normalizeDependencyList(raw.hookEvents),
    }
  } catch {
    return null
  }
}

function parseAddonXml(addonDir: string, moduleDirectory: string): AddonManifest | null {
  const configPath = join(addonDir, `${moduleDirectory}_config.xml`)
  if (!existsSync(configPath)) return null

  let xml = ''
  try {
    xml = readFileSync(configPath, 'utf8')
  } catch {
    return null
  }

  const moduleNameAttr = xml.match(/<module[^>]*\bname=['"]([^'"]+)['"]/i)?.[1]?.trim()

  return {
    moduleName: moduleNameAttr || moduleDirectory,
    moduleDisplayName: getXmlTagValue(xml, 'title') || moduleDirectory,
    moduleDescription: getXmlTagValue(xml, 'description'),
    moduleDirectory,
    moduleVersion: getXmlTagValue(xml, 'version') || 'v1.0.0',
    moduleOrder: parseInt(getXmlTagValue(xml, 'order') || '100', 10) || 100,
    requiredDependencies: getXmlTagList(xml, 'required'),
    optionalDependencies: getXmlTagList(xml, 'optional'),
    hookEvents: discoverHookEvents(addonDir, moduleDirectory),
  }
}

function discoverAddonManifest(addonsRoot: string, moduleDirectory: string): AddonManifest | null {
  const addonDir = join(addonsRoot, moduleDirectory)

  const jsonManifest = parseAddonJson(addonDir, moduleDirectory)
  if (jsonManifest) {
    if (jsonManifest.hookEvents.length === 0) {
      jsonManifest.hookEvents = discoverHookEvents(addonDir, moduleDirectory)
    }
    return jsonManifest
  }

  return parseAddonXml(addonDir, moduleDirectory)
}

function discoverAddons(addonsRoot: string): AddonManifest[] {
  let directories: string[] = []
  try {
    directories = readdirSync(addonsRoot).filter((entry) => {
      try {
        return statSync(join(addonsRoot, entry)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }

  return directories
    .map((dir) => discoverAddonManifest(addonsRoot, dir))
    .filter((item): item is AddonManifest => item !== null)
    .sort((a, b) => a.moduleDisplayName.localeCompare(b.moduleDisplayName))
}

function loadModuleRows(db: DrizzleDB) {
  return db
    .select({
      moduleId: modules.moduleId,
      moduleName: modules.moduleName,
      moduleDisplayName: modules.moduleDisplayName,
      moduleDescription: modules.moduleDescription,
      moduleDirectory: modules.moduleDirectory,
      moduleVersion: modules.moduleVersion,
      moduleActive: modules.moduleActive,
      moduleOrder: modules.moduleOrder,
    })
    .from(modules)
    .all()
}

function getActiveModuleDirectorySet(dbRows: ReturnType<typeof loadModuleRows>): Set<string> {
  return new Set(
    dbRows
      .filter((row) => row.moduleActive === 'yes')
      .map((row) => row.moduleDirectory),
  )
}

function buildModuleList(db: DrizzleDB): ModuleListItem[] {
  const addonsRoot = getAddonsRoot()
  const manifests = discoverAddons(addonsRoot)
  const dbRows = loadModuleRows(db)
  const dbByDir = new Map(dbRows.map((row) => [row.moduleDirectory, row]))
  const activeDirs = getActiveModuleDirectorySet(dbRows)

  const items: ModuleListItem[] = manifests.map((manifest) => {
    const row = dbByDir.get(manifest.moduleDirectory)
    const moduleActive: 'yes' | 'no' = row?.moduleActive === 'yes' ? 'yes' : 'no'
    const missingRequiredDependencies = manifest.requiredDependencies.filter(
      (dep) => !activeDirs.has(dep),
    )

    return {
      moduleId: row?.moduleId ?? null,
      moduleName: row?.moduleName ?? manifest.moduleName,
      moduleDisplayName: row?.moduleDisplayName ?? manifest.moduleDisplayName,
      moduleDescription: row?.moduleDescription ?? manifest.moduleDescription,
      moduleDirectory: manifest.moduleDirectory,
      moduleVersion: row?.moduleVersion ?? manifest.moduleVersion,
      moduleOrder: row?.moduleOrder ?? manifest.moduleOrder,
      moduleActive,
      isInstalled: Boolean(row),
      isAvailable: true,
      requiredDependencies: manifest.requiredDependencies,
      optionalDependencies: manifest.optionalDependencies,
      missingRequiredDependencies,
      hookEvents: manifest.hookEvents,
    }
  })

  // Include DB modules that no longer have a discoverable manifest.
  for (const row of dbRows) {
    if (items.some((item) => item.moduleDirectory === row.moduleDirectory)) {
      continue
    }

    items.push({
      moduleId: row.moduleId,
      moduleName: row.moduleName,
      moduleDisplayName: row.moduleDisplayName,
      moduleDescription: row.moduleDescription,
      moduleDirectory: row.moduleDirectory,
      moduleVersion: row.moduleVersion,
      moduleOrder: row.moduleOrder,
      moduleActive: row.moduleActive,
      isInstalled: true,
      isAvailable: false,
      requiredDependencies: [],
      optionalDependencies: [],
      missingRequiredDependencies: [],
      hookEvents: [],
    })
  }

  return items.sort(
    (a, b) =>
      a.moduleOrder - b.moduleOrder ||
      a.moduleDisplayName.localeCompare(b.moduleDisplayName),
  )
}

function findActiveDependents(db: DrizzleDB, targetDirectory: string): string[] {
  const list = buildModuleList(db)
  return list
    .filter((item) => item.moduleActive === 'yes')
    .filter((item) => item.requiredDependencies.includes(targetDirectory))
    .map((item) => item.moduleDirectory)
    .sort((a, b) => a.localeCompare(b))
}

export function createModuleRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  const requireManageModules = createRequireRole(db)('canManageModules')
  router.use('*', requireManageModules)

  // -------------------------------------------------------------------------
  // GET /api/admin/modules
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const data = buildModuleList(db)
    return c.json({
      data,
      totals: {
        total: data.length,
        active: data.filter((item) => item.moduleActive === 'yes').length,
        inactive: data.filter((item) => item.moduleActive !== 'yes').length,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/modules/activate
  // -------------------------------------------------------------------------
  router.post('/activate', async (c) => {
    let body: { moduleDirectory?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const moduleDirectory = String(body.moduleDirectory ?? '').trim()
    if (!moduleDirectory) {
      return c.json({ error: 'moduleDirectory is required' }, 400)
    }
    if (!isSafeModuleDirectory(moduleDirectory)) {
      return c.json({ error: 'Invalid module directory name' }, 400)
    }

    const addonsRoot = getAddonsRoot()
    const manifest = discoverAddonManifest(addonsRoot, moduleDirectory)
    if (!manifest) {
      return c.json({ error: 'Module manifest not found' }, 404)
    }

    const activeSet = getActiveModuleDirectorySet(loadModuleRows(db))
    const missingRequiredDependencies = manifest.requiredDependencies.filter(
      (dep) => !activeSet.has(dep),
    )
    if (missingRequiredDependencies.length > 0) {
      return c.json(
        {
          error: 'Cannot activate module due to missing required dependencies',
          missingRequiredDependencies,
        },
        400,
      )
    }

    const existing = db
      .select({ moduleId: modules.moduleId })
      .from(modules)
      .where(eq(modules.moduleDirectory, moduleDirectory))
      .get()

    if (existing) {
      db
        .update(modules)
        .set({
          moduleName: manifest.moduleName,
          moduleDisplayName: manifest.moduleDisplayName,
          moduleDescription: manifest.moduleDescription,
          moduleVersion: manifest.moduleVersion,
          moduleOrder: manifest.moduleOrder,
          moduleActive: 'yes',
        })
        .where(eq(modules.moduleId, existing.moduleId))
        .run()
    } else {
      db
        .insert(modules)
        .values({
          moduleName: manifest.moduleName,
          moduleDisplayName: manifest.moduleDisplayName,
          moduleDescription: manifest.moduleDescription,
          moduleDirectory: manifest.moduleDirectory,
          moduleVersion: manifest.moduleVersion,
          moduleOrder: manifest.moduleOrder,
          moduleActive: 'yes',
        })
        .run()
    }

    const updated = buildModuleList(db).find((item) => item.moduleDirectory === moduleDirectory)
    return c.json({
      data: updated ?? {
        moduleDirectory,
        moduleActive: 'yes',
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/modules/deactivate
  // -------------------------------------------------------------------------
  router.post('/deactivate', async (c) => {
    let body: { moduleDirectory?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const moduleDirectory = String(body.moduleDirectory ?? '').trim()
    if (!moduleDirectory) {
      return c.json({ error: 'moduleDirectory is required' }, 400)
    }
    if (!isSafeModuleDirectory(moduleDirectory)) {
      return c.json({ error: 'Invalid module directory name' }, 400)
    }

    const existing = db
      .select({ moduleId: modules.moduleId, moduleActive: modules.moduleActive })
      .from(modules)
      .where(eq(modules.moduleDirectory, moduleDirectory))
      .get()

    if (!existing) {
      return c.json({ error: 'Module not installed' }, 404)
    }

    const blockingDependents = findActiveDependents(db, moduleDirectory).filter(
      (dep) => dep !== moduleDirectory,
    )
    if (blockingDependents.length > 0) {
      return c.json(
        {
          error: 'Cannot deactivate module while dependent modules are active',
          blockingDependents,
        },
        400,
      )
    }

    db
      .update(modules)
      .set({ moduleActive: 'no' })
      .where(eq(modules.moduleId, existing.moduleId))
      .run()

    return c.json({
      data: {
        moduleDirectory,
        moduleActive: 'no',
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/modules/uninstall
  // -------------------------------------------------------------------------
  router.post('/uninstall', async (c) => {
    let body: { moduleDirectory?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const moduleDirectory = String(body.moduleDirectory ?? '').trim()
    if (!moduleDirectory) {
      return c.json({ error: 'moduleDirectory is required' }, 400)
    }
    if (!isSafeModuleDirectory(moduleDirectory)) {
      return c.json({ error: 'Invalid module directory name' }, 400)
    }

    const existing = db
      .select({ moduleId: modules.moduleId })
      .from(modules)
      .where(eq(modules.moduleDirectory, moduleDirectory))
      .get()

    if (!existing) {
      return c.json({ error: 'Module not installed' }, 404)
    }

    const blockingDependents = findActiveDependents(db, moduleDirectory).filter(
      (dep) => dep !== moduleDirectory,
    )
    if (blockingDependents.length > 0) {
      return c.json(
        {
          error: 'Cannot uninstall module while dependent modules are active',
          blockingDependents,
        },
        400,
      )
    }

    db.delete(modules).where(eq(modules.moduleId, existing.moduleId)).run()

    return c.json({
      data: {
        moduleDirectory,
        uninstalled: true,
      },
    })
  })

  return router
}
