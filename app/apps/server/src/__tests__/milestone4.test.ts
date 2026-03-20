import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { and, eq, gte } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
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

beforeAll(async () => {
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

  const adminHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const userHash = await Bun.password.hash('user123', { algorithm: 'bcrypt', cost: 12 })
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
        userEmail: 'user@example.com',
        userUsername: 'normaluser',
        userPassword: userHash,
        userGroup: 2,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'userapikey1234567890123456789012345',
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

afterEach(() => {
  testDb.delete(schema.failedLogins).run()
})

async function login(username: string, password: string, ip = '127.0.0.1'): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': ip,
    },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(`Login failed: ${json.error ?? res.status}`)
  }
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) throw new Error('No session cookie set after login')
  return cookies[cookies.length - 1].split(';')[0]
}

describe('Milestone 4 — User Groups CRUD', () => {
  it('creates, reads, updates, and deletes a non-system user group', async () => {
    const cookie = await login('admin', 'admin123')

    const createRes = await app.request('/api/admin/usergroups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        groupName: 'Support Team',
        groupDescription: 'Handles tickets',
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
      }),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json() as { data: { groupId: number; groupName: string } }
    expect(created.data.groupName).toBe('Support Team')

    const getRes = await app.request(`/api/admin/usergroups/${created.data.groupId}`, {
      headers: { Cookie: cookie },
    })
    expect(getRes.status).toBe(200)

    const updateRes = await app.request(`/api/admin/usergroups/${created.data.groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        groupName: 'Support Team Updated',
        groupDescription: 'Updated desc',
        canViewSite: 'y',
        canAccessAdmin: 'y',
        canManageArticles: 'y',
        canDeleteArticles: 'n',
        canManageUsers: 'n',
        canManageCategories: 'n',
        canDeleteCategories: 'n',
        canManageSettings: 'n',
        canManageUtilities: 'n',
        canManageThemes: 'n',
        canManageModules: 'n',
      }),
    })
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json() as { data: { groupName: string; canManageArticles: string } }
    expect(updated.data.groupName).toBe('Support Team Updated')
    expect(updated.data.canManageArticles).toBe('y')

    const deleteRes = await app.request(`/api/admin/usergroups/${created.data.groupId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)
  })

  it('blocks deleting system groups 1-5', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/usergroups/1', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
  })
})

describe('Milestone 4 — RBAC enforcement', () => {
  it('denies limited-admin access to permission-gated admin modules', async () => {
    const cookie = await login('limitedadmin', 'limited123')

    const articleRes = await app.request('/api/admin/articles', { headers: { Cookie: cookie } })
    const userRes = await app.request('/api/admin/users', { headers: { Cookie: cookie } })
    const groupRes = await app.request('/api/admin/usergroups', { headers: { Cookie: cookie } })
    const categoryRes = await app.request('/api/admin/categories', { headers: { Cookie: cookie } })
    const glossaryRes = await app.request('/api/admin/glossary', { headers: { Cookie: cookie } })
    const settingsRes = await app.request('/api/admin/settings', { headers: { Cookie: cookie } })
    const modulesRes = await app.request('/api/admin/modules', { headers: { Cookie: cookie } })
    const utilitiesRes = await app.request('/api/admin/utilities', { headers: { Cookie: cookie } })

    expect(articleRes.status).toBe(403)
    expect(userRes.status).toBe(403)
    expect(groupRes.status).toBe(403)
    expect(categoryRes.status).toBe(403)
    expect(glossaryRes.status).toBe(403)
    expect(settingsRes.status).toBe(403)
    expect(modulesRes.status).toBe(403)
    expect(utilitiesRes.status).toBe(403)
  })
})

describe('Milestone 4 — Public profile and account', () => {
  it('returns public profile by username', async () => {
    const res = await app.request('/api/users/profile/admin')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { username: string; groupName: string } }
    expect(json.data.username).toBe('admin')
    expect(json.data.groupName).toBe('Site Admins')
  })

  it('returns 400 for invalid public profile username', async () => {
    const res = await app.request('/api/users/profile/invalid!name')
    expect(res.status).toBe(400)
  })

  it('gets and updates authenticated account settings', async () => {
    const cookie = await login('normaluser', 'user123')

    const meRes = await app.request('/api/auth/account', { headers: { Cookie: cookie } })
    expect(meRes.status).toBe(200)
    const me = await meRes.json() as { data: { userEmail: string; userUsername: string } }
    expect(me.data.userEmail).toBe('user@example.com')

    const updateRes = await app.request('/api/auth/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        userUsername: 'normaluser2',
        userEmail: 'updated@example.com',
        userPassword: 'newpass123',
        confirmPassword: 'newpass123',
      }),
    })
    expect(updateRes.status).toBe(200)

    const updatedUser = testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.userUsername, 'normaluser2'))
      .get()
    expect(updatedUser?.userEmail).toBe('updated@example.com')

    // Restore username/email for other tests in this file
    testDb
      .update(schema.users)
      .set({ userUsername: 'normaluser', userEmail: 'user@example.com' })
      .where(eq(schema.users.userId, updatedUser!.userId))
      .run()
  })
})

describe('Milestone 4 — Failed login tracking', () => {
  it('records failed attempts and exposes admin IP summaries', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb
      .insert(schema.failedLogins)
      .values([
        { failedUsername: 'admin', failedIp: '10.0.0.1', failedDate: now - 10 },
        { failedUsername: 'admin', failedIp: '10.0.0.1', failedDate: now - 8 },
        { failedUsername: 'admin', failedIp: '10.0.0.1', failedDate: now - 5 },
      ])
      .run()

    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/users/failed-logins', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ failedIp: string; attempts: number; status: string }> }
    expect(json.data[0]?.failedIp).toBe('10.0.0.1')
    expect(json.data[0]?.attempts).toBeGreaterThanOrEqual(3)
    expect(json.data[0]?.status).toBe('delay30')
  })

  it('applies 30-second progressive throttle after 3 failed attempts', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb
      .insert(schema.failedLogins)
      .values([
        { failedUsername: 'admin', failedIp: '20.0.0.1', failedDate: now - 10 },
        { failedUsername: 'admin', failedIp: '20.0.0.1', failedDate: now - 8 },
        { failedUsername: 'admin', failedIp: '20.0.0.1', failedDate: now - 5 },
      ])
      .run()

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '20.0.0.1' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })

    expect(res.status).toBe(429)
    const json = await res.json() as { retryAfterSeconds: number }
    expect(json.retryAfterSeconds).toBeGreaterThan(0)
    expect(json.retryAfterSeconds).toBeLessThanOrEqual(30)
  })

  it('applies lockout after 10 failed attempts in the last 24h', async () => {
    const now = Math.floor(Date.now() / 1000)
    const rows = Array.from({ length: 10 }).map((_, idx) => ({
      failedUsername: 'admin',
      failedIp: '30.0.0.1',
      failedDate: now - idx,
    }))
    testDb.insert(schema.failedLogins).values(rows).run()

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '30.0.0.1' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })

    expect(res.status).toBe(429)
    const json = await res.json() as { retryAfterSeconds: number }
    expect(json.retryAfterSeconds).toBeGreaterThan(60)

    const stillRecent = testDb
      .select()
      .from(schema.failedLogins)
      .where(and(eq(schema.failedLogins.failedIp, '30.0.0.1'), gte(schema.failedLogins.failedDate, now - 86400)))
      .all()
    expect(stillRecent.length).toBeGreaterThanOrEqual(10)
  })
})
