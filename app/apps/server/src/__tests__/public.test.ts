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

// ---------------------------------------------------------------------------
// GET /api/categories/:uri — Category Detail
// ---------------------------------------------------------------------------
describe('GET /api/categories/:uri', () => {
  // Isolated DB for these tests
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  db.insert(schema.userGroups)
    .values({
      groupId: 1,
      groupName: 'Admins',
      groupDescription: '',
      canViewSite: 'y',
      canAccessAdmin: 'y',
    })
    .run()
  db.insert(schema.settings)
    .values({ optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' })
    .run()

  process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'
  const catApp = createApp(db as typeof db)

  // Seed: root → child → grandchild
  const rootCat = db
    .insert(schema.categories)
    .values({ catName: 'Root Cat', catUri: 'root-cat', catDisplay: 'yes', catOrder: 1, catDescription: 'Root description' })
    .returning({ catId: schema.categories.catId })
    .get()!

  const childCat = db
    .insert(schema.categories)
    .values({ catName: 'Child Cat', catUri: 'root-cat/child-cat', catDisplay: 'yes', catParent: rootCat.catId, catOrder: 1, catDescription: 'Child description' })
    .returning({ catId: schema.categories.catId })
    .get()!

  const grandchildCat = db
    .insert(schema.categories)
    .values({ catName: 'Grandchild', catUri: 'root-cat/child-cat/grandchild', catDisplay: 'yes', catParent: childCat.catId, catOrder: 1, catDescription: '' })
    .returning({ catId: schema.categories.catId })
    .get()!

  // Hidden sibling — should not appear
  const hiddenSibling = db
    .insert(schema.categories)
    .values({ catName: 'Hidden Child', catUri: 'root-cat/hidden-child', catDisplay: 'no', catParent: rootCat.catId, catOrder: 2 })
    .returning({ catId: schema.categories.catId })
    .get()!

  // A hidden category — should return 404
  const hiddenCat = db
    .insert(schema.categories)
    .values({ catName: 'Hidden Root', catUri: 'hidden-root', catDisplay: 'no', catOrder: 2 })
    .returning({ catId: schema.categories.catId })
    .get()!

  const now = Math.floor(Date.now() / 1000)

  // Seed visible articles in rootCat
  const art1 = db
    .insert(schema.articles)
    .values({ articleTitle: 'Article 1', articleUri: 'article-1', articleDisplay: 'y', articleDate: now - 2000, articleHits: 10, articleModified: now - 2000 })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  const art2 = db
    .insert(schema.articles)
    .values({ articleTitle: 'Article 2', articleUri: 'article-2', articleDisplay: 'y', articleDate: now - 1000, articleHits: 5, articleModified: now - 1000 })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  // Hidden article — should not appear in counts or list
  const hiddenArt = db
    .insert(schema.articles)
    .values({ articleTitle: 'Hidden Art', articleUri: 'hidden-art', articleDisplay: 'n', articleDate: now, articleHits: 0, articleModified: now })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  db.insert(schema.article2cat).values({ articleIdRel: art1.articleId, categoryIdRel: rootCat.catId }).run()
  db.insert(schema.article2cat).values({ articleIdRel: art2.articleId, categoryIdRel: rootCat.catId }).run()
  db.insert(schema.article2cat).values({ articleIdRel: hiddenArt.articleId, categoryIdRel: rootCat.catId }).run()

  // Article in childCat for sub-category article count
  const artInChild = db
    .insert(schema.articles)
    .values({ articleTitle: 'Child Article', articleUri: 'child-article', articleDisplay: 'y', articleDate: now, articleHits: 1, articleModified: now })
    .returning({ articleId: schema.articles.articleId })
    .get()!

  db.insert(schema.article2cat).values({ articleIdRel: artInChild.articleId, categoryIdRel: childCat.catId }).run()

  it('returns 200 with category data for a valid visible URI', async () => {
    const res = await catApp.request('/api/categories/root-cat')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(json.data.category.catName).toBe('Root Cat')
    expect(json.data.category.catUri).toBe('root-cat')
    expect(json.data.category.catDescription).toBe('Root description')
  })

  it('returns 404 for nonexistent URI', async () => {
    const res = await catApp.request('/api/categories/does-not-exist')
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns 404 for hidden category', async () => {
    const res = await catApp.request('/api/categories/hidden-root')
    expect(res.status).toBe(404)
    expect(hiddenCat.catId).toBeGreaterThan(0)
  })

  it('returns direct visible sub-categories with article counts', async () => {
    const res = await catApp.request('/api/categories/root-cat')
    const json = await res.json()
    const subs = json.data.subCategories as Array<{ catName: string; catUri: string; articleCount: number }>

    // Only visible direct children
    expect(subs.length).toBe(1)
    expect(subs[0].catName).toBe('Child Cat')
    expect(subs[0].catUri).toBe('root-cat/child-cat')
    expect(subs[0].articleCount).toBe(1)
    expect(subs.some((s) => s.catName === 'Hidden Child')).toBe(false)
  })

  it('returns paginated articles (excludes hidden articles)', async () => {
    const res = await catApp.request('/api/categories/root-cat?page=1&limit=10')
    const json = await res.json()
    const arts = json.data.articles.data as Array<{ articleTitle: string }>

    expect(json.data.articles.total).toBe(2)
    expect(arts.length).toBe(2)
    expect(arts.some((a) => a.articleTitle === 'Hidden Art')).toBe(false)
  })

  it('paginates articles correctly', async () => {
    const res = await catApp.request('/api/categories/root-cat?page=1&limit=1')
    const json = await res.json()
    expect(json.data.articles.total).toBe(2)
    expect(json.data.articles.data.length).toBe(1)
    expect(json.data.articles.page).toBe(1)
    expect(json.data.articles.limit).toBe(1)
  })

  it('returns page 2 with different articles', async () => {
    const p1 = await catApp.request('/api/categories/root-cat?page=1&limit=1')
    const p2 = await catApp.request('/api/categories/root-cat?page=2&limit=1')
    const j1 = await p1.json()
    const j2 = await p2.json()
    const ids1 = j1.data.articles.data.map((a: { articleId: number }) => a.articleId)
    const ids2 = j2.data.articles.data.map((a: { articleId: number }) => a.articleId)
    expect(ids1[0]).not.toBe(ids2[0])
  })

  it('returns empty articles array for category with no visible articles', async () => {
    const res = await catApp.request('/api/categories/root-cat/child-cat/grandchild')
    const json = await res.json()
    expect(json.data.articles.total).toBe(0)
    expect(json.data.articles.data).toEqual([])
    expect(grandchildCat.catId).toBeGreaterThan(0)
  })

  it('returns breadcrumbs for root category (only itself)', async () => {
    const res = await catApp.request('/api/categories/root-cat')
    const json = await res.json()
    const crumbs = json.data.breadcrumbs as Array<{ catName: string; catUri: string }>
    // Root category: only itself in breadcrumbs
    expect(crumbs.length).toBe(1)
    expect(crumbs[0].catName).toBe('Root Cat')
    expect(crumbs[0].catUri).toBe('root-cat')
  })

  it('returns breadcrumbs for nested category (root → child)', async () => {
    const res = await catApp.request('/api/categories/root-cat/child-cat')
    const json = await res.json()
    const crumbs = json.data.breadcrumbs as Array<{ catName: string; catUri: string }>
    // Should be: [Root Cat, Child Cat]
    expect(crumbs.length).toBe(2)
    expect(crumbs[0].catName).toBe('Root Cat')
    expect(crumbs[0].catUri).toBe('root-cat')
    expect(crumbs[1].catName).toBe('Child Cat')
    expect(crumbs[1].catUri).toBe('root-cat/child-cat')
  })

  it('returns breadcrumbs for deeply nested category (root → child → grandchild)', async () => {
    const res = await catApp.request('/api/categories/root-cat/child-cat/grandchild')
    const json = await res.json()
    const crumbs = json.data.breadcrumbs as Array<{ catName: string; catUri: string }>
    expect(crumbs.length).toBe(3)
    expect(crumbs[0].catUri).toBe('root-cat')
    expect(crumbs[1].catUri).toBe('root-cat/child-cat')
    expect(crumbs[2].catUri).toBe('root-cat/child-cat/grandchild')
  })

  it('handles multi-segment URI (nested category lookup)', async () => {
    const res = await catApp.request('/api/categories/root-cat/child-cat')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.category.catName).toBe('Child Cat')
  })

  it('returns empty sub-categories for leaf category', async () => {
    const res = await catApp.request('/api/categories/root-cat/child-cat/grandchild')
    const json = await res.json()
    expect(json.data.subCategories).toEqual([])
  })
})
