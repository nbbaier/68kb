import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import { gzipSync } from 'node:zlib'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { count } from 'drizzle-orm'
import { searchCache } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

type SqliteClientCarrier = {
  $client?: Database
}

function getSqliteClient(db: DrizzleDB): Database {
  const client = (db as unknown as SqliteClientCarrier).$client
  if (!client) {
    throw new Error('SQLite client is not available')
  }
  return client
}

function getUserTableNames(sqlite: Database): string[] {
  const rows = sqlite
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>

  return rows.map((row) => row.name)
}

function escapeSqlIdentifier(identifier: string): string {
  return identifier.replace(/"/g, '""')
}

function getCacheDirectories(): string[] {
  const fromEnv = (process.env.CACHE_DIR ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => resolve(entry))

  if (fromEnv.length > 0) {
    return Array.from(new Set(fromEnv)).filter((dir) => existsSync(dir))
  }

  const candidates = [
    resolve(process.cwd(), 'cache'),
    resolve(process.cwd(), '../upload/system/68kb/cache'),
    resolve(process.cwd(), '../../upload/system/68kb/cache'),
    resolve(process.cwd(), '../../../upload/system/68kb/cache'),
    resolve(process.cwd(), 'upload/system/68kb/cache'),
  ]

  return Array.from(new Set([...fromEnv, ...candidates])).filter((dir) => existsSync(dir))
}

function clearDirectoryContents(dir: string): number {
  if (!existsSync(dir)) return 0

  let removed = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = resolve(dir, entry.name)
    rmSync(target, { recursive: true, force: true })
    removed += 1
  }
  return removed
}

function buildBackupSnapshot(db: DrizzleDB) {
  const sqlite = getSqliteClient(db)
  const tableNames = getUserTableNames(sqlite)
  const tables: Record<string, unknown[]> = {}

  for (const tableName of tableNames) {
    const safeName = escapeSqlIdentifier(tableName)
    const rows = sqlite.query(`SELECT * FROM "${safeName}"`).all()
    tables[tableName] = rows
  }

  return {
    generatedAt: Math.floor(Date.now() / 1000),
    format: '68kb-json-backup-v1',
    tables,
  }
}

export function createUtilitiesRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()
  const requireManageUtilities = createRequireRole(db)('canManageUtilities')
  router.use('*', requireManageUtilities)

  // -------------------------------------------------------------------------
  // GET /api/admin/utilities
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const sqlite = getSqliteClient(db)
    const tableNames = getUserTableNames(sqlite)
    const searchCacheCount = db
      .select({ value: count() })
      .from(searchCache)
      .get()?.value ?? 0

    return c.json({
      data: {
        tableCount: tableNames.length,
        tables: tableNames,
        searchCacheEntries: searchCacheCount,
        cacheDirectories: getCacheDirectories(),
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/utilities/optimize
  // -------------------------------------------------------------------------
  router.post('/optimize', async (c) => {
    const sqlite = getSqliteClient(db)
    sqlite.exec('PRAGMA optimize')

    return c.json({
      data: {
        optimized: true,
        tableCount: getUserTableNames(sqlite).length,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/utilities/repair
  // -------------------------------------------------------------------------
  router.post('/repair', async (c) => {
    const sqlite = getSqliteClient(db)
    const quickCheck = sqlite.query('PRAGMA quick_check').all() as Array<{ quick_check: string }>
    const failingRows = quickCheck.filter((row) => row.quick_check.toLowerCase() !== 'ok')

    if (failingRows.length > 0) {
      return c.json(
        {
          error: 'Database integrity check failed',
          details: failingRows.map((row) => row.quick_check),
        },
        500,
      )
    }

    return c.json({
      data: {
        repaired: true,
        details: quickCheck.map((row) => row.quick_check),
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/utilities/clear-cache
  // -------------------------------------------------------------------------
  router.post('/clear-cache', async (c) => {
    const beforeDeleteCount = db
      .select({ value: count() })
      .from(searchCache)
      .get()?.value ?? 0

    db.delete(searchCache).run()

    const afterDeleteCount = db
      .select({ value: count() })
      .from(searchCache)
      .get()?.value ?? 0

    const deletedSearchRows = Math.max(0, beforeDeleteCount - afterDeleteCount)
    const cacheDirs = getCacheDirectories()
    let removedEntries = 0

    for (const dir of cacheDirs) {
      removedEntries += clearDirectoryContents(dir)
    }

    return c.json({
      data: {
        searchCacheRowsDeleted: deletedSearchRows,
        cacheDirectories: cacheDirs,
        fileEntriesRemoved: removedEntries,
      },
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/utilities/backup
  // -------------------------------------------------------------------------
  router.get('/backup', async (c) => {
    const snapshot = buildBackupSnapshot(db)
    const payload = JSON.stringify(snapshot)
    const compressed = gzipSync(payload)
    const filename = `68kb-${Math.floor(Date.now() / 1000)}.json.gz`

    c.header('Content-Type', 'application/gzip')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)
    c.header('Content-Length', String(compressed.byteLength))

    return c.body(compressed)
  })

  return router
}
