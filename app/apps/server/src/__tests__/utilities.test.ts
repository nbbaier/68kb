import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'url'
import { gunzipSync } from 'node:zlib'
import * as schema from '../db/schema'
import { createApp } from '../app'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle')

const testSqlite = new Database(':memory:')
testSqlite.exec('PRAGMA foreign_keys = ON')
const testDb = drizzle({ client: testSqlite, schema })
migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER })

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'
const app = createApp(testDb as typeof testDb)

const tmpCacheDir = mkdtempSync(join(tmpdir(), 'kb-cache-'))
const staleCacheFile = join(tmpCacheDir, 'stale.cache')

beforeAll(async () => {
  process.env.CACHE_DIR = tmpCacheDir
  writeFileSync(staleCacheFile, 'stale-cache-data')

  testDb
    .insert(schema.userGroups)
    .values([
      {
        groupId: 1,
        groupName: 'Site Admins',
        groupDescription: 'Site Administrators',
        canViewSite: 'y',
        canAccessAdmin: 'y',
        canManageArticles: 'y',
        canDeleteArticles: 'y',
        canManageUsers: 'y',
        canManageCategories: 'y',
        canDeleteCategories: 'y',
        canManageSettings: 'y',
        canManageUtilities: 'y',
        canManageThemes: 'y',
        canManageModules: 'y',
        canSearch: 'y',
      },
      {
        groupId: 6,
        groupName: 'Limited Admin',
        groupDescription: 'Can access admin only',
        canViewSite: 'y',
        canAccessAdmin: 'y',
        canManageArticles: 'n',
        canDeleteArticles: 'n',
        canManageUsers: 'n',
        canManageCategories: 'n',
        canDeleteCategories: 'n',
        canManageSettings: 'n',
        canManageUtilities: 'n',
        canManageThemes: 'n',
        canManageModules: 'n',
        canSearch: 'y',
      },
    ])
    .run()

  testDb
    .insert(schema.settings)
    .values({ optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' })
    .run()

  testDb
    .insert(schema.searchCache)
    .values({
      searchId: 'stale-search-hash',
      searchDate: Math.floor(Date.now() / 1000) - 3600,
      searchKeywords: '{"keywords":"stale"}',
      searchUserId: 0,
      searchIp: '127.0.0.1',
      searchTotal: 4,
    })
    .run()

  const adminHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const limitedHash = await Bun.password.hash('limited123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)

  testDb
    .insert(schema.users)
    .values([
      {
        userIp: '127.0.0.1',
        userEmail: 'admin@example.com',
        userUsername: 'admin',
        userPassword: adminHash,
        userGroup: 1,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'adminapikey123456789012345678901234',
        userVerify: '',
      },
      {
        userIp: '127.0.0.1',
        userEmail: 'limited@example.com',
        userUsername: 'limitedadmin',
        userPassword: limitedHash,
        userGroup: 6,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'limitedapikey1234567890123456789012',
        userVerify: '',
      },
    ])
    .run()
})

afterAll(() => {
  rmSync(tmpCacheDir, { recursive: true, force: true })
  delete process.env.CACHE_DIR
})

async function login(username: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`)
  }

  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) {
    throw new Error('No session cookie set after login')
  }

  return cookies[cookies.length - 1].split(';')[0]
}

describe('Admin database utilities API', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/utilities')
    expect(res.status).toBe(401)
  })

  it('returns 403 for admin user without can_manage_utilities', async () => {
    const cookie = await login('limitedadmin', 'limited123')
    const res = await app.request('/api/admin/utilities', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns utility summary to authorized admins', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/utilities', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        tableCount: number
        searchCacheEntries: number
        cacheDirectories: string[]
      }
    }

    expect(json.data.tableCount).toBeGreaterThan(0)
    expect(json.data.searchCacheEntries).toBe(1)
    expect(json.data.cacheDirectories).toContain(tmpCacheDir)
  })

  it('optimizes the database', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/utilities/optimize', {
      method: 'POST',
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as { data: { optimized: boolean } }
    expect(json.data.optimized).toBe(true)
  })

  it('runs integrity check as repair operation', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/utilities/repair', {
      method: 'POST',
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as { data: { repaired: boolean; details: string[] } }
    expect(json.data.repaired).toBe(true)
    expect(json.data.details.length).toBeGreaterThan(0)
  })

  it('clears search cache and cache files', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/utilities/clear-cache', {
      method: 'POST',
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        searchCacheRowsDeleted: number
        fileEntriesRemoved: number
      }
    }

    expect(json.data.searchCacheRowsDeleted).toBeGreaterThanOrEqual(1)
    expect(json.data.fileEntriesRemoved).toBeGreaterThanOrEqual(1)
    expect(existsSync(staleCacheFile)).toBe(false)
  })

  it('downloads gzipped backup snapshot', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/utilities/backup', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/gzip')
    expect(res.headers.get('Content-Disposition')).toContain('.gz')

    const body = await res.arrayBuffer()
    expect(body.byteLength).toBeGreaterThan(0)

    const decompressed = gunzipSync(Buffer.from(body)).toString('utf8')
    expect(decompressed).toContain('"format":"68kb-json-backup-v1"')
    expect(decompressed).toContain('"users"')
  })
})
