import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtempSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
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

const tmpImageDir = mkdtempSync(join(tmpdir(), 'kb-images-'))

function buildTestPng(width: number, height: number, totalSize = 64): Uint8Array {
  const size = Math.max(24, totalSize)
  const bytes = new Uint8Array(size)
  // PNG signature
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  // Width / Height in IHDR position used by our parser
  bytes[16] = (width >>> 24) & 0xff
  bytes[17] = (width >>> 16) & 0xff
  bytes[18] = (width >>> 8) & 0xff
  bytes[19] = width & 0xff
  bytes[20] = (height >>> 24) & 0xff
  bytes[21] = (height >>> 16) & 0xff
  bytes[22] = (height >>> 8) & 0xff
  bytes[23] = height & 0xff
  return bytes
}

function clearDirectoryContents(dir: string): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = resolve(dir, entry.name)
    rmSync(target, { recursive: true, force: true })
  }
}

beforeAll(async () => {
  process.env.CONTENT_IMAGE_DIR = tmpImageDir
  await mkdir(resolve(tmpImageDir, 'thumbs'), { recursive: true })

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

afterEach(async () => {
  clearDirectoryContents(tmpImageDir)
  await mkdir(resolve(tmpImageDir, 'thumbs'), { recursive: true })
})

afterAll(() => {
  rmSync(tmpImageDir, { recursive: true, force: true })
  delete process.env.CONTENT_IMAGE_DIR
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

describe('Admin image manager API', () => {
  it('requires authentication and can_manage_articles permission', async () => {
    const noSession = await app.request('/api/admin/images')
    expect(noSession.status).toBe(401)

    const limitedCookie = await login('limitedadmin', 'limited123')
    const forbidden = await app.request('/api/admin/images', {
      headers: { Cookie: limitedCookie },
    })
    expect(forbidden.status).toBe(403)
  })

  it('returns empty image list by default', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/images', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)

    const json = await res.json() as { data: { images: unknown[] } }
    expect(json.data.images.length).toBe(0)
  })

  it('rejects unsupported file type uploads', async () => {
    const cookie = await login('admin', 'admin123')
    const form = new FormData()
    form.set('image', new File([new Uint8Array([1, 2, 3])], 'bad.txt', { type: 'text/plain' }))

    const res = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it('rejects uploads larger than max byte limit', async () => {
    const cookie = await login('admin', 'admin123')
    const largePng = buildTestPng(10, 10, 120 * 1024)
    const form = new FormData()
    form.set('image', new File([largePng], 'large.png', { type: 'image/png' }))

    const res = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it('rejects uploads with dimensions larger than configured limits', async () => {
    const cookie = await login('admin', 'admin123')
    const oversized = buildTestPng(3000, 2000, 128)
    const form = new FormData()
    form.set('image', new File([oversized], 'oversized.png', { type: 'image/png' }))

    const res = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(res.status).toBe(400)
  })

  it('uploads a valid image and generates thumbnail companion', async () => {
    const cookie = await login('admin', 'admin123')
    const png = buildTestPng(200, 120, 256)
    const form = new FormData()
    form.set('image', new File([png], 'hero.png', { type: 'image/png' }))

    const res = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(res.status).toBe(201)

    const json = await res.json() as {
      data: { filename: string; thumbFilename: string; width: number; height: number }
    }
    expect(json.data.filename).toBe('hero.png')
    expect(json.data.thumbFilename).toBe('hero_thumb.png')
    expect(json.data.width).toBe(200)
    expect(json.data.height).toBe(120)

    const sourcePath = resolve(tmpImageDir, json.data.filename)
    const thumbPath = resolve(tmpImageDir, 'thumbs', json.data.thumbFilename)
    expect(existsSync(sourcePath)).toBe(true)
    expect(existsSync(thumbPath)).toBe(true)
  })

  it('lists uploaded images with thumbnail metadata', async () => {
    const cookie = await login('admin', 'admin123')
    const png = buildTestPng(120, 60, 256)
    const form = new FormData()
    form.set('image', new File([png], 'list-test.png', { type: 'image/png' }))

    const uploadRes = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(uploadRes.status).toBe(201)

    const res = await app.request('/api/admin/images', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)

    const json = await res.json() as {
      data: {
        images: Array<{
          filename: string
          hasThumbnail: boolean
          width: number | null
          height: number | null
        }>
      }
    }
    const item = json.data.images.find((entry) => entry.filename === 'list-test.png')
    expect(item).toBeDefined()
    expect(item?.hasThumbnail).toBe(true)
    expect(item?.width).toBe(120)
    expect(item?.height).toBe(60)
  })

  it('regenerates thumbnail for an existing image', async () => {
    const cookie = await login('admin', 'admin123')
    const png = buildTestPng(90, 90, 256)
    const form = new FormData()
    form.set('image', new File([png], 'regen.png', { type: 'image/png' }))

    const uploadRes = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(uploadRes.status).toBe(201)

    const uploadJson = await uploadRes.json() as {
      data: { filename: string; thumbFilename: string }
    }

    const thumbPath = resolve(tmpImageDir, 'thumbs', uploadJson.data.thumbFilename)
    await unlink(thumbPath)
    expect(existsSync(thumbPath)).toBe(false)

    const regenRes = await app.request('/api/admin/images/thumbnail', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: uploadJson.data.filename }),
    })
    expect(regenRes.status).toBe(200)
    expect(existsSync(thumbPath)).toBe(true)
  })

  it('deletes image and its thumbnail', async () => {
    const cookie = await login('admin', 'admin123')
    const png = buildTestPng(64, 64, 128)
    const form = new FormData()
    form.set('image', new File([png], 'delete-me.png', { type: 'image/png' }))

    const uploadRes = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(uploadRes.status).toBe(201)

    const sourcePath = resolve(tmpImageDir, 'delete-me.png')
    const thumbPath = resolve(tmpImageDir, 'thumbs', 'delete-me_thumb.png')
    expect(statSync(sourcePath).isFile()).toBe(true)
    expect(statSync(thumbPath).isFile()).toBe(true)

    const deleteRes = await app.request('/api/admin/images/delete-me.png', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)
    expect(existsSync(sourcePath)).toBe(false)
    expect(existsSync(thumbPath)).toBe(false)
  })

  it('returns 404 when deleting non-existent image', async () => {
    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/images/missing.png', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })
})
