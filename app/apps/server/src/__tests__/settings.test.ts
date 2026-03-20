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
    .values([
      { optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' },
      { optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' },
      { optionName: 'site_email', optionValue: 'owner@example.com', optionGroup: 'site' },
      { optionName: 'site_keywords', optionValue: 'kb,test', optionGroup: 'site' },
      { optionName: 'site_description', optionValue: 'Test description', optionGroup: 'site' },
      { optionName: 'site_max_search', optionValue: '10', optionGroup: 'site' },
      { optionName: 'site_cache_time', optionValue: '60', optionGroup: 'site' },
      { optionName: 'site_bad_words', optionValue: 'foo,bar', optionGroup: 'site', autoLoad: 'no' },
    ])
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

describe('Admin site settings API', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/settings')
    expect(res.status).toBe(401)
  })

  it('returns 403 for admin user without can_manage_settings', async () => {
    const cookie = await login('limitedadmin', 'limited123')
    const res = await app.request('/api/admin/settings', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns current site settings for authorized admins', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/settings', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        siteName: string
        siteEmail: string
        siteMaxSearch: number
        siteCacheTime: number
      }
    }

    expect(json.data.siteName).toBe('Test KB')
    expect(json.data.siteEmail).toBe('owner@example.com')
    expect(json.data.siteMaxSearch).toBe(10)
    expect(json.data.siteCacheTime).toBe(60)
  })

  it('validates payload when updating site settings', async () => {
    const cookie = await login('admin', 'admin123')

    const res = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteName: 'Updated KB',
        siteEmail: 'not-an-email',
        siteKeywords: '',
        siteDescription: '',
        siteMaxSearch: 10,
        siteCacheTime: 0,
        siteBadWords: '',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('updates site settings and normalizes bad words', async () => {
    const cookie = await login('admin', 'admin123')

    const res = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteName: 'Updated KB',
        siteEmail: 'admin@updated.example',
        siteKeywords: 'updated,keywords',
        siteDescription: 'Updated description',
        siteMaxSearch: 25,
        siteCacheTime: 120,
        siteBadWords: ' spam, eggs ,  test  ,',
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        siteName: string
        siteEmail: string
        siteMaxSearch: number
        siteCacheTime: number
        siteBadWords: string
      }
    }

    expect(json.data.siteName).toBe('Updated KB')
    expect(json.data.siteEmail).toBe('admin@updated.example')
    expect(json.data.siteMaxSearch).toBe(25)
    expect(json.data.siteCacheTime).toBe(120)
    expect(json.data.siteBadWords).toBe('spam,eggs,test')

    const badWordsSetting = testDb
      .select({ optionValue: schema.settings.optionValue })
      .from(schema.settings)
      .where(eq(schema.settings.optionName, 'site_bad_words'))
      .get()
    expect(badWordsSetting?.optionValue).toBe('spam,eggs,test')
  })
})
