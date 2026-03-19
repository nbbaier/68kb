import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
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
  ])
  .run()

// Seed settings
testDb
  .insert(schema.settings)
  .values([
    { optionName: 'site_name', optionValue: 'Test Knowledge Base', optionGroup: 'site' },
    { optionName: 'site_max_search', optionValue: '10', optionGroup: 'site' },
  ])
  .run()

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const app = createApp(testDb as typeof testDb)

// ---------------------------------------------------------------------------
// Seed categories for search tests
// ---------------------------------------------------------------------------
const now = Math.floor(Date.now() / 1000)

const phpCat = testDb
  .insert(schema.categories)
  .values({ catName: 'PHP', catUri: 'php', catDisplay: 'yes', catOrder: 1 })
  .returning({ catId: schema.categories.catId })
  .get()!

const jsCat = testDb
  .insert(schema.categories)
  .values({ catName: 'JavaScript', catUri: 'javascript', catDisplay: 'yes', catOrder: 2 })
  .returning({ catId: schema.categories.catId })
  .get()!

const phpOopCat = testDb
  .insert(schema.categories)
  .values({
    catName: 'PHP OOP',
    catUri: 'php/oop',
    catParent: phpCat.catId,
    catDisplay: 'yes',
    catOrder: 1,
  })
  .returning({ catId: schema.categories.catId })
  .get()!

const hiddenCat = testDb
  .insert(schema.categories)
  .values({ catName: 'Hidden', catUri: 'hidden', catDisplay: 'no', catOrder: 99 })
  .returning({ catId: schema.categories.catId })
  .get()!

// Seed articles
const artPhp = testDb
  .insert(schema.articles)
  .values({
    articleTitle: 'Introduction to PHP',
    articleUri: 'intro-to-php',
    articleShortDesc: 'Learn PHP basics',
    articleDescription: '<p>PHP is a server-side scripting language.</p>',
    articleKeywords: 'php, scripting',
    articleDisplay: 'y',
    articleHits: 100,
    articleDate: now - 2000,
    articleModified: now - 1000,
  })
  .returning({ articleId: schema.articles.articleId })
  .get()!

const artJs = testDb
  .insert(schema.articles)
  .values({
    articleTitle: 'JavaScript Tutorial',
    articleUri: 'js-tutorial',
    articleShortDesc: 'Learn JavaScript',
    articleDescription: '<p>JavaScript is a front-end language.</p>',
    articleKeywords: 'javascript, frontend',
    articleDisplay: 'y',
    articleHits: 50,
    articleDate: now - 1000,
    articleModified: now - 500,
  })
  .returning({ articleId: schema.articles.articleId })
  .get()!

const artOop = testDb
  .insert(schema.articles)
  .values({
    articleTitle: 'PHP OOP Guide',
    articleUri: 'php-oop-guide',
    articleShortDesc: 'Object-oriented PHP programming',
    articleDescription: '<p>OOP in PHP lets you use classes and objects.</p>',
    articleKeywords: 'php, oop, classes',
    articleDisplay: 'y',
    articleHits: 75,
    articleDate: now - 500,
    articleModified: now - 200,
  })
  .returning({ articleId: schema.articles.articleId })
  .get()!

const artHidden = testDb
  .insert(schema.articles)
  .values({
    articleTitle: 'Hidden Article About PHP',
    articleUri: 'hidden-php-article',
    articleShortDesc: 'This article is hidden',
    articleDescription: '<p>Content about PHP.</p>',
    articleKeywords: 'php',
    articleDisplay: 'n',
    articleHits: 0,
    articleDate: now,
    articleModified: now,
  })
  .returning({ articleId: schema.articles.articleId })
  .get()!

