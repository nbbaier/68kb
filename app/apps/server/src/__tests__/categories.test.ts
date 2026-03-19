import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from '../db/schema'
import { createApp } from '../app'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle')

// ---------------------------------------------------------------------------
// Test database setup
// ---------------------------------------------------------------------------
const testSqlite = new Database(':memory:')
testSqlite.exec('PRAGMA foreign_keys = ON')
const testDb = drizzle({ client: testSqlite, schema })
migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER })

// Seed user groups
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
  ])
  .run()

process.env.SESSION_SECRET = '****************************************!!'

const app = createApp(testDb as typeof testDb)

// Seed admin user
beforeAll(async () => {
  const passwordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)
  testDb
    .insert(schema.users)
    .values({
      userIp: '127.0.0.1',
      userEmail: 'admin@example.com',
      userUsername: 'admin',
      userPassword: passwordHash,
      userGroup: 1,
      userJoinDate: now,
      userLastLogin: 0,
      lastActivity: 0,
      userCookie: '',
      userSession: '',
      userApiKey: '*********************************',
      userVerify: '',
    })
    .run()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loginAsAdmin(): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  const lastCookie = cookies[cookies.length - 1]
  return lastCookie.split(';')[0]
}

// ---------------------------------------------------------------------------
// GET /api/admin/categories
// ---------------------------------------------------------------------------
describe('GET /api/admin/categories', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/categories')
    expect(res.status).toBe(401)
  })

  it('returns empty list when no categories', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: unknown[] }
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBe(0)
  })

  it('returns categories in tree order with depth field', async () => {
    const cookie = await loginAsAdmin()

    // Insert root and child categories
    const rootResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Root Category',
        catUri: 'root-cat',
        catParent: 0,
        catOrder: 1,
        catDescription: 'Root',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()

    const rootId = rootResult!.catId

    testDb
      .insert(schema.categories)
      .values({
        catName: 'Child Category',
        catUri: 'child-cat',
        catParent: rootId,
        catOrder: 1,
        catDescription: 'Child',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .run()

    const res = await app.request('/api/admin/categories', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ catId: number; catName: string; depth: number; catParent: number }> }

    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)

    const root = json.data.find((c) => c.catName === 'Root Category')
    const child = json.data.find((c) => c.catName === 'Child Category')

    expect(root).toBeDefined()
    expect(root!.depth).toBe(0)

    expect(child).toBeDefined()
    expect(child!.depth).toBe(1)
    expect(child!.catParent).toBe(rootId)
  })

  it('returns root before children in traversal order', async () => {
    const cookie = await loginAsAdmin()

    const res = await app.request('/api/admin/categories', {
      headers: { Cookie: cookie },
    })
    const json = await res.json() as { data: Array<{ catName: string; depth: number }> }

    const rootIdx = json.data.findIndex((c) => c.catName === 'Root Category')
    const childIdx = json.data.findIndex((c) => c.catName === 'Child Category')

    // Root should appear before child in the list
    expect(rootIdx).toBeLessThan(childIdx)
  })

  it('returns all expected fields per category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      headers: { Cookie: cookie },
    })
    const json = await res.json() as { data: Array<Record<string, unknown>> }

    expect(json.data.length).toBeGreaterThan(0)
    const first = json.data[0]
    expect(typeof first.catId).toBe('number')
    expect(typeof first.catName).toBe('string')
    expect(typeof first.catParent).toBe('number')
    expect(typeof first.catUri).toBe('string')
    expect(typeof first.depth).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/categories/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/categories/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/categories/1')
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid (non-numeric) ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/abc', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Invalid')
  })

  it('returns 404 for non-existent category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/99999', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('not found')
  })

  it('returns category data for valid ID', async () => {
    const cookie = await loginAsAdmin()

    // Get an existing category
    const listRes = await app.request('/api/admin/categories', {
      headers: { Cookie: cookie },
    })
    const listJson = await listRes.json() as { data: Array<{ catId: number; catName: string }> }
    const first = listJson.data[0]

    const res = await app.request(`/api/admin/categories/${first.catId}`, {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catId: number; catName: string } }
    expect(json.data.catId).toBe(first.catId)
    expect(json.data.catName).toBe(first.catName)
  })
})
