import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
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
      groupName: 'Registered',
      groupDescription: 'Registered Users',
      canViewSite: 'y',
      canAccessAdmin: 'n',
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
    {
      groupId: 3,
      groupName: 'Pending',
      groupDescription: 'Pending Users',
      canViewSite: 'n',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'n',
    },
    {
      groupId: 4,
      groupName: 'Banned',
      groupDescription: 'Banned Users',
      canViewSite: 'n',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'n',
    },
    {
      groupId: 5,
      groupName: 'Guest',
      groupDescription: 'Guest Users',
      canViewSite: 'y',
      canAccessAdmin: 'n',
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

// Seed settings
testDb
  .insert(schema.settings)
  .values({ optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' })
  .run()

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const app = createApp(testDb as typeof testDb)

// Seed admin and a regular user before tests
beforeAll(async () => {
  const adminPasswordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)
  testDb
    .insert(schema.users)
    .values([
      {
        userIp: '127.0.0.1',
        userEmail: 'admin@example.com',
        userUsername: 'admin',
        userPassword: adminPasswordHash,
        userGroup: 1,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'testadminapikey123456789012345678',
        userVerify: '',
      },
      {
        userIp: '127.0.0.1',
        userEmail: 'john@example.com',
        userUsername: 'johndoe',
        userPassword: adminPasswordHash,
        userGroup: 2,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'johnapikey123456789012345678901234',
        userVerify: '',
      },
    ])
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
  if (!cookies || cookies.length === 0) throw new Error('No session cookie set after login')
  return cookies[cookies.length - 1].split(';')[0]
}

// ---------------------------------------------------------------------------
// GET /api/admin/users (list)
// ---------------------------------------------------------------------------
describe('GET /api/admin/users', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('returns paginated list with correct shape', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users?page=1&limit=10', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: unknown[]; total: number; page: number }
    expect(Array.isArray(json.data)).toBe(true)
    expect(typeof json.total).toBe('number')
    expect(json.total).toBeGreaterThanOrEqual(2)
    expect(json.page).toBe(1)
    // Each row has expected fields
    const first = json.data[0] as Record<string, unknown>
    expect(first.userId).toBeDefined()
    expect(first.userUsername).toBeDefined()
    expect(first.userEmail).toBeDefined()
    expect(first.gravatarHash).toBeDefined()
    expect(first.userJoinDate).toBeDefined()
    expect(first.userLastLogin).toBeDefined()
    expect(first.groupName).toBeDefined()
    // Password must NOT be returned
    expect(first.userPassword).toBeUndefined()
  })

  it('filters by search term', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users?search=johndoe', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ userUsername: string }>; total: number }
    expect(json.data.length).toBe(1)
    expect(json.data[0].userUsername).toBe('johndoe')
  })

  it('sorts by username ascending', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users?sort=username&order=asc', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ userUsername: string }> }
    expect(json.data.length).toBeGreaterThanOrEqual(2)
    // admin comes before johndoe alphabetically
    expect(json.data[0].userUsername).toBe('admin')
  })

  it('paginates correctly', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users?page=1&limit=1', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: unknown[]; total: number }
    expect(json.data.length).toBe(1)
    expect(json.total).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/users/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users/1')
    expect(res.status).toBe(401)
  })

  it('returns user data for valid id', async () => {
    const cookie = await loginAsAdmin()
    // Get admin user (should be id 1)
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const adminUser = listJson.data.find((u) => u.userUsername === 'admin')
    expect(adminUser).toBeDefined()

    const res = await app.request(`/api/admin/users/${adminUser!.userId}`, {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Record<string, unknown> }
    expect(json.data.userUsername).toBe('admin')
    expect(json.data.userEmail).toBe('admin@example.com')
    expect(json.data.userPassword).toBeUndefined()
    expect(json.data.gravatarHash).toBeDefined()
    expect(json.data.groupName).toBeDefined()
  })

  it('returns 404 for nonexistent user', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/99999', { headers: { Cookie: cookie } })
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/users (create)
// ---------------------------------------------------------------------------
describe('POST /api/admin/users', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUsername: 'newuser', userEmail: 'new@example.com', userGroup: 2, userPassword: 'pass123', confirmPassword: 'pass123' }),
    })
    expect(res.status).toBe(401)
  })

  it('creates user with all required fields', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'newuser1',
        userEmail: 'newuser1@example.com',
        userGroup: 2,
        userPassword: 'password123',
        confirmPassword: 'password123',
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: Record<string, unknown> }
    expect(json.data.userUsername).toBe('newuser1')
    expect(json.data.userEmail).toBe('newuser1@example.com')
    // API key should be set (32 chars)
    expect(typeof json.data.userApiKey).toBe('string')
    expect((json.data.userApiKey as string).length).toBe(32)
    // Password should not be returned
    expect(json.data.userPassword).toBeUndefined()
  })

  it('rejects blank username', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: '',
        userEmail: 'test@example.com',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error.toLowerCase()).toContain('username')
  })

  it('rejects non-alphanumeric username', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'bad user!',
        userEmail: 'test@example.com',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('alphanumeric')
  })

  it('rejects duplicate username', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'admin',
        userEmail: 'unique@example.com',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('already in use')
  })

  it('rejects blank email', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'validuser',
        userEmail: '',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error.toLowerCase()).toContain('email')
  })

  it('rejects invalid email format', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'validuser2',
        userEmail: 'not-an-email',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('email')
  })

  it('rejects duplicate email', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'uniqueuser3',
        userEmail: 'admin@example.com',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('already in use')
  })

  it('rejects missing group', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'validuser4',
        userEmail: 'valid4@example.com',
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('group')
  })

  it('rejects missing password', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'validuser5',
        userEmail: 'valid5@example.com',
        userGroup: 2,
        userPassword: '',
        confirmPassword: '',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error.toLowerCase()).toContain('password')
  })

  it('rejects mismatched password and confirm', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'validuser6',
        userEmail: 'valid6@example.com',
        userGroup: 2,
        userPassword: 'password123',
        confirmPassword: 'different456',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('match')
  })
})

