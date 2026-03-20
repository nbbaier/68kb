import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
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

const tmpThemesDir = mkdtempSync(join(tmpdir(), 'kb-m5-themes-'))
const tmpAddonsDir = mkdtempSync(join(tmpdir(), 'kb-m5-addons-'))
const tmpImagesDir = mkdtempSync(join(tmpdir(), 'kb-m5-images-'))

let baseCategoryId = 0
let uniqueCounter = 0

function uniqueToken(prefix: string): string {
  uniqueCounter += 1
  return `${prefix}-${Date.now()}-${uniqueCounter}`
}

function uniqueUsername(prefix: string): string {
  uniqueCounter += 1
  return `${prefix}${Date.now()}${uniqueCounter}`
}

function buildTestPng(width: number, height: number, totalSize = 64): ArrayBuffer {
  const size = Math.max(24, totalSize)
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes[16] = (width >>> 24) & 0xff
  bytes[17] = (width >>> 16) & 0xff
  bytes[18] = (width >>> 8) & 0xff
  bytes[19] = width & 0xff
  bytes[20] = (height >>> 24) & 0xff
  bytes[21] = (height >>> 16) & 0xff
  bytes[22] = (height >>> 8) & 0xff
  bytes[23] = height & 0xff
  return bytes.buffer
}

function getSessionCookie(res: Response): string {
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) {
    throw new Error('No session cookie set')
  }
  return cookies[cookies.length - 1].split(';')[0]
}

async function login(username: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`)
  }
  return getSessionCookie(res)
}

async function registerUser(username: string, email: string, password: string): Promise<{ cookie: string; userId: number }> {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (res.status !== 201) {
    const text = await res.text()
    throw new Error(`Register failed: ${res.status} ${text}`)
  }
  const json = await res.json() as { data: { userId: number } }
  return {
    cookie: getSessionCookie(res),
    userId: json.data.userId,
  }
}

async function createArticle(
  cookie: string,
  opts: {
    title?: string
    uri?: string
    shortDesc?: string
    description?: string
    keywords?: string
    display?: 'y' | 'n'
  } = {},
): Promise<{ articleId: number; uri: string }> {
  const token = uniqueToken('article')
  const uri = opts.uri ?? `m5-${token}`
  const payload = {
    title: opts.title ?? `M5 Article ${token}`,
    uri,
    shortDesc: opts.shortDesc ?? `Short ${token}`,
    description: opts.description ?? `<p>Description ${token}</p>`,
    display: opts.display ?? 'y',
    keywords: opts.keywords ?? `m5,${token}`,
    order: 1,
    categories: [baseCategoryId],
  }

  const res = await app.request('/api/admin/articles', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (res.status !== 201) {
    const text = await res.text()
    throw new Error(`Create article failed: ${res.status} ${text}`)
  }

  const json = await res.json() as { data: { articleId: number } }
  return { articleId: json.data.articleId, uri }
}

async function postComment(
  articleId: number,
  payload: { author: string; email: string; content: string },
  cookie?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-real-ip': '10.5.5.5',
  }
  if (cookie) headers.Cookie = cookie

  return app.request(`/api/comments/article/${articleId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
}

beforeAll(async () => {
  process.env.THEMES_DIR = tmpThemesDir
  process.env.ADDONS_DIR = tmpAddonsDir
  process.env.CONTENT_IMAGE_DIR = tmpImagesDir

  mkdirSync(join(tmpThemesDir, 'default'), { recursive: true })
  mkdirSync(join(tmpThemesDir, 'sunrise'), { recursive: true })
  writeFileSync(join(tmpThemesDir, 'default', 'layout.php'), '<?php echo "default"; ?>')
  writeFileSync(join(tmpThemesDir, 'sunrise', 'layout.php'), '<?php echo "sunrise"; ?>')

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

  await mkdir(resolve(tmpImagesDir, 'thumbs'), { recursive: true })

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
      { optionName: 'site_bad_words', optionValue: '', optionGroup: 'site', autoLoad: 'no' },
      { optionName: 'site_theme', optionValue: 'default', optionGroup: 'site' },
    ])
    .run()

  const adminHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)

  testDb
    .insert(schema.users)
    .values({
      userIp: '127.0.0.1',
      userEmail: 'admin@example.com',
      userUsername: 'admin',
      userPassword: adminHash,
      userGroup: 1,
      userJoinDate: now,
      userLastLogin: now,
      lastActivity: now,
      userCookie: '',
      userSession: '',
      userApiKey: 'adminapikey123456789012345678901234',
      userVerify: '',
    })
    .run()

  const category = testDb
    .insert(schema.categories)
    .values({
      catName: 'General',
      catUri: 'general',
      catDisplay: 'yes',
      catOrder: 1,
      catParent: 0,
    })
    .returning({ catId: schema.categories.catId })
    .get()

  if (!category) {
    throw new Error('Failed to seed base category')
  }
  baseCategoryId = category.catId
})

