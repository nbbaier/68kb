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
    {
      groupId: 2,
      groupName: 'Editors',
      groupDescription: 'Editors without category permissions',
      canViewSite: 'y',
      canAccessAdmin: 'y',
      canManageArticles: 'y',
      canDeleteArticles: 'y',
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

process.env.SESSION_SECRET = '****************************************!!'

const app = createApp(testDb as typeof testDb)

// Seed users
beforeAll(async () => {
  const passwordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)
  testDb
    .insert(schema.users)
    .values([
      {
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
        userApiKey: 'adminapikey123456789012345678901',
        userVerify: '',
      },
      {
        userIp: '127.0.0.1',
        userEmail: 'editor@example.com',
        userUsername: 'editor',
        userPassword: passwordHash,
        userGroup: 2,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'editorapikey12345678901234567890',
        userVerify: '',
      },
    ])
    .run()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loginAs(username: string, password = 'admin123'): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  const lastCookie = cookies[cookies.length - 1]
  return lastCookie.split(';')[0]
}

async function loginAsAdmin(): Promise<string> {
  return loginAs('admin')
}

async function loginAsEditor(): Promise<string> {
  return loginAs('editor')
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
        catUri: 'root-cat/child-cat',
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

// ---------------------------------------------------------------------------
// POST /api/admin/categories
// ---------------------------------------------------------------------------
describe('POST /api/admin/categories', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Category' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for user without can_manage_categories', async () => {
    const cookie = await loginAsEditor()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Should Fail' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'no-name' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('required')
  })

  it('returns 400 when name is empty string', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '  ' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('required')
  })

  it('returns 400 for URI with invalid characters (alpha-dash)', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test', uri: 'my category!' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('URI')
  })

  it('returns 400 for non-numeric order', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test Order', order: 'abc' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('numeric')
  })

  it('creates category with minimum required fields (name only)', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'My New Category' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: { catId: number; catName: string; catUri: string; catOrder: number } }
    expect(json.data.catId).toBeGreaterThan(0)
    expect(json.data.catName).toBe('My New Category')
    // Auto-generated URI from name
    expect(json.data.catUri).toBeTruthy()
    expect(json.data.catUri).not.toContain(' ')
    // Order defaults to 0
    expect(json.data.catOrder).toBe(0)
  })

  it('auto-generates URI from name when URI not provided', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Auto URI Test Category' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: { catUri: string } }
    // Should be slugified version of the name
    expect(json.data.catUri).toBe('auto-uri-test-category')
  })

  it('uses provided URI when valid', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Custom URI Cat', uri: 'custom-uri-test' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: { catUri: string } }
    expect(json.data.catUri).toBe('custom-uri-test')
  })

  it('creates sub-category with hierarchical URI when parent is provided', async () => {
    const cookie = await loginAsAdmin()

    // Create parent category
    const parentRes = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Parent For Hierarchy', uri: 'parent-hier' }),
    })
    expect(parentRes.status).toBe(201)
    const parentJson = await parentRes.json() as { data: { catId: number; catUri: string } }
    const parentId = parentJson.data.catId

    // Create sub-category
    const childRes = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Child Cat', uri: 'child-hier', parent: parentId }),
    })
    expect(childRes.status).toBe(201)
    const childJson = await childRes.json() as { data: { catUri: string; catParent: number } }

    // URI should be hierarchical (parent/child)
    expect(childJson.data.catUri).toBe('parent-hier/child-hier')
    expect(childJson.data.catParent).toBe(parentId)
  })

  it('generates unique URI with _1 suffix when duplicate', async () => {
    const cookie = await loginAsAdmin()

    // Create first category with a specific name/URI
    await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Duplicate Test', uri: 'dup-test' }),
    })

    // Create second category with same name (auto-URI would be same)
    const res2 = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Duplicate Test 2', uri: 'dup-test' }),
    })
    expect(res2.status).toBe(201)
    const json2 = await res2.json() as { data: { catUri: string } }
    // Second should get _1 suffix
    expect(json2.data.catUri).toBe('dup-test_1')
  })

  it('creates category with all fields', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Full Fields Cat',
        uri: 'full-fields-cat',
        description: 'A full description',
        display: 'yes',
        allowAds: 'no',
        keywords: 'test, keywords',
        order: 5,
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as {
      data: {
        catName: string
        catUri: string
        catDescription: string
        catDisplay: string
        catAllowads: string
        catKeywords: string
        catOrder: number
      }
    }
    expect(json.data.catName).toBe('Full Fields Cat')
    expect(json.data.catUri).toBe('full-fields-cat')
    expect(json.data.catDescription).toBe('A full description')
    expect(json.data.catDisplay).toBe('yes')
    expect(json.data.catAllowads).toBe('no')
    expect(json.data.catKeywords).toBe('test, keywords')
    expect(json.data.catOrder).toBe(5)
  })

  it('returns 400 for non-existent parent', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Orphan', parent: 99999 }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('not found')
  })
})

