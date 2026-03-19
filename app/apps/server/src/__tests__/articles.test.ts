import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { createApp } from '../app'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle')
const TEMP_UPLOADS_DIR = resolve(__dirname, '../../test-uploads-' + Date.now())

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
  ])
  .run()

testDb
  .insert(schema.settings)
  .values({ optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' })
  .run()

// Set session secret for tests
process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'
// Override uploads dir to temp location
process.env.UPLOADS_DIR = TEMP_UPLOADS_DIR

const app = createApp(testDb as typeof testDb)

// Seed admin user and test data
beforeAll(async () => {
  await mkdir(TEMP_UPLOADS_DIR, { recursive: true })

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
        userGroup: 1,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'testjohnapikey1234567890123456789',
        userVerify: '',
      },
    ])
    .run()

  // Seed categories
  testDb
    .insert(schema.categories)
    .values([
      { catId: 1, catName: 'PHP', catUri: 'php', catDisplay: 'yes' },
      { catId: 2, catName: 'JavaScript', catUri: 'javascript', catDisplay: 'yes' },
    ])
    .run()
})

afterAll(async () => {
  // Clean up temp uploads dir
  await rm(TEMP_UPLOADS_DIR, { recursive: true, force: true })
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
  const lastCookie = cookies[cookies.length - 1]
  return lastCookie.split(';')[0]
}

// ---------------------------------------------------------------------------
// GET /api/admin/articles
// ---------------------------------------------------------------------------
describe('GET /api/admin/articles', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/articles')
    expect(res.status).toBe(401)
  })

  it('returns paginated article list for admin', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(Array.isArray(json.data)).toBe(true)
    expect(typeof json.total).toBe('number')
    expect(typeof json.page).toBe('number')
  })

  it('returns articles with category names', async () => {
    // Seed an article with a category
    const now = Math.floor(Date.now() / 1000)
    const [art] = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Categorized Article',
        articleUri: 'categorized-article',
        articleDate: now,
        articleModified: now,
      })
      .returning()
      .all()
    testDb.insert(schema.article2cat).values({ articleIdRel: art.articleId, categoryIdRel: 1 }).run()

    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    const found = json.data.find((a: { articleId: number }) => a.articleId === art.articleId)
    expect(found).toBeDefined()
    expect(found.categories).toBeDefined()
    expect(Array.isArray(found.categories)).toBe(true)
    expect(found.categories.length).toBeGreaterThan(0)
    expect(found.categories[0].catName).toBe('PHP')

    // Cleanup
    testDb.delete(schema.article2cat).run()
    testDb.delete(schema.articles).run()
  })

  it('filters articles by search term', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb.insert(schema.articles).values([
      { articleTitle: 'React Hooks Guide', articleUri: 'react-hooks', articleDate: now, articleModified: now },
      { articleTitle: 'Vue Composition API', articleUri: 'vue-composition', articleDate: now, articleModified: now },
    ]).run()

    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles?search=react', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.every((a: { articleTitle: string }) => a.articleTitle.toLowerCase().includes('react'))).toBe(true)

    // Cleanup
    testDb.delete(schema.articles).run()
  })

  it('sorts articles by title ascending', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb.insert(schema.articles).values([
      { articleTitle: 'Zebra Article', articleUri: 'zebra', articleDate: now, articleModified: now },
      { articleTitle: 'Alpha Article', articleUri: 'alpha', articleDate: now, articleModified: now },
    ]).run()

    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles?sort=title&order=asc', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    const titles = json.data.map((a: { articleTitle: string }) => a.articleTitle)
    // Should be sorted ascending
    const sorted = [...titles].sort()
    expect(titles).toEqual(sorted)

    // Cleanup
    testDb.delete(schema.articles).run()
  })

  it('paginates results', async () => {
    const now = Math.floor(Date.now() / 1000)
    const values = Array.from({ length: 5 }, (_, i) => ({
      articleTitle: `Article ${i + 1}`,
      articleUri: `article-${i + 1}`,
      articleDate: now,
      articleModified: now,
    }))
    testDb.insert(schema.articles).values(values).run()

    const cookie = await loginAsAdmin()
    const res1 = await app.request('/api/admin/articles?page=1&limit=2', {
      headers: { Cookie: cookie },
    })
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.data.length).toBe(2)
    expect(json1.total).toBeGreaterThanOrEqual(5)
    expect(json1.page).toBe(1)

    const res2 = await app.request('/api/admin/articles?page=2&limit=2', {
      headers: { Cookie: cookie },
    })
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.data.length).toBe(2)
    expect(json2.page).toBe(2)
    // Page 2 should have different articles than page 1
    const ids1 = new Set(json1.data.map((a: { articleId: number }) => a.articleId))
    const ids2 = json2.data.map((a: { articleId: number }) => a.articleId)
    expect(ids2.some((id: number) => ids1.has(id))).toBe(false)

    // Cleanup
    testDb.delete(schema.articles).run()
  })

  it('filters by display status', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb.insert(schema.articles).values([
      { articleTitle: 'Visible Article', articleUri: 'visible', articleDisplay: 'y', articleDate: now, articleModified: now },
      { articleTitle: 'Hidden Article', articleUri: 'hidden', articleDisplay: 'n', articleDate: now, articleModified: now },
    ]).run()

    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles?display=y', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.every((a: { articleDisplay: string }) => a.articleDisplay === 'y')).toBe(true)

    // Cleanup
    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/articles/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/articles/:id', () => {
  it('returns 404 for non-existent article', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/99999', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 400 for invalid ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/abc', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
  })

  it('returns article with categories, tags, attachments, and author', async () => {
    const now = Math.floor(Date.now() / 1000)
    const [art] = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Detail Article',
        articleUri: 'detail-article',
        articleKeywords: 'php, testing',
        articleAuthor: 1,
        articleDate: now,
        articleModified: now,
      })
      .returning()
      .all()

    testDb.insert(schema.article2cat).values({ articleIdRel: art.articleId, categoryIdRel: 1 }).run()

    // Create tags manually for this test
    const [tag1] = testDb.insert(schema.tags).values({ tag: 'php' }).returning().all()
    testDb.insert(schema.articleTags).values({ tagsTagId: tag1.id, tagsArticleId: art.articleId }).run()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.articleTitle).toBe('Detail Article')
    expect(Array.isArray(json.data.categories)).toBe(true)
    expect(json.data.categories.length).toBe(1)
    expect(json.data.categories[0].catName).toBe('PHP')
    expect(Array.isArray(json.data.tags)).toBe(true)
    expect(json.data.tags.length).toBe(1)
    expect(json.data.tags[0].tag).toBe('php')
    expect(Array.isArray(json.data.attachments)).toBe(true)
    expect(json.data.author).toBeDefined()
    expect(json.data.author.username).toBe('admin')

    // Cleanup
    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.article2cat).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/articles