// ---------------------------------------------------------------------------
// PUT /api/admin/users/:id (update)
// ---------------------------------------------------------------------------
describe('PUT /api/admin/users/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUsername: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  it('updates user fields', async () => {
    const cookie = await loginAsAdmin()
    // Get johndoe's ID
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    const res = await app.request(`/api/admin/users/${johndoe!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'johndoe',
        userEmail: 'john.updated@example.com',
        userGroup: 2,
      }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Record<string, unknown> }
    expect(json.data.userEmail).toBe('john.updated@example.com')
  })

  it('rejects changing username to an existing one', async () => {
    const cookie = await loginAsAdmin()
    // Get johndoe's ID
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    const res = await app.request(`/api/admin/users/${johndoe!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'admin', // already taken
        userEmail: 'john.updated@example.com',
        userGroup: 2,
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('already in use')
  })

  it('allows updating own username to same value (uniqueness excludes self)', async () => {
    const cookie = await loginAsAdmin()
    // Get admin's ID
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const adminUser = listJson.data.find((u) => u.userUsername === 'admin')
    expect(adminUser).toBeDefined()

    const res = await app.request(`/api/admin/users/${adminUser!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'admin', // same as existing
        userEmail: 'admin@example.com',
        userGroup: 1,
      }),
    })
    expect(res.status).toBe(200)
  })

  it('does not change password when fields are blank', async () => {
    const cookie = await loginAsAdmin()
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    // Get original password hash via DB
    const { users: usersTable } = schema
    const original = testDb.select({ pw: usersTable.userPassword }).from(usersTable)
      .where(eq(usersTable.userId, johndoe!.userId)).get()
    const originalHash = original?.pw

    const res = await app.request(`/api/admin/users/${johndoe!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'johndoe',
        userEmail: 'john.updated@example.com',
        userGroup: 2,
        userPassword: '', // blank = no change
        confirmPassword: '',
      }),
    })
    expect(res.status).toBe(200)

    const after = testDb.select({ pw: usersTable.userPassword }).from(usersTable)
      .where(eq(usersTable.userId, johndoe!.userId)).get()
    expect(after?.pw).toBe(originalHash)
  })

  it('changes password when both fields provided and match', async () => {
    const cookie = await loginAsAdmin()
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    const res = await app.request(`/api/admin/users/${johndoe!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'johndoe',
        userEmail: 'john.updated@example.com',
        userGroup: 2,
        userPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      }),
    })
    expect(res.status).toBe(200)

    // Verify the hash changed and is valid
    const { users: usersTable } = schema
    const updated = testDb.select({ pw: usersTable.userPassword }).from(usersTable)
      .where(eq(usersTable.userId, johndoe!.userId)).get()
    const valid = await Bun.password.verify('newpassword123', updated?.pw ?? '')
    expect(valid).toBe(true)
  })

  it('rejects password without confirm', async () => {
    const cookie = await loginAsAdmin()
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    const res = await app.request(`/api/admin/users/${johndoe!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'johndoe',
        userEmail: 'john.updated@example.com',
        userGroup: 2,
        userPassword: 'newpassword123',
        confirmPassword: '',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('match')
  })

  it('prevents demoting the last admin', async () => {
    const cookie = await loginAsAdmin()
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string; userGroup: number }> }
    const adminUser = listJson.data.find((u) => u.userUsername === 'admin')
    expect(adminUser).toBeDefined()

    const res = await app.request(`/api/admin/users/${adminUser!.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'admin',
        userEmail: 'admin@example.com',
        userGroup: 2, // try to demote to Registered
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('last admin')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/users/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users/999', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('deletes a user', async () => {
    const cookie = await loginAsAdmin()

    // Create a user to delete
    const createRes = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'todelete',
        userEmail: 'todelete@example.com',
        userGroup: 2,
        userPassword: 'pass123',
        confirmPassword: 'pass123',
      }),
    })
    expect(createRes.status).toBe(201)
    const createJson = await createRes.json() as { data: { userId: number } }
    const userId = createJson.data.userId

    const deleteRes = await app.request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)

    // Verify it's gone
    const getRes = await app.request(`/api/admin/users/${userId}`, {
      headers: { Cookie: cookie },
    })
    expect(getRes.status).toBe(404)
  })

  it('returns 404 for nonexistent user', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/99999', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reset-api-key
// ---------------------------------------------------------------------------
describe('POST /api/admin/users/:id/reset-api-key', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users/1/reset-api-key', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('generates a new 32-char API key different from the old one', async () => {
    const cookie = await loginAsAdmin()
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string; userApiKey: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    expect(johndoe).toBeDefined()

    const oldKey = johndoe!.userApiKey

    const res = await app.request(`/api/admin/users/${johndoe!.userId}/reset-api-key`, {
      method: 'POST',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { userApiKey: string } }
    expect(typeof json.data.userApiKey).toBe('string')
    expect(json.data.userApiKey.length).toBe(32)
    expect(json.data.userApiKey).not.toBe(oldKey)
  })
})

// ---------------------------------------------------------------------------
// User Notes: GET/POST/PUT/DELETE /api/admin/users/:id/notes
// ---------------------------------------------------------------------------
describe('User Notes API', () => {
  // Helper to get johndoe's userId
  async function getJohndoeId(cookie: string): Promise<number> {
    const listRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const listJson = await listRes.json() as { data: Array<{ userId: number; userUsername: string }> }
    const johndoe = listJson.data.find((u) => u.userUsername === 'johndoe')
    if (!johndoe) throw new Error('johndoe not found')
    return johndoe.userId
  }

  // Helper to create a note
  async function createNote(cookie: string, userId: number, note: string, noteImportant = 'n') {
    return app.request(`/api/admin/users/${userId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ note, noteImportant }),
    })
  }

  describe('GET /api/admin/users/:id/notes', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/api/admin/users/1/notes')
      expect(res.status).toBe(401)
    })

    it('returns 404 for nonexistent user', async () => {
      const cookie = await loginAsAdmin()
      const res = await app.request('/api/admin/users/99999/notes', { headers: { Cookie: cookie } })
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid user ID', async () => {
      const cookie = await loginAsAdmin()
      const res = await app.request('/api/admin/users/abc/notes', { headers: { Cookie: cookie } })
      expect(res.status).toBe(400)
    })

    it('returns empty array when user has no notes', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await app.request(`/api/admin/users/${userId}/notes`, { headers: { Cookie: cookie } })
      expect(res.status).toBe(200)
      const json = await res.json() as { data: unknown[] }
      expect(Array.isArray(json.data)).toBe(true)
    })

    it('returns notes with important notes first', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)

      // Create regular note first
      await createNote(cookie, userId, 'Regular note', 'n')
      // Then important note
      await createNote(cookie, userId, 'Important note', 'y')

      const res = await app.request(`/api/admin/users/${userId}/notes`, { headers: { Cookie: cookie } })
      expect(res.status).toBe(200)
      const json = await res.json() as { data: Array<{ note: string; noteImportant: string }> }
      expect(json.data.length).toBeGreaterThanOrEqual(2)
      // Important note should come first
      const firstImportant = json.data.findIndex((n) => n.noteImportant === 'y')
      const firstRegular = json.data.findIndex((n) => n.noteImportant === 'n')
      expect(firstImportant).toBeLessThan(firstRegular)
    })
  })

  describe('POST /api/admin/users/:id/notes', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/api/admin/users/1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'test' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 404 for nonexistent user', async () => {
      const cookie = await loginAsAdmin()
      const res = await createNote(cookie, 99999, 'test note')
      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid user ID', async () => {
      const cookie = await loginAsAdmin()
      const res = await app.request('/api/admin/users/abc/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ note: 'test' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when note text is missing', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await createNote(cookie, userId, '')
      expect(res.status).toBe(400)
      const json = await res.json() as { error: string }
      expect(json.error.toLowerCase()).toContain('note')
    })

    it('creates a note with required fields', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await createNote(cookie, userId, 'A test note')
      expect(res.status).toBe(201)
      const json = await res.json() as { data: Record<string, unknown> }
      expect(json.data.noteId).toBeDefined()
      expect(json.data.note).toBe('A test note')
      expect(json.data.noteImportant).toBe('n')
      expect(json.data.noteUserId).toBe(userId)
      expect(json.data.noteAddedBy).toBeDefined()
      expect(json.data.noteDate).toBeDefined()
    })

    it('creates an important note', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await createNote(cookie, userId, 'An important note', 'y')
      expect(res.status).toBe(201)
      const json = await res.json() as { data: { noteImportant: string } }
      expect(json.data.noteImportant).toBe('y')
    })
  })

  describe('PUT /api/admin/users/:id/notes/:noteId', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/api/admin/users/1/notes/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'updated' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 404 for nonexistent note', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await app.request(`/api/admin/users/${userId}/notes/99999`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ note: 'updated' }),
      })
      expect(res.status).toBe(404)
    })

    it('returns 400 when note text is empty', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      // First create a note
      const createRes = await createNote(cookie, userId, 'Original note')
      const createJson = await createRes.json() as { data: { noteId: number } }
      const noteId = createJson.data.noteId

      const res = await app.request(`/api/admin/users/${userId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ note: '' }),
      })
      expect(res.status).toBe(400)
    })

    it('updates note text and importance', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      // Create a regular note
      const createRes = await createNote(cookie, userId, 'Original text', 'n')
      const createJson = await createRes.json() as { data: { noteId: number } }
      const noteId = createJson.data.noteId

      const res = await app.request(`/api/admin/users/${userId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ note: 'Updated text', noteImportant: 'y' }),
      })
      expect(res.status).toBe(200)
      const json = await res.json() as { data: { note: string; noteImportant: string } }
      expect(json.data.note).toBe('Updated text')
      expect(json.data.noteImportant).toBe('y')
    })
  })

  describe('DELETE /api/admin/users/:id/notes/:noteId', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/api/admin/users/1/notes/1', { method: 'DELETE' })
      expect(res.status).toBe(401)
    })

    it('returns 404 for nonexistent note', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      const res = await app.request(`/api/admin/users/${userId}/notes/99999`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })
      expect(res.status).toBe(404)
    })

    it('deletes a note successfully', async () => {
      const cookie = await loginAsAdmin()
      const userId = await getJohndoeId(cookie)
      // Create a note to delete
      const createRes = await createNote(cookie, userId, 'Note to delete')
      const createJson = await createRes.json() as { data: { noteId: number } }
      const noteId = createJson.data.noteId

      const deleteRes = await app.request(`/api/admin/users/${userId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })
      expect(deleteRes.status).toBe(200)
      const json = await deleteRes.json() as { data: { success: boolean } }
      expect(json.data.success).toBe(true)

      // Verify it's gone - list notes and check
      const listRes = await app.request(`/api/admin/users/${userId}/notes`, { headers: { Cookie: cookie } })
      const listJson = await listRes.json() as { data: Array<{ noteId: number }> }
      const found = listJson.data.find((n) => n.noteId === noteId)
      expect(found).toBeUndefined()
    })
  })
})
