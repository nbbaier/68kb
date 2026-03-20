import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
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

const tmpThemesDir = mkdtempSync(join(tmpdir(), 'kb-themes-'))

beforeAll(async () => {
  process.env.THEMES_DIR = tmpThemesDir

  mkdirSync(join(tmpThemesDir, 'default'), { recursive: true })
  mkdirSync(join(tmpThemesDir, 'broken-theme'), { recursive: true })
  writeFileSync(join(tmpThemesDir, 'default', 'layout.php'), '<?php echo "layout"; ?>')

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
      { optionName: 'site_theme', optionValue: 'default', optionGroup: 'site' },
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

afterAll(() => {
  rmSync(tmpThemesDir, { recursive: true, force: true })
  delete process.env.THEMES_DIR
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

describe('Admin theme management API', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/themes')
    expect(res.status).toBe(401)
  })

  it('returns 403 for admin user without can_manage_themes', async () => {
    const cookie = await login('limitedadmin', 'limited123')
    const res = await app.request('/api/admin/themes', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('lists themes with layout validation and active marker', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/themes', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: {
        activeTheme: string
        themes: Array<{ directory: string; hasLayout: boolean; isActive: boolean }>
      }
    }

    expect(json.data.activeTheme).toBe('default')

    const defaultTheme = json.data.themes.find((theme) => theme.directory === 'default')
    expect(defaultTheme).toBeDefined()
    expect(defaultTheme?.hasLayout).toBe(true)
    expect(defaultTheme?.isActive).toBe(true)

    const brokenTheme = json.data.themes.find((theme) => theme.directory === 'broken-theme')
    expect(brokenTheme).toBeDefined()
    expect(brokenTheme?.hasLayout).toBe(false)
  })

  it('rejects activating invalid theme without layout.php', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/themes/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'broken-theme' }),
    })

    expect(res.status).toBe(400)
  })

  it('activates valid theme and persists site_theme setting', async () => {
    mkdirSync(join(tmpThemesDir, 'second-theme'), { recursive: true })
    writeFileSync(join(tmpThemesDir, 'second-theme', 'layout.php'), '<?php echo "layout2"; ?>')

    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/themes/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'second-theme' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json() as { data: { activeTheme: string } }
    expect(json.data.activeTheme).toBe('second-theme')

    const row = testDb
      .select({ optionValue: schema.settings.optionValue })
      .from(schema.settings)
      .where(eq(schema.settings.optionName, 'site_theme'))
      .get()
    expect(row?.optionValue).toBe('second-theme')
  })
})