// ---------------------------------------------------------------------------
describe('POST /api/admin/articles', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    })
    expect(res.status).toBe(401)
  })

  it('creates article with minimum required fields (title)', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'My First Article' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.articleTitle).toBe('My First Article')
    expect(json.data.articleId).toBeDefined()

    // Cleanup
    testDb.delete(schema.articles).run()
  })

  it('auto-generates URI from title when URI is not provided', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Auto URI Article' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.articleUri).toBe('auto-uri-article')

    testDb.delete(schema.articles).run()
  })

  it('returns 400 when title is missing', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'no-title' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Title')
  })

  it('returns 400 when title is empty string', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Title')
  })

  it('returns 400 for URI with invalid characters (alpha-dash validation)', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Valid Title', uri: 'invalid uri!' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('URI')
  })

  it('accepts valid URI with hyphens and underscores', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Valid URI Article', uri: 'valid-uri_article123' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.articleUri).toBe('valid-uri_article123')

    testDb.delete(schema.articles).run()
  })

  it('returns 400 for non-numeric order', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Article', order: 'abc' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('numeric')
  })

  it('creates article with categories and associates them', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'PHP Article',
        categories: [1, 2],
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    const articleId = json.data.articleId

    // Check junction table
    const links = testDb.select().from(schema.article2cat)
      .where(eq(schema.article2cat.articleIdRel, articleId)).all()
    expect(links.length).toBe(2)

    testDb.delete(schema.article2cat).run()
    testDb.delete(schema.articles).run()
  })

  it('creates tags from keywords and links them', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Tagged Article',
        keywords: 'react, javascript, testing',
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    const articleId = json.data.articleId

    // Check tags created
    const tagLinks = testDb.select().from(schema.articleTags)
      .where(eq(schema.articleTags.tagsArticleId, articleId)).all()
    expect(tagLinks.length).toBe(3)

    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.articles).run()
  })

  it('reuses existing tags (no duplicates)', async () => {
    // Pre-create a tag
    const [existingTag] = testDb.insert(schema.tags).values({ tag: 'php' }).returning().all()

    const cookie = await loginAsAdmin()
    // Create two articles with same keyword
    const res1 = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Article A', keywords: 'php' }),
    })
    const res2 = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Article B', keywords: 'php' }),
    })
    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)

    // Should only have ONE tag row for 'php' (the pre-created one)
    const phpTags = testDb.select().from(schema.tags)
      .where(eq(schema.tags.tag, 'php')).all()
    expect(phpTags.length).toBe(1)
    expect(phpTags[0].id).toBe(existingTag.id)

    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.articles).run()
  })

  it('sets article_date and article_modified timestamps', async () => {
    const before = Math.floor(Date.now() / 1000)
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Timestamp Test' }),
    })
    const after = Math.floor(Date.now() / 1000)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.articleDate).toBeGreaterThanOrEqual(before)
    expect(json.data.articleDate).toBeLessThanOrEqual(after)
    expect(json.data.articleModified).toBeGreaterThanOrEqual(before)
    expect(json.data.articleModified).toBeLessThanOrEqual(after)

    testDb.delete(schema.articles).run()
  })

  it('sets article_author from session user', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Author Test Article' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    // Admin user has userId=1
    expect(json.data.articleAuthor).toBeGreaterThan(0)

    testDb.delete(schema.articles).run()
  })

  it('creates article with all fields', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Full Article',
        uri: 'full-article',
        shortDesc: '<p>Short</p>',
        description: '<p>Full</p>',
        display: 'y',
        keywords: 'fullstack, testing',
        order: 5,
        categories: [1],
        author: 1,
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.articleTitle).toBe('Full Article')
    expect(json.data.articleUri).toBe('full-article')
    expect(json.data.articleShortDesc).toBe('<p>Short</p>')
    expect(json.data.articleDescription).toBe('<p>Full</p>')
    expect(json.data.articleDisplay).toBe('y')
    expect(json.data.articleKeywords).toBe('fullstack, testing')
    expect(json.data.articleOrder).toBe(5)
    expect(json.data.articleAuthor).toBe(1)

    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.article2cat).run()
    testDb.delete(schema.articles).run()
  })

  it('does not 500 when keywords contain duplicate entries (regression)', async () => {
    const cookie = await loginAsAdmin()
    // Duplicate keywords like "php, php, testing" must not cause a composite PK collision
    const res = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Duplicate Keywords Article', keywords: 'php, php, testing' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    const articleId = json.data.articleId

    // Should have exactly 2 unique tag links (php + testing), not 3
    const tagLinks = testDb.select().from(schema.articleTags)
      .where(eq(schema.articleTags.tagsArticleId, articleId)).all()
    expect(tagLinks.length).toBe(2)

    // Only one tag row for 'php' should exist
    const phpTags = testDb.select().from(schema.tags)
      .where(eq(schema.tags.tag, 'php')).all()
    expect(phpTags.length).toBe(1)

    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// PUT /api/admin/articles/:id
// ---------------------------------------------------------------------------
describe('PUT /api/admin/articles/:id', () => {
  it('returns 404 for non-existent article', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/99999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Updated' }),
    })
    expect(res.status).toBe(404)
  })

  it('updates article title and updates modified timestamp', async () => {
    const now = Math.floor(Date.now() / 1000) - 100
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Original Title',
      articleUri: 'original',
      articleDate: now,
      articleModified: now,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Updated Title' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.articleTitle).toBe('Updated Title')
    expect(json.data.articleModified).toBeGreaterThan(now)

    testDb.delete(schema.articles).run()
  })

  it('returns 400 when title is cleared (empty string)', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Article to Edit',
      articleUri: 'article-to-edit',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: '' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Title')

    // Article should not be modified
    const unchanged = testDb.select().from(schema.articles)
      .where(eq(schema.articles.articleId, art.articleId)).get()
    expect(unchanged?.articleTitle).toBe('Article to Edit')

    testDb.delete(schema.articles).run()
  })

  it('returns 400 for invalid URI in update', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'URI Validate Test',
      articleUri: 'uri-validate',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'has spaces!' }),
    })
    expect(res.status).toBe(400)

    testDb.delete(schema.articles).run()
  })

  it('updates categories (removes old, adds new)', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Cat Update Test',
      articleUri: 'cat-update',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()
    testDb.insert(schema.article2cat).values({ articleIdRel: art.articleId, categoryIdRel: 1 }).run()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ categories: [2] }),
    })
    expect(res.status).toBe(200)

    const links = testDb.select().from(schema.article2cat)
      .where(eq(schema.article2cat.articleIdRel, art.articleId)).all()
    expect(links.length).toBe(1)
    expect(links[0].categoryIdRel).toBe(2)

    testDb.delete(schema.article2cat).run()
    testDb.delete(schema.articles).run()
  })

  it('can change URI to a valid value', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'URI Change Test',
      articleUri: 'old-uri',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ uri: 'new-uri-slug' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.articleUri).toBe('new-uri-slug')

    testDb.delete(schema.articles).run()
  })

  it('returns 400 for non-numeric order in update', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Order Validate',
      articleUri: 'order-validate',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ order: 'not-a-number' }),
    })
    expect(res.status).toBe(400)

    testDb.delete(schema.articles).run()
  })

  it('does not 500 when keywords contain duplicate entries on update (regression)', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Dup Keywords Update',
      articleUri: 'dup-keywords-update',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    // Updating with duplicate keywords must not cause a composite PK collision
    const res = await app.request(`/api/admin/articles/${art.articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ keywords: 'javascript, javascript, react' }),
    })
    expect(res.status).toBe(200)

    // Should have exactly 2 unique tag links (javascript + react), not 3
    const tagLinks = testDb.select().from(schema.articleTags)
      .where(eq(schema.articleTags.tagsArticleId, art.articleId)).all()
    expect(tagLinks.length).toBe(2)

    testDb.delete(schema.articleTags).run()
    testDb.delete(schema.tags).run()
    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/articles/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/articles/:id', () => {
  it('returns 404 for non-existent article', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/99998', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid ID', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/xyz', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
  })

  it('deletes article and cascades: article2cat, article_tags, attachments', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Delete Me',
      articleUri: 'delete-me',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()
    const artId = art.articleId

    // Add associations
    testDb.insert(schema.article2cat).values({ articleIdRel: artId, categoryIdRel: 1 }).run()
    const [tag] = testDb.insert(schema.tags).values({ tag: 'cascade-test' }).returning().all()
    testDb.insert(schema.articleTags).values({ tagsTagId: tag.id, tagsArticleId: artId }).run()
    testDb.insert(schema.attachments).values({
      articleId: artId,
      attachFile: 'nonexistent.txt',
      attachTitle: 'Test',
      attachType: 'text/plain',
      attachSize: '10',
    }).run()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${artId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(true)
    expect(json.data.articleId).toBe(artId)

    // Check DB cascade
    const remainingArticle = testDb.select().from(schema.articles)
      .where(eq(schema.articles.articleId, artId)).get()
    expect(remainingArticle).toBeUndefined()

    const remainingCat = testDb.select().from(schema.article2cat)
      .where(eq(schema.article2cat.articleIdRel, artId)).all()
    expect(remainingCat.length).toBe(0)

    const remainingTags = testDb.select().from(schema.articleTags)
      .where(eq(schema.articleTags.tagsArticleId, artId)).all()
    expect(remainingTags.length).toBe(0)

    const remainingAttachments = testDb.select().from(schema.attachments)
      .where(eq(schema.attachments.articleId, artId)).all()
    expect(remainingAttachments.length).toBe(0)

    // Cleanup tags
    testDb.delete(schema.tags).run()
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/articles/:id/attachments
// ---------------------------------------------------------------------------
describe('POST /api/admin/articles/:id/attachments', () => {
  it('returns 404 for non-existent article', async () => {
    const cookie = await loginAsAdmin()
    const formData = new FormData()
    formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }))
    const res = await app.request('/api/admin/articles/99997/attachments', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })
    expect(res.status).toBe(404)
  })

  it('uploads a file and creates attachment record', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Attachment Article',
      articleUri: 'attachment-article',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const formData = new FormData()
    formData.append('file', new File(['PDF content'], 'document.pdf', { type: 'application/pdf' }))
    formData.append('title', 'My Document')

    const res = await app.request(`/api/admin/articles/${art.articleId}/attachments`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.attachTitle).toBe('My Document')
    expect(json.data.attachType).toContain('pdf')
    expect(json.data.attachFile).toBeDefined()
    expect(json.data.articleId).toBe(art.articleId)

    testDb.delete(schema.attachments).run()
    testDb.delete(schema.articles).run()
  })

  it('returns 400 for disallowed file type', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Invalid Upload Article',
      articleUri: 'invalid-upload',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const formData = new FormData()
    formData.append('file', new File(['content'], 'malware.exe', { type: 'application/octet-stream' }))
    formData.append('title', 'Malware')

    const res = await app.request(`/api/admin/articles/${art.articleId}/attachments`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('not allowed')

    // No attachment record should be created
    const records = testDb.select().from(schema.attachments)
      .where(eq(schema.attachments.articleId, art.articleId)).all()
    expect(records.length).toBe(0)

    testDb.delete(schema.articles).run()
  })

  it('returns 200 with null data when no file is selected', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'No File Article',
      articleUri: 'no-file',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()

    const cookie = await loginAsAdmin()
    const formData = new FormData()
    formData.append('title', 'No File')
    // No file appended

    const res = await app.request(`/api/admin/articles/${art.articleId}/attachments`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeNull()

    // No attachment record
    const records = testDb.select().from(schema.attachments)
      .where(eq(schema.attachments.articleId, art.articleId)).all()
    expect(records.length).toBe(0)

    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/articles/:id/attachments/:attachId
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/articles/:id/attachments/:attachId', () => {
  it('returns 404 for non-existent attachment', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/articles/1/attachments/99996', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('deletes attachment record', async () => {
    const [art] = testDb.insert(schema.articles).values({
      articleTitle: 'Attachment Delete Test',
      articleUri: 'attach-delete-test',
      articleDate: 0,
      articleModified: 0,
    }).returning().all()
    const [attach] = testDb.insert(schema.attachments).values({
      articleId: art.articleId,
      attachFile: 'nonexistent-file.txt',
      attachTitle: 'Nonexistent',
      attachType: 'text/plain',
      attachSize: '5',
    }).returning().all()

    const cookie = await loginAsAdmin()
    const res = await app.request(`/api/admin/articles/${art.articleId}/attachments/${attach.attachId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.deleted).toBe(true)
    expect(json.data.attachId).toBe(attach.attachId)

    // Verify DB record removed
    const remaining = testDb.select().from(schema.attachments)
      .where(eq(schema.attachments.attachId, attach.attachId)).get()
    expect(remaining).toBeUndefined()

    testDb.delete(schema.articles).run()
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/users/search
// ---------------------------------------------------------------------------
describe('GET /api/admin/users/search', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/users/search?q=admin')
    expect(res.status).toBe(401)
  })

  it('returns matching users by username', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/search?q=admin', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    const found = json.data.find((u: { username: string }) => u.username === 'admin')
    expect(found).toBeDefined()
    expect(found.userId).toBeDefined()
    expect(found.email).toBeDefined()
  })

  it('returns matching users by email', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/search?q=john@example', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    const found = json.data.find((u: { username: string }) => u.username === 'johndoe')
    expect(found).toBeDefined()
  })

  it('returns empty array for no matches', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/search?q=zzznomatch999', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })

  it('returns empty array for empty query', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/users/search?q=', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })
})
