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
testSqlite.exec('PRAGMA journal_mode = WAL')
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
  ])
  .run()

// Seed settings
testDb
  .insert(schema.settings)
  .values({ optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' })
  .run()

// Set session secret for tests
process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const app = createApp(testDb as typeof testDb)

// Seed admin user
beforeAll(async () => {
  const adminPasswordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)
  testDb
    .insert(schema.users)
    .values({
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
    })
    .run()
})

// ---------------------------------------------------------------------------
// Helper: extract Set-Cookie header from login response
// ---------------------------------------------------------------------------
async function loginAsAdmin(): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) throw new Error('No session cookie set after login')
  const lastCookie = cookies[cookies.length - 1]
  return lastCookie.split(';')[0]
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------
describe('GET /api/admin/stats', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/stats')
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 200 with version and userCount when authenticated as admin', async () => {
    const sessionCookie = await loginAsAdmin()

    const res = await app.request('/api/admin/stats', {
      headers: { Cookie: sessionCookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(json.data.version).toBe('1.0.0')
    expect(typeof json.data.userCount).toBe('number')
    expect(json.data.userCount).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// GET /api/auth/me (updated to include permissions)
// ---------------------------------------------------------------------------
describe('GET /api/auth/me (with permissions)', () => {
  it('returns permissions object for admin user', async () => {
    const sessionCookie = await loginAsAdmin()

    const res = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.permissions).toBeDefined()
    expect(json.data.permissions.canAccessAdmin).toBe(true)
    expect(json.data.permissions.canManageArticles).toBe(true)
    expect(json.data.permissions.canManageUsers).toBe(true)
    expect(json.data.permissions.canManageSettings).toBe(true)
    expect(json.data.permissions.canManageModules).toBe(true)
    // Should NOT return password
    expect(json.data.userPassword).toBeUndefined()
  })
})
