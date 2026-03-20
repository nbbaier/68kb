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

const tmpAddonsDir = mkdtempSync(join(tmpdir(), 'kb-addons-'))

beforeAll(async () => {
  process.env.ADDONS_DIR = tmpAddonsDir

  const coreDir = join(tmpAddonsDir, 'core_mod')
  mkdirSync(coreDir, { recursive: true })
  writeFileSync(
    join(coreDir, 'core_mod_config.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<module name="core_mod">
  <title>Core Module</title>
  <description>Core addon</description>
  <version>v1.0.0</version>
  <order>100</order>
</module>`,
  )
  writeFileSync(
    join(coreDir, 'core_mod_extension.php'),
    `<?php
class Core_mod_extension {
  public function __construct($modules) {
    $modules->register('template/build', $this, 'onBuild');
    $modules->register('admin/home', $this, 'onAdmin');
  }
}`,
  )

  const dependentDir = join(tmpAddonsDir, 'dependent_mod')
  mkdirSync(dependentDir, { recursive: true })
  writeFileSync(
    join(dependentDir, 'dependent_mod_config.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<module name="dependent_mod">
  <title>Dependent Module</title>
  <description>Depends on core_mod</description>
  <version>v1.0.0</version>
  <order>110</order>
  <dependencies>
    <required>
      <module>core_mod</module>
    </required>
  </dependencies>
</module>`,
  )

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
  rmSync(tmpAddonsDir, { recursive: true, force: true })
  delete process.env.ADDONS_DIR
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

describe('Admin module/addon management API', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/modules')
    expect(res.status).toBe(401)
  })

  it('returns 403 for admin user without can_manage_modules', async () => {
    const cookie = await login('limitedadmin', 'limited123')
    const res = await app.request('/api/admin/modules', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('lists discoverable modules with hook events and dependencies', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/modules', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      data: Array<{
        moduleDirectory: string
        hookEvents: string[]
        requiredDependencies: string[]
      }>
    }

    const core = json.data.find((item) => item.moduleDirectory === 'core_mod')
    expect(core).toBeDefined()
    expect(core?.hookEvents).toContain('template/build')
    expect(core?.hookEvents).toContain('admin/home')

    const dependent = json.data.find((item) => item.moduleDirectory === 'dependent_mod')
    expect(dependent).toBeDefined()
    expect(dependent?.requiredDependencies).toEqual(['core_mod'])
  })

  it('blocks activation when required dependencies are missing', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/modules/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'dependent_mod' }),
    })

    expect(res.status).toBe(400)
    const json = await res.json() as { missingRequiredDependencies?: string[] }
    expect(json.missingRequiredDependencies).toContain('core_mod')
  })

  it('activates a module and persists it to modules table', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/modules/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })

    expect(res.status).toBe(200)
    const row = testDb
      .select()
      .from(schema.modules)
      .where(eq(schema.modules.moduleDirectory, 'core_mod'))
      .get()
    expect(row).toBeDefined()
    expect(row?.moduleActive).toBe('yes')
  })

  it('allows activating a dependent module once dependency is active', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/modules/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'dependent_mod' }),
    })

    expect(res.status).toBe(200)
  })

  it('blocks deactivation and uninstall when active dependents exist', async () => {
    const cookie = await login('admin', 'admin123')

    const deactivateRes = await app.request('/api/admin/modules/deactivate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })
    expect(deactivateRes.status).toBe(400)

    const uninstallRes = await app.request('/api/admin/modules/uninstall', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })
    expect(uninstallRes.status).toBe(400)
  })

  it('uninstalls dependent module, then allows deactivation and uninstall of dependency', async () => {
    const cookie = await login('admin', 'admin123')

    const uninstallDependent = await app.request('/api/admin/modules/uninstall', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'dependent_mod' }),
    })
    expect(uninstallDependent.status).toBe(200)

    const deactivateCore = await app.request('/api/admin/modules/deactivate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })
    expect(deactivateCore.status).toBe(200)

    const uninstallCore = await app.request('/api/admin/modules/uninstall', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })
    expect(uninstallCore.status).toBe(200)

    const coreRow = testDb
      .select()
      .from(schema.modules)
      .where(eq(schema.modules.moduleDirectory, 'core_mod'))
      .get()
    expect(coreRow).toBeUndefined()
  })
})