// Link articles to categories
testDb.insert(schema.article2cat).values({ articleIdRel: artPhp.articleId, categoryIdRel: phpCat.catId }).run()
testDb.insert(schema.article2cat).values({ articleIdRel: artJs.articleId, categoryIdRel: jsCat.catId }).run()
testDb.insert(schema.article2cat).values({ articleIdRel: artOop.articleId, categoryIdRel: phpOopCat.catId }).run()
testDb.insert(schema.article2cat).values({ articleIdRel: artHidden.articleId, categoryIdRel: phpCat.catId }).run()

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------
describe('POST /api/search', () => {
  it('returns noResults when keywords and categoryId are both empty', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.noResults).toBe(true)
  })

  it('returns noResults for whitespace-only keywords', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: '   ' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.noResults).toBe(true)
  })

  it('returns hash and total for matching keywords', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hash).toBeDefined()
    expect(typeof json.data.hash).toBe('string')
    expect(json.data.hash).toHaveLength(32)
    expect(json.data.total).toBeGreaterThan(0)
  })

  it('excludes hidden articles from results', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'Hidden Article About PHP' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    // The hidden article should not appear in search results
    expect(json.data.noResults).toBe(true)
  })

  it('searches in article_title field', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'JavaScript Tutorial' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hash).toBeDefined()
    expect(json.data.total).toBeGreaterThanOrEqual(1)
  })

  it('searches in article_short_desc field', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'Object-oriented PHP programming' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hash).toBeDefined()
    expect(json.data.total).toBeGreaterThanOrEqual(1)
  })

  it('searches in article_description field', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'server-side scripting' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hash).toBeDefined()
    expect(json.data.total).toBeGreaterThanOrEqual(1)
  })

  it('filters by categoryId', async () => {
    // Only PHP category articles
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP', categoryId: phpCat.catId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hash).toBeDefined()
    // Should find PHP articles
    expect(json.data.total).toBeGreaterThanOrEqual(1)
  })

  it('includes descendant categories when filtering', async () => {
    // PHP category should include PHP OOP sub-category articles
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP', categoryId: phpCat.catId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.total).toBeGreaterThanOrEqual(2) // artPhp + artOop (via phpOopCat descendant)
  })

  it('returns noResults when category filter returns no matches', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'JavaScript', categoryId: phpCat.catId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.noResults).toBe(true)
  })

  it('logs to searchlog table when keywords provided', async () => {
    const beforeCount = testDb
      .select({ cnt: schema.searchLog.searchlogId })
      .from(schema.searchLog)
      .all().length

    await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP scripting' }),
    })

    const logs = testDb
      .select()
      .from(schema.searchLog)
      .all()

    expect(logs.length).toBeGreaterThan(beforeCount)
    const latestLog = logs[logs.length - 1]
    expect(latestLog.searchlogTerm).toBe('PHP scripting')
    expect(latestLog.searchlogDate).toBeGreaterThan(0)
  })

  it('does not log to searchlog when keywords is empty', async () => {
    const beforeLogs = testDb.select().from(schema.searchLog).all()
    const beforeCount = beforeLogs.length

    await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const afterLogs = testDb.select().from(schema.searchLog).all()
    expect(afterLogs.length).toBe(beforeCount)
  })

  it('stores search hash in search cache table', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'Tutorial' }),
    })
    const json = await res.json()
    const hash = json.data.hash

    const cached = testDb
      .select()
      .from(schema.searchCache)
      .all()
      .find((r) => r.searchId === hash)

    expect(cached).toBeDefined()
    expect(cached!.searchDate).toBeGreaterThan(0)
    expect(cached!.searchTotal).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/search/results/:hash