// ---------------------------------------------------------------------------
// PUT /api/admin/categories/:id
// ---------------------------------------------------------------------------
describe('PUT /api/admin/categories/:id', () => {
  let testCatId: number
  let parentCatId: number
  let anotherParentId: number

  beforeAll(async () => {
    // Create a test category for update tests
    const result = testDb
      .insert(schema.categories)
      .values({
        catName: 'Update Test Cat',
        catUri: 'update-test-cat',
        catParent: 0,
        catOrder: 0,
        catDescription: 'For update tests',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    testCatId = result!.catId

    // Create a parent category for reparenting tests
    const parentResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Parent A',
        catUri: 'parent-a',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    parentCatId = parentResult!.catId

    // Create another parent for reparenting tests
    const anotherParentResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Parent B',
        catUri: 'parent-b',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    anotherParentId = anotherParentResult!.catId
  })

  it('returns 401 without session', async () => {
    const res = await app.request(`/api/admin/categories/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for user without can_manage_categories', async () => {
    const cookie = await loginAsEditor()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Should Fail' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/99999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Ghost' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid (non-numeric) ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/abc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test' }),
    })
    expect(res.status).toBe(400)
  })

  it('updates category name', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catName: string } }
    expect(json.data.catName).toBe('Updated Name')
  })

  it('returns 400 when name is set to empty string', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('required')
  })

  it('returns 400 for invalid URI on update', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'invalid uri!' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('URI')
  })

  it('returns 400 for non-integer order', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ order: 'not-a-number' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('integer')
  })

  it('returns 400 for decimal order value (regression — must not silently truncate)', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ order: 3.5 }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('integer')
  })

  it('updates URI correctly', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'new-uri-segment' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catUri: string } }
    expect(json.data.catUri).toBe('new-uri-segment')
  })

  it('rebuilds URI when parent is changed', async () => {
    const cookie = await loginAsAdmin()

    // Move testCatId under parentCatId
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ parent: parentCatId, uri: 'child-slug' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catUri: string; catParent: number } }
    expect(json.data.catParent).toBe(parentCatId)
    // URI should be parent-a/child-slug
    expect(json.data.catUri).toBe('parent-a/child-slug')
  })

  it('rebuilds URI when moved to different parent', async () => {
    const cookie = await loginAsAdmin()

    // Move to another parent
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ parent: anotherParentId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catUri: string; catParent: number } }
    expect(json.data.catParent).toBe(anotherParentId)
    // URI should be parent-b/child-slug (keeps existing slug, new parent)
    expect(json.data.catUri).toBe('parent-b/child-slug')
  })

  it('moves category to root when parent set to 0', async () => {
    const cookie = await loginAsAdmin()

    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ parent: 0 }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { catParent: number } }
    expect(json.data.catParent).toBe(0)
  })

  it('returns 400 when category set as its own parent', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ parent: testCatId }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('own parent')
  })

  it('updates all fields in one request', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${testCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Full Update',
        uri: 'full-update',
        description: 'Updated description',
        display: 'no',
        allowAds: 'no',
        keywords: 'key1, key2',
        order: 10,
      }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        catName: string
        catUri: string
        catDescription: string
        catDisplay: string
        catAllowads: string
        catKeywords: string
        catOrder: number
      }
    }
    expect(json.data.catName).toBe('Full Update')
    expect(json.data.catUri).toBe('full-update')
    expect(json.data.catDescription).toBe('Updated description')
    expect(json.data.catDisplay).toBe('no')
    expect(json.data.catAllowads).toBe('no')
    expect(json.data.catKeywords).toBe('key1, key2')
    expect(json.data.catOrder).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/categories/:id/image
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/categories/:id/image', () => {
  let catWithImageId: number

  beforeAll(() => {
    const result = testDb
      .insert(schema.categories)
      .values({
        catName: 'Cat With Image',
        catUri: 'cat-with-image',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
        catImage: 'test-image.jpg',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    catWithImageId = result!.catId
  })

  it('returns 401 without session', async () => {
    const res = await app.request(`/api/admin/categories/${catWithImageId}/image`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for user without can_manage_categories', async () => {
    const cookie = await loginAsEditor()
    const res = await app.request(`/api/admin/categories/${catWithImageId}/image`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/99999/image', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('clears category image in DB', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${catWithImageId}/image`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { deleted: boolean; catId: number } }
    expect(json.data.deleted).toBe(true)
    expect(json.data.catId).toBe(catWithImageId)

    // Verify DB is updated
    const updated = testDb
      .select()
      .from(schema.categories)
      .all()
      .find((c) => c.catId === catWithImageId)
    expect(updated?.catImage).toBe('')
  })

  it('returns 400 when category has no image', async () => {
    const cookie = await loginAsAdmin()
    // Create a category with no image
    const noImgResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Cat No Image',
        catUri: 'cat-no-image',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
        catImage: '',
      })
      .returning({ catId: schema.categories.catId })
      .get()

    const res = await app.request(`/api/admin/categories/${noImgResult!.catId}/image`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('no image')
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/categories/:id/duplicate
// ---------------------------------------------------------------------------
describe('GET /api/admin/categories/:id/duplicate', () => {
  let dupSourceId: number

  beforeAll(() => {
    const result = testDb
      .insert(schema.categories)
      .values({
        catName: 'Duplicate Source',
        catUri: 'parent-for-dup/dup-source',
        catParent: 0,
        catOrder: 3,
        catDescription: 'Source description',
        catAllowads: 'no',
        catDisplay: 'yes',
        catImage: 'source-image.jpg',
        catKeywords: 'dup, source',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    dupSourceId = result!.catId
  })

  it('returns 401 without session', async () => {
    const res = await app.request(`/api/admin/categories/${dupSourceId}/duplicate`)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid (non-numeric) ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/abc/duplicate', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Invalid')
  })

  it('returns 404 for non-existent category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/99999/duplicate', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('returns category data with URI last segment only', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/categories/${dupSourceId}/duplicate`, {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        catId: number
        catName: string
        catUri: string
        catDescription: string
        catAllowads: string
        catDisplay: string
        catKeywords: string
        catOrder: number
        catImage: string
      }
    }

    expect(json.data.catId).toBe(dupSourceId)
    expect(json.data.catName).toBe('Duplicate Source')
    // URI should be last segment only (not the full hierarchical path)
    expect(json.data.catUri).toBe('dup-source')
    expect(json.data.catDescription).toBe('Source description')
    expect(json.data.catAllowads).toBe('no')
    expect(json.data.catDisplay).toBe('yes')
    expect(json.data.catKeywords).toBe('dup, source')
    expect(json.data.catOrder).toBe(3)
    // Image should NOT be included in duplicate
    expect(json.data.catImage).toBe('')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/categories/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/categories/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/categories/1', {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for user without can_delete_categories', async () => {
    const cookie = await loginAsEditor()
    const res = await app.request('/api/admin/categories/1', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid (non-numeric) ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/abc', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Invalid')
  })

  it('returns 404 for non-existent category', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/categories/99999', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('deletes category with no articles', async () => {
    const cookie = await loginAsAdmin()

    // Create category to delete
    const result = testDb
      .insert(schema.categories)
      .values({
        catName: 'To Delete',
        catUri: 'to-delete',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const deleteId = result!.catId

    const res = await app.request(`/api/admin/categories/${deleteId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { deleted: boolean; catId: number; articleCount: number } }
    expect(json.data.deleted).toBe(true)
    expect(json.data.catId).toBe(deleteId)
    expect(json.data.articleCount).toBe(0)

    // Verify category is gone
    const check = testDb
      .select()
      .from(schema.categories)
      .all()
      .find((c) => c.catId === deleteId)
    expect(check).toBeUndefined()
  })

  it('returns 400 when deleting category with articles and no newCatId provided', async () => {
    const cookie = await loginAsAdmin()

    // Create article and category
    const catResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Cat With Articles',
        catUri: 'cat-with-articles',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const catId = catResult!.catId

    const articleResult = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Test Article for Cat Delete',
        articleUri: 'test-article-cat-delete',
        articleDate: Math.floor(Date.now() / 1000),
        articleModified: Math.floor(Date.now() / 1000),
        articleDisplay: 'y',
      })
      .returning({ articleId: schema.articles.articleId })
      .get()
    const articleId = articleResult!.articleId

    testDb
      .insert(schema.article2cat)
      .values({ articleIdRel: articleId, categoryIdRel: catId })
      .run()

    const res = await app.request(`/api/admin/categories/${catId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string; articleCount: number }
    expect(json.error).toContain('articles')
    expect(json.articleCount).toBe(1)
  })

  it('reassigns articles and deletes category when newCatId provided', async () => {
    const cookie = await loginAsAdmin()

    // Create old and new categories
    const oldCatResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Old Category',
        catUri: 'old-category-reassign',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const oldCatId = oldCatResult!.catId

    const newCatResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'New Category',
        catUri: 'new-category-reassign',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const newCatId = newCatResult!.catId

    // Create article and link to old category
    const articleResult = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Article To Reassign',
        articleUri: 'article-to-reassign',
        articleDate: Math.floor(Date.now() / 1000),
        articleModified: Math.floor(Date.now() / 1000),
        articleDisplay: 'y',
      })
      .returning({ articleId: schema.articles.articleId })
      .get()
    const articleId = articleResult!.articleId

    testDb
      .insert(schema.article2cat)
      .values({ articleIdRel: articleId, categoryIdRel: oldCatId })
      .run()

    const res = await app.request(`/api/admin/categories/${oldCatId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ newCatId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { deleted: boolean } }
    expect(json.data.deleted).toBe(true)

    // Verify old category is deleted
    const oldCatCheck = testDb
      .select()
      .from(schema.categories)
      .all()
      .find((c) => c.catId === oldCatId)
    expect(oldCatCheck).toBeUndefined()

    // Verify article is now in new category
    const linkCheck = testDb
      .select()
      .from(schema.article2cat)
      .all()
      .find((l) => l.articleIdRel === articleId && l.categoryIdRel === newCatId)
    expect(linkCheck).toBeDefined()
  })

  it('returns 400 when newCatId equals the category being deleted', async () => {
    const cookie = await loginAsAdmin()

    // Create a category with articles
    const catResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Same Cat Delete',
        catUri: 'same-cat-delete',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const catId = catResult!.catId

    const articleResult = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Same Cat Article',
        articleUri: 'same-cat-article',
        articleDate: Math.floor(Date.now() / 1000),
        articleModified: Math.floor(Date.now() / 1000),
        articleDisplay: 'y',
      })
      .returning({ articleId: schema.articles.articleId })
      .get()

    testDb
      .insert(schema.article2cat)
      .values({ articleIdRel: articleResult!.articleId, categoryIdRel: catId })
      .run()

    const res = await app.request(`/api/admin/categories/${catId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ newCatId: catId }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('different category')
  })

  it('returns 400 when newCatId points to non-existent category', async () => {
    const cookie = await loginAsAdmin()

    // Create a category with articles
    const catResult = testDb
      .insert(schema.categories)
      .values({
        catName: 'Nonexistent Target',
        catUri: 'nonexistent-target',
        catParent: 0,
        catOrder: 0,
        catDescription: '',
        catAllowads: 'yes',
        catDisplay: 'yes',
      })
      .returning({ catId: schema.categories.catId })
      .get()
    const catId = catResult!.catId

    const articleResult = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Nonexistent Target Article',
        articleUri: 'nonexistent-target-article',
        articleDate: Math.floor(Date.now() / 1000),
        articleModified: Math.floor(Date.now() / 1000),
        articleDisplay: 'y',
      })
      .returning({ articleId: schema.articles.articleId })
      .get()

    testDb
      .insert(schema.article2cat)
      .values({ articleIdRel: articleResult!.articleId, categoryIdRel: catId })
      .run()

    const res = await app.request(`/api/admin/categories/${catId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ newCatId: 99999 }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('not found')
  })
})
