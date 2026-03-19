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
    { optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' },
  ])
  .run()

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const app = createApp(testDb as typeof testDb)

// ---------------------------------------------------------------------------
// GET /api/categories
// ---------------------------------------------------------------------------
describe('GET /api/categories', () => {
  it('returns empty array when no categories exist', async () => {
    const res = await app.request('/api/categories')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })

  it('returns visible categories with article counts', async () => {
    // Seed categories
    const cat1 = testDb
      .insert(schema.categories)
      .values({ catName: 'PHP', catUri: 'php', catDisplay: 'yes', catOrder: 1 })
      .returning({ catId: schema.categories.catId })
      .get()!

    const cat2 = testDb
      .insert(schema.categories)
      .values({ catName: 'JavaScript', catUri: 'javascript', catDisplay: 'yes', catOrder: 2 })
      .returning({ catId: schema.categories.catId })
      .get()!

    // Hidden category — should not appear
    testDb
      .insert(schema.categories)
      .values({ catName: 'Hidden', catUri: 'hidden', catDisplay: 'no' })
      .run()

    // Seed articles
    const now = Math.floor(Date.now() / 1000)
    const art1 = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Intro to PHP',
        articleUri: 'intro-to-php',
        articleDisplay: 'y',
        articleHits: 100,
        articleDate: now - 1000,
      })
      .returning({ articleId: schema.articles.articleId })
      .get()!

    const art2 = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'PHP OOP',
        articleUri: 'php-oop',
        articleDisplay: 'y',
        articleHits: 50,
        articleDate: now - 500,
      })
      .returning({ articleId: schema.articles.articleId })
      .get()!

    // Hidden article — should NOT count toward category article count
    const art3 = testDb
      .insert(schema.articles)
      .values({
        articleTitle: 'Hidden Article',
        articleUri: 'hidden-article',
        articleDisplay: 'n',
        articleHits: 0,
        articleDate: now,
      })
      .returning({ articleId: schema.articles.articleId })
      .get()!

    // Link articles to categories
    testDb.insert(schema.article2cat).values({ articleIdRel: art1.articleId, categoryIdRel: cat1.catId }).run()
    testDb.insert(schema.article2cat).values({ articleIdRel: art2.articleId, categoryIdRel: cat1.catId }).run()
    testDb.insert(schema.article2cat).values({ articleIdRel: art3.articleId, categoryIdRel: cat1.catId }).run() // hidden art in cat1
    testDb.insert(schema.article2cat).values({ articleIdRel: art1.articleId, categoryIdRel: cat2.catId }).run()

    const res = await app.request('/api/categories')
    expect(res.status).toBe(200)
    const json = await res.json()
    const data = json.data as Array<{
      catId: number
      catName: string
      catDisplay: string
      articleCount: number
      depth: number
    }>

    // Only visible categories returned
    expect(data.some((c) => c.catName === 'Hidden')).toBe(false)

    const phpCat = data.find((c) => c.catName === 'PHP')
    expect(phpCat).toBeDefined()
    // art1 + art2 are visible, art3 is hidden — count should be 2
    expect(phpCat?.articleCount).toBe(2)

    const jsCat = data.find((c) => c.catName === 'JavaScript')
    expect(jsCat).toBeDefined()
    expect(jsCat?.articleCount).toBe(1)
  })

  it('returns hierarchical tree with depth', async () => {
    // Get php cat id via query
    const allCats = testDb.select().from(schema.categories).all()
    const phpCat = allCats.find((c) => c.catUri === 'php')
    if (!phpCat) return

    testDb
      .insert(schema.categories)
      .values({
        catName: 'PHP Basics',
        catUri: 'php/basics',
        catDisplay: 'yes',
        catParent: phpCat.catId,
        catOrder: 1,
      })
      .run()

    const res = await app.request('/api/categories')
    const json = await res.json()
    const data = json.data as Array<{ catName: string; depth: number; catParent: number }>

    const child = data.find((c) => c.catName === 'PHP Basics')
    expect(child).toBeDefined()
    expect(child?.depth).toBe(1)

    const parent = data.find((c) => c.catName === 'PHP')
    expect(parent).toBeDefined()
    expect(parent?.depth).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/articles/popular
// ---------------------------------------------------------------------------
describe('GET /api/articles/popular', () => {
  it('returns empty array when no articles exist in a fresh DB', async () => {
    // Use fresh DB
    const freshSqlite = new Database(':memory:')
    freshSqlite.exec('PRAGMA foreign_keys = ON')
    const freshDb = drizzle({ client: freshSqlite, schema })
    migrate(freshDb, { migrationsFolder: MIGRATIONS_FOLDER })

    freshDb
      .insert(schema.userGroups)
      .values({ groupId: 1, groupName: 'Site Admins', groupDescription: '', canViewSite: 'y', canAccessAdmin: 'y' })
      .run()

    freshDb
      .insert(schema.settings)
      .values({ optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' })
      .run()

    const freshApp = createApp(freshDb as typeof freshDb)
    const res = await freshApp.request('/api/articles/popular')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual([])
  })

  it('returns articles sorted by article_hits descending', async () => {
    const res = await app.request('/api/articles/popular')
    expect(res.status).toBe(200)
    const json = await res.json()
    const data = json.data as Array<{ articleTitle: string; articleHits: number }>

    // art1 has 100 hits, art2 has 50 hits — art1 should be first
    expect(data.length).toBeGreaterThan(0)
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].articleHits).toBeGreaterThanOrEqual(data[i].articleHits)
    }
  })

  it('excludes hidden articles', async () => {
    const res = await app.request('/api/articles/popular')
    const json = await res.json()
    const data = json.data as Array<{ articleTitle: string }>
    expect(data.some((a) => a.articleTitle === 'Hidden Article')).toBe(false)
  })

  it('returns at most 10 articles', async () => {
    const res = await app.request('/api/articles/popular')
    const json = await res.json()
    expect(json.data.length).toBeLessThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// GET /api/articles/recent
// ---------------------------------------------------------------------------
describe('GET /api/articles/recent', () => {
  it('returns articles sorted by article_date descending', async () => {
    const res = await app.request('/api/articles/recent')
    expect(res.status).toBe(200)
    const json = await res.json()
    const data = json.data as Array<{ articleTitle: string; articleDate: number }>

    expect(data.length).toBeGreaterThan(0)
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].articleDate).toBeGreaterThanOrEqual(data[i].articleDate)
    }
  })

  it('excludes hidden articles', async () => {
    const res = await app.request('/api/articles/recent')
    const json = await res.json()
    const data = json.data as Array<{ articleTitle: string }>
    expect(data.some((a) => a.articleTitle === 'Hidden Article')).toBe(false)
  })

  it('returns at most 10 articles', async () => {
    const res = await app.request('/api/articles/recent')
    const json = await res.json()
    expect(json.data.length).toBeLessThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// GET /api/settings/public
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/articles/:slug
// ---------------------------------------------------------------------------
describe('GET /api/articles/:slug', () => {
  // Use a dedicated fresh DB for article detail tests
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  db.insert(schema.userGroups)
    .values({ groupId: 1, groupName: 'Admins', groupDescription: '', canViewSite: 'y', canAccessAdmin: 'y' })
    .run()
  db.insert(schema.settings)
    .values({ optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' })
    .run()
  process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'
  const detailApp = createApp(db as typeof db)

  const now = Math.floor(Date.now() / 1000)

  // Insert a visible article
  const art = db
    .insert(schema.articles)
    .values({
      articleTitle: 'Hello World',
      articleUri: 'hello-world',
      articleDisplay: 'y',
      articleDescription: '<p>Hello <strong>world</strong> content</p>',
      articleShortDesc: 'A short description',
      articleKeywords: 'hello, world',
      articleHits: 5,
      articleDate: now - 3600,
      articleModified: now,
    })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  // Insert a hidden article
  const hiddenArt = db
    .insert(schema.articles)
    .values({
      articleTitle: 'Hidden Article',
      articleUri: 'hidden-article',
      articleDisplay: 'n',
      articleDescription: '<p>Hidden</p>',
      articleHits: 0,
      articleDate: now,
      articleModified: now,
    })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  // Insert a visible category and link to article
  const cat = db
    .insert(schema.categories)
    .values({ catName: 'Tech', catUri: 'tech', catDisplay: 'yes', catOrder: 1 })
    .returning({ catId: schema.categories.catId })
    .get()!

  db.insert(schema.article2cat)
    .values({ articleIdRel: art.articleId, categoryIdRel: cat.catId })
    .run()

  // Insert a hidden category and link to article (should be excluded)
  const hiddenCat = db
    .insert(schema.categories)
    .values({ catName: 'Hidden Cat', catUri: 'hidden-cat', catDisplay: 'no', catOrder: 2 })
    .returning({ catId: schema.categories.catId })
    .get()!

  db.insert(schema.article2cat)
    .values({ articleIdRel: art.articleId, categoryIdRel: hiddenCat.catId })
    .run()

  // Insert an attachment
  db.insert(schema.attachments)
    .values({
      articleId: art.articleId,
      attachFile: 'doc.pdf',
      attachTitle: 'My Document',
      attachType: 'application/pdf',
      attachSize: '12345',
    })
    .run()

  // Insert a glossary term
  db.insert(schema.glossary)
    .values({ gTerm: 'world', gDefinition: 'The planet Earth' })
    .run()

  it('returns 200 with article data for valid visible slug', async () => {
    const res = await detailApp.request('/api/articles/hello-world')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(json.data.articleTitle).toBe('Hello World')
    expect(json.data.articleUri).toBe('hello-world')
    expect(json.data.articleDescription).toBe('<p>Hello <strong>world</strong> content</p>')
    expect(json.data.articleHits).toBe(5)
  })

  it('returns only visible categories', async () => {
    const res = await detailApp.request('/api/articles/hello-world')
    const json = await res.json()
    const cats = json.data.categories as Array<{ catId: number; catName: string }>
    expect(cats.length).toBe(1)
    expect(cats[0].catName).toBe('Tech')
    expect(cats.some((c) => c.catName === 'Hidden Cat')).toBe(false)
  })

  it('returns attachments', async () => {
    const res = await detailApp.request('/api/articles/hello-world')
    const json = await res.json()
    const atts = json.data.attachments as Array<{ attachTitle: string }>
    expect(atts.length).toBe(1)
    expect(atts[0].attachTitle).toBe('My Document')
  })

  it('returns glossary terms', async () => {
    const res = await detailApp.request('/api/articles/hello-world')
    const json = await res.json()
    const terms = json.data.glossaryTerms as Array<{ gTerm: string }>
    expect(terms.length).toBeGreaterThan(0)
    expect(terms[0].gTerm).toBe('world')
  })

  it('returns 404 for non-existent slug', async () => {
    const res = await detailApp.request('/api/articles/does-not-exist')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 404 for hidden article slug', async () => {
    const res = await detailApp.request('/api/articles/hidden-article')
    expect(res.status).toBe(404)
    expect(hiddenArt.articleId).toBeGreaterThan(0) // confirm article exists in DB
  })
})

// ---------------------------------------------------------------------------
// POST /api/articles/:id/hit
// ---------------------------------------------------------------------------
describe('POST /api/articles/:id/hit', () => {
  const sqlite2 = new Database(':memory:')
  sqlite2.exec('PRAGMA foreign_keys = ON')
  const db2 = drizzle({ client: sqlite2, schema })
  migrate(db2, { migrationsFolder: MIGRATIONS_FOLDER })
  db2.insert(schema.userGroups)
    .values({ groupId: 1, groupName: 'Admins', groupDescription: '', canViewSite: 'y', canAccessAdmin: 'y' })
    .run()
  db2.insert(schema.settings)
    .values({ optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' })
    .run()
  const hitApp = createApp(db2 as typeof db2)

  const now = Math.floor(Date.now() / 1000)
  const hitArt = db2
    .insert(schema.articles)
    .values({
      articleTitle: 'Hit Test',
      articleUri: 'hit-test',
      articleDisplay: 'y',
      articleHits: 10,
      articleDate: now,
      articleModified: now,
    })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  it('increments article hit count by 1', async () => {
    const res = await hitApp.request(`/api/articles/${hitArt.articleId}/hit`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.hits).toBe(11)
  })

  it('increments again on repeated calls', async () => {
    await hitApp.request(`/api/articles/${hitArt.articleId}/hit`, { method: 'POST' })
    const res = await hitApp.request(`/api/articles/${hitArt.articleId}/hit`, {
      method: 'POST',
    })
    const json = await res.json()
    expect(json.data.hits).toBe(13) // 11 + 2 more
  })

  it('returns 400 for invalid ID', async () => {
    const res = await hitApp.request('/api/articles/invalid/hit', { method: 'POST' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent article ID', async () => {
    const res = await hitApp.request('/api/articles/99999/hit', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /api/settings/public
// ---------------------------------------------------------------------------
describe('GET /api/settings/public', () => {
  it('returns site name from settings table', async () => {
    const res = await app.request('/api/settings/public')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(json.data.siteName).toBe('Test Knowledge Base')
  })

  it('returns default site name when not configured', async () => {
    // Use a fresh DB with no settings
    const freshSqlite = new Database(':memory:')
    freshSqlite.exec('PRAGMA foreign_keys = ON')
    const freshDb = drizzle({ client: freshSqlite, schema })
    migrate(freshDb, { migrationsFolder: MIGRATIONS_FOLDER })

    freshDb
      .insert(schema.userGroups)
      .values({ groupId: 1, groupName: 'Site Admins', groupDescription: '', canViewSite: 'y', canAccessAdmin: 'y' })
      .run()

    const freshApp = createApp(freshDb as typeof freshDb)
    const res = await freshApp.request('/api/settings/public')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.siteName).toBe('68kb')
  })
})