// ---------------------------------------------------------------------------
describe('GET /api/search/results/:hash', () => {
  let validHash: string
  let validTotal: number

  beforeAll(async () => {
    // Create a search to get a hash
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP' }),
    })
    const json = await res.json()
    validHash = json.data.hash
    validTotal = json.data.total
  })

  it('returns results for valid hash', async () => {
    const res = await app.request(`/api/search/results/${validHash}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.articles).toBeDefined()
    expect(Array.isArray(json.data.articles)).toBe(true)
    expect(json.data.total).toBe(validTotal)
  })

  it('returns article fields including uri and title', async () => {
    const res = await app.request(`/api/search/results/${validHash}`)
    const json = await res.json()
    const articles = json.data.articles
    expect(articles.length).toBeGreaterThan(0)
    expect(articles[0]).toHaveProperty('articleUri')
    expect(articles[0]).toHaveProperty('articleTitle')
  })

  it('returns pagination info', async () => {
    const res = await app.request(`/api/search/results/${validHash}?page=1&limit=10`)
    const json = await res.json()
    expect(json.data.page).toBe(1)
    expect(json.data.limit).toBe(10)
    expect(json.data.total).toBeDefined()
  })

  it('returns 404 for non-existent hash', async () => {
    const res = await app.request('/api/search/results/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 404 for wrong-length hash (too short)', async () => {
    const res = await app.request('/api/search/results/tooshort')
    expect(res.status).toBe(404)
  })

  it('returns 404 for wrong-length hash (too long)', async () => {
    const res = await app.request('/api/search/results/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6extra')
    expect(res.status).toBe(404)
  })

  it('returns 404 for expired hash', async () => {
    // Insert an expired search record (> 1 hour old)
    const expiredTime = Math.floor(Date.now() / 1000) - 3700 // 61+ minutes ago
    const expiredHash = 'aaaa1111bbbb2222cccc3333dddd4444'
    testDb
      .insert(schema.searchCache)
      .values({
        searchId: expiredHash,
        searchDate: expiredTime,
        searchKeywords: JSON.stringify({ keywords: 'PHP', categoryId: null }),
        searchTotal: 1,
        searchUserId: 0,
        searchIp: '127.0.0.1',
      })
      .run()

    const res = await app.request(`/api/search/results/${expiredHash}`)
    expect(res.status).toBe(404)
  })

  it('paginates results correctly', async () => {
    // Create multiple articles to test pagination
    const paginationDb = new Database(':memory:')
    paginationDb.exec('PRAGMA foreign_keys = ON')
    const pDb = drizzle({ client: paginationDb, schema })
    migrate(pDb, { migrationsFolder: MIGRATIONS_FOLDER })

    pDb.insert(schema.userGroups).values({
      groupId: 1, groupName: 'Admins', groupDescription: '', canViewSite: 'y', canAccessAdmin: 'y',
    }).run()
    pDb.insert(schema.settings).values({ optionName: 'site_name', optionValue: 'Test', optionGroup: 'site' }).run()
    pDb.insert(schema.settings).values({ optionName: 'site_max_search', optionValue: '2', optionGroup: 'site' }).run()

    // Create 5 articles all matching "pagination test"
    for (let i = 1; i <= 5; i++) {
      pDb.insert(schema.articles).values({
        articleTitle: `Pagination Test Article ${i}`,
        articleUri: `pagination-test-${i}`,
        articleShortDesc: 'A pagination test article',
        articleDescription: '<p>Content for pagination testing.</p>',
        articleDisplay: 'y',
        articleDate: Math.floor(Date.now() / 1000) - i * 100,
        articleModified: Math.floor(Date.now() / 1000),
      }).run()
    }

    const pApp = createApp(pDb as typeof pDb)

    // Execute search
    const searchRes = await pApp.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'Pagination Test Article' }),
    })
    const searchJson = await searchRes.json()
    expect(searchJson.data.total).toBe(5)

    const hash = searchJson.data.hash

    // Page 1
    const page1Res = await pApp.request(`/api/search/results/${hash}?page=1&limit=2`)
    const page1Json = await page1Res.json()
    expect(page1Json.data.articles.length).toBe(2)
    expect(page1Json.data.total).toBe(5)

    // Page 2
    const page2Res = await pApp.request(`/api/search/results/${hash}?page=2&limit=2`)
    const page2Json = await page2Res.json()
    expect(page2Json.data.articles.length).toBe(2)
    const page1Uris = page1Json.data.articles.map((a: { articleUri: string }) => a.articleUri)
    const page2Uris = page2Json.data.articles.map((a: { articleUri: string }) => a.articleUri)
    expect(page1Uris).not.toEqual(page2Uris)
  })
})

// ---------------------------------------------------------------------------
// Cleanup of expired search results
// ---------------------------------------------------------------------------
describe('Search cache cleanup', () => {
  it('cleans up search results older than 1 hour on POST /api/search', async () => {
    // Insert expired records directly
    const expiredTime = Math.floor(Date.now() / 1000) - 3700
    testDb
      .insert(schema.searchCache)
      .values({
        searchId: 'cleanup111222333444555666777888aa',
        searchDate: expiredTime,
        searchKeywords: JSON.stringify({ keywords: 'old search', categoryId: null }),
        searchTotal: 1,
        searchUserId: 0,
        searchIp: '127.0.0.1',
      })
      .run()

    // Trigger new search (which should clean up)
    await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'PHP' }),
    })

    // Expired record should be gone
    const expired = testDb
      .select()
      .from(schema.searchCache)
      .all()
      .find((r) => r.searchId === 'cleanup111222333444555666777888aa')

    expect(expired).toBeUndefined()
  })
})