afterAll(() => {
  rmSync(tmpThemesDir, { recursive: true, force: true })
  rmSync(tmpAddonsDir, { recursive: true, force: true })
  rmSync(tmpImagesDir, { recursive: true, force: true })
  delete process.env.THEMES_DIR
  delete process.env.ADDONS_DIR
  delete process.env.CONTENT_IMAGE_DIR
})

describe('Milestone 5 — Cross-area flows', () => {
  it('article lifecycle: create, update, publish, and delete via admin/public APIs', async () => {
    const cookie = await login('admin', 'admin123')
    const token = uniqueToken('life')
    const uri = `m5-life-${token}`

    const created = await createArticle(cookie, {
      title: `Lifecycle ${token}`,
      uri,
      description: `<p>Lifecycle body ${token}</p>`,
      keywords: `m5-life,${token}`,
    })

    const publicRes = await app.request(`/api/articles/${uri}`)
    expect(publicRes.status).toBe(200)

    const updateRes = await app.request(`/api/admin/articles/${created.articleId}`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Lifecycle Updated ${token}`,
        shortDesc: `Updated short ${token}`,
        description: `<p>Updated body ${token}</p>`,
        display: 'y',
        keywords: `m5-life-updated,${token}`,
        categories: [baseCategoryId],
      }),
    })
    expect(updateRes.status).toBe(200)

    const deleteRes = await app.request(`/api/admin/articles/${created.articleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)

    const afterRes = await app.request(`/api/articles/${uri}`)
    expect(afterRes.status).toBe(404)
  })

  it('user registration through profile and account update flow', async () => {
    const username = uniqueUsername('m5reg')
    const email = `${username}@example.com`
    const nextUsername = uniqueUsername('m5acct')
    const nextEmail = `${nextUsername}@example.com`

    const registration = await registerUser(username, email, 'pass12345')

    const meRes = await app.request('/api/auth/me', {
      headers: { Cookie: registration.cookie },
    })
    expect(meRes.status).toBe(200)
    const me = await meRes.json() as { data: { username: string; userGroup: number } }
    expect(me.data.username).toBe(username)
    expect(me.data.userGroup).toBe(2)

    const profileRes = await app.request(`/api/users/profile/${username}`)
    expect(profileRes.status).toBe(200)

    const accountRes = await app.request('/api/auth/account', {
      method: 'PUT',
      headers: {
        Cookie: registration.cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userUsername: nextUsername,
        userEmail: nextEmail,
      }),
    })
    expect(accountRes.status).toBe(200)

    const oldProfileRes = await app.request(`/api/users/profile/${username}`)
    expect(oldProfileRes.status).toBe(404)

    const newProfileRes = await app.request(`/api/users/profile/${nextUsername}`)
    expect(newProfileRes.status).toBe(200)
  })

  it('admin workflow spans comments moderation and image manager actions', async () => {
    const cookie = await login('admin', 'admin123')
    const token = uniqueToken('workflow')
    const created = await createArticle(cookie, {
      title: `Workflow ${token}`,
      uri: `m5-workflow-${token}`,
    })

    const commentRes = await postComment(created.articleId, {
      author: 'Workflow Guest',
      email: `workflow-${token}@example.com`,
      content: 'Pending moderation comment',
    })
    expect(commentRes.status).toBe(201)
    const commentJson = await commentRes.json() as { data: { status: string } }
    expect(commentJson.data.status).toBe('0')

    const listRes = await app.request(`/api/admin/comments?status=0&articleId=${created.articleId}`, {
      headers: { Cookie: cookie },
    })
    expect(listRes.status).toBe(200)
    const listJson = await listRes.json() as { data: Array<{ commentId: number }> }
    expect(listJson.data.length).toBeGreaterThan(0)
    const commentId = listJson.data[0].commentId

    const approveRes = await app.request(`/api/admin/comments/${commentId}/status`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: '1' }),
    })
    expect(approveRes.status).toBe(200)

    const publicCommentsRes = await app.request(`/api/comments/article/${created.articleId}`)
    expect(publicCommentsRes.status).toBe(200)
    const publicCommentsJson = await publicCommentsRes.json() as { total: number }
    expect(publicCommentsJson.total).toBeGreaterThan(0)

    const imageBytes = buildTestPng(64, 64, 256)
    const imageName = `workflow-${token}.png`
    const form = new FormData()
    form.set('image', new File([imageBytes], imageName, { type: 'image/png' }))

    const uploadRes = await app.request('/api/admin/images/upload', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })
    expect(uploadRes.status).toBe(201)
    const uploadJson = await uploadRes.json() as { data: { filename: string } }

    const regenRes = await app.request('/api/admin/images/thumbnail', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: uploadJson.data.filename }),
    })
    expect(regenRes.status).toBe(200)

    const deleteImageRes = await app.request(`/api/admin/images/${encodeURIComponent(uploadJson.data.filename)}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteImageRes.status).toBe(200)
  })

  it('search indexing flow reflects updated article content', async () => {
    const cookie = await login('admin', 'admin123')
    const token = uniqueToken('search')
    const keyword = `m5-index-${token}`

    const created = await createArticle(cookie, {
      title: `Indexed ${keyword}`,
      uri: `m5-index-${token}`,
      shortDesc: `Indexed short ${keyword}`,
      description: `<p>Indexed body ${keyword}</p>`,
      keywords: `search,${keyword}`,
    })

    const searchRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword }),
    })
    expect(searchRes.status).toBe(200)
    const searchJson = await searchRes.json() as { data: { hash?: string; noResults?: boolean } }
    expect(searchJson.data.noResults).not.toBe(true)
    expect(searchJson.data.hash).toBeDefined()

    const resultsRes = await app.request(`/api/search/results/${searchJson.data.hash!}`)
    expect(resultsRes.status).toBe(200)
    const resultsJson = await resultsRes.json() as {
      data: { articles: Array<{ articleId: number }> }
    }
    expect(resultsJson.data.articles.some((item) => item.articleId === created.articleId)).toBe(true)

    const updateRes = await app.request(`/api/admin/articles/${created.articleId}`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Updated ${token}`,
        shortDesc: `Updated short ${token}`,
        description: `<p>Updated body ${token}</p>`,
        keywords: `updated,${token}`,
        categories: [baseCategoryId],
      }),
    })
    expect(updateRes.status).toBe(200)

    const searchAfterRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword }),
    })
    expect(searchAfterRes.status).toBe(200)
    const searchAfterJson = await searchAfterRes.json() as { data: { noResults?: boolean } }
    expect(searchAfterJson.data.noResults).toBe(true)
  })

  it('theme and addon flows coexist without conflict', async () => {
    const cookie = await login('admin', 'admin123')

    const activateCoreRes = await app.request('/api/admin/modules/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'core_mod' }),
    })
    expect(activateCoreRes.status).toBe(200)

    const activateDependentRes = await app.request('/api/admin/modules/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleDirectory: 'dependent_mod' }),
    })
    expect(activateDependentRes.status).toBe(200)

    const activateThemeRes = await app.request('/api/admin/themes/activate', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'sunrise' }),
    })
    expect(activateThemeRes.status).toBe(200)

    const themesRes = await app.request('/api/admin/themes', {
      headers: { Cookie: cookie },
    })
    expect(themesRes.status).toBe(200)
    const themesJson = await themesRes.json() as { data: { activeTheme: string } }
    expect(themesJson.data.activeTheme).toBe('sunrise')

    const modulesRes = await app.request('/api/admin/modules', {
      headers: { Cookie: cookie },
    })
    expect(modulesRes.status).toBe(200)
    const modulesJson = await modulesRes.json() as {
      data: Array<{ moduleDirectory: string; moduleActive: 'yes' | 'no' }>
    }
    const core = modulesJson.data.find((row) => row.moduleDirectory === 'core_mod')
    const dependent = modulesJson.data.find((row) => row.moduleDirectory === 'dependent_mod')
    expect(core?.moduleActive).toBe('yes')
    expect(dependent?.moduleActive).toBe('yes')
  })

  it('settings propagation updates public settings and search page-size defaults', async () => {
    const cookie = await login('admin', 'admin123')
    const token = uniqueToken('settings')
    const siteName = `M5 Site ${token}`
    const siteDescription = `Description ${token}`
    const keyword = `m5-prop-${token}`

    const updateSettingsRes = await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteName,
        siteEmail: `owner-${token}@example.com`,
        siteKeywords: `kb,${token}`,
        siteDescription,
        siteMaxSearch: 1,
        siteCacheTime: 60,
        siteBadWords: '',
      }),
    })
    expect(updateSettingsRes.status).toBe(200)

    const publicSettingsRes = await app.request('/api/settings/public')
    expect(publicSettingsRes.status).toBe(200)
    const publicSettingsJson = await publicSettingsRes.json() as {
      data: { siteName: string; siteDescription: string }
    }
    expect(publicSettingsJson.data.siteName).toBe(siteName)
    expect(publicSettingsJson.data.siteDescription).toBe(siteDescription)

    await createArticle(cookie, {
      title: `Propagation A ${token}`,
      uri: `m5-prop-a-${token}`,
      keywords: `propagation,${keyword}`,
      description: `<p>${keyword}</p>`,
    })
    await createArticle(cookie, {
      title: `Propagation B ${token}`,
      uri: `m5-prop-b-${token}`,
      keywords: `propagation,${keyword}`,
      description: `<p>${keyword}</p>`,
    })

    const searchRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword }),
    })
    expect(searchRes.status).toBe(200)
    const searchJson = await searchRes.json() as { data: { hash?: string; noResults?: boolean } }
    expect(searchJson.data.noResults).not.toBe(true)
    expect(searchJson.data.hash).toBeDefined()

    const resultsRes = await app.request(`/api/search/results/${searchJson.data.hash!}`)
    expect(resultsRes.status).toBe(200)
    const resultsJson = await resultsRes.json() as {
      data: {
        total: number
        limit: number
        articles: unknown[]
      }
    }
    expect(resultsJson.data.total).toBeGreaterThanOrEqual(2)
    expect(resultsJson.data.limit).toBe(1)
    expect(resultsJson.data.articles.length).toBe(1)
  })

  it('guest-to-user flow auto-approves returning commenter after moderation', async () => {
    const adminCookie = await login('admin', 'admin123')
    const token = uniqueToken('guest')
    const email = `guest-${token}@example.com`

    const created = await createArticle(adminCookie, {
      title: `Guest to User ${token}`,
      uri: `m5-guest-${token}`,
    })

    const firstCommentRes = await postComment(created.articleId, {
      author: 'Guest User',
      email,
      content: 'First comment before registration',
    })
    expect(firstCommentRes.status).toBe(201)
    const firstCommentJson = await firstCommentRes.json() as { data: { status: string } }
    expect(firstCommentJson.data.status).toBe('0')

    const pendingRes = await app.request(`/api/admin/comments?status=0&articleId=${created.articleId}`, {
      headers: { Cookie: adminCookie },
    })
    expect(pendingRes.status).toBe(200)
    const pendingJson = await pendingRes.json() as { data: Array<{ commentId: number }> }
    expect(pendingJson.data.length).toBeGreaterThan(0)

    const approveRes = await app.request(`/api/admin/comments/${pendingJson.data[0].commentId}/status`, {
      method: 'PUT',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: '1' }),
    })
    expect(approveRes.status).toBe(200)

    const username = uniqueUsername('m5guest')
    const registration = await registerUser(username, email, 'pass12345')

    const secondCommentRes = await postComment(
      created.articleId,
      {
        author: username,
        email,
        content: 'Second comment after registration',
      },
      registration.cookie,
    )
    expect(secondCommentRes.status).toBe(201)
    const secondCommentJson = await secondCommentRes.json() as { data: { status: string } }
    expect(secondCommentJson.data.status).toBe('1')

    const publicCommentsRes = await app.request(`/api/comments/article/${created.articleId}`)
    expect(publicCommentsRes.status).toBe(200)
    const publicCommentsJson = await publicCommentsRes.json() as {
      data: Array<{ commentContent: string }>
    }
    expect(
      publicCommentsJson.data.some((entry) => entry.commentContent.includes('Second comment after registration')),
    ).toBe(true)
  })

  it('data integrity flow keeps junction/child tables clean after article deletion', async () => {
    const cookie = await login('admin', 'admin123')
    const token = uniqueToken('integrity')
    const keyword = `m5-integrity-${token}`

    const created = await createArticle(cookie, {
      title: `Integrity ${token}`,
      uri: `m5-integrity-${token}`,
      keywords: `integrity,${keyword}`,
      description: `<p>${keyword}</p>`,
    })

    const attachmentForm = new FormData()
    attachmentForm.set('title', 'Proof')
    attachmentForm.set(
      'file',
      new File([new TextEncoder().encode('integrity proof')], 'proof.txt', { type: 'text/plain' }),
    )
    const attachmentRes = await app.request(`/api/admin/articles/${created.articleId}/attachments`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: attachmentForm,
    })
    expect(attachmentRes.status).toBe(201)

    const commentRes = await postComment(created.articleId, {
      author: 'Integrity Guest',
      email: `integrity-${token}@example.com`,
      content: 'Comment to verify cascade cleanup',
    })
    expect(commentRes.status).toBe(201)

    const searchRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword }),
    })
    expect(searchRes.status).toBe(200)

    const deleteRes = await app.request(`/api/admin/articles/${created.articleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)

    const articleRow = testDb
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.articleId, created.articleId))
      .get()
    expect(articleRow).toBeUndefined()

    const categoryLinks = testDb
      .select()
      .from(schema.article2cat)
      .where(eq(schema.article2cat.articleIdRel, created.articleId))
      .all()
    expect(categoryLinks.length).toBe(0)

    const tagLinks = testDb
      .select()
      .from(schema.articleTags)
      .where(eq(schema.articleTags.tagsArticleId, created.articleId))
      .all()
    expect(tagLinks.length).toBe(0)

    const attachmentRows = testDb
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.articleId, created.articleId))
      .all()
    expect(attachmentRows.length).toBe(0)

    const commentRows = testDb
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.commentArticleId, created.articleId))
      .all()
    expect(commentRows.length).toBe(0)

    const searchAfterRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keyword }),
    })
    expect(searchAfterRes.status).toBe(200)
    const searchAfterJson = await searchAfterRes.json() as { data: { noResults?: boolean } }
    expect(searchAfterJson.data.noResults).toBe(true)
  })
})
