/**
 * Cross-cutting concern tests:
 *  - Hidden categories excluded from all public views (sidebar/tree, category detail breadcrumbs)
 *  - XSS: search keywords stored and returned safely (no server-side modification needed; client handles escaping)
 *  - VAL-XCUT-001 (XSS), VAL-XCUT-002 (hidden categories), VAL-XCUT-003 (layout — tested client-side)
 */
import { describe, it, expect } from 'bun:test'
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
// Shared DB factory (fresh, isolated DB per describe group)
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  db.insert(schema.userGroups)
    .values([
      {
        groupId: 1,
        groupName: 'Site Admins',
        groupDescription: 'Admins',
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

  db.insert(schema.settings)
    .values([
      { optionName: 'site_name', optionValue: 'Test KB', optionGroup: 'site' },
      { optionName: 'site_max_search', optionValue: '10', optionGroup: 'site' },
    ])
    .run()

  return db
}

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

// ---------------------------------------------------------------------------
// VAL-XCUT-002: Hidden categories excluded from public category tree
// ---------------------------------------------------------------------------
describe('VAL-XCUT-002: Hidden categories excluded from GET /api/categories', () => {
  const db = createTestDb()
  const app = createApp(db as ReturnType<typeof createTestDb>)

  it('does not return hidden categories (cat_display != yes) in the tree', async () => {
    // Insert visible and hidden categories
    db.insert(schema.categories)
      .values({ catName: 'Visible Cat', catUri: 'visible-cat', catDisplay: 'yes', catOrder: 1 })
      .run()
    db.insert(schema.categories)
      .values({ catName: 'Hidden Cat', catUri: 'hidden-cat', catDisplay: 'no', catOrder: 2 })
      .run()

    const res = await app.request('/api/categories')
    expect(res.status).toBe(200)

    const json = await res.json()
    const names = (json.data as Array<{ catName: string }>).map((c) => c.catName)

    expect(names).toContain('Visible Cat')
    expect(names).not.toContain('Hidden Cat')
  })

  it('does not return categories where cat_display is "no"', async () => {
    // Insert another explicitly hidden category
    db.insert(schema.categories)
      .values({ catName: 'Another Hidden', catUri: 'another-hidden', catDisplay: 'no', catOrder: 3 })
      .run()

    const res = await app.request('/api/categories')
    const json = await res.json()
    const names = (json.data as Array<{ catName: string }>).map((c) => c.catName)

    expect(names).not.toContain('Another Hidden')
  })

  it('returns 404 for hidden category URIs', async () => {
    // The hidden category should not be accessible at its URI
    const res = await app.request('/api/categories/hidden-cat')
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// VAL-XCUT-002: Hidden categories excluded from breadcrumbs
// ---------------------------------------------------------------------------
describe('VAL-XCUT-002: Hidden categories excluded from breadcrumbs', () => {
  const db = createTestDb()
  const app = createApp(db as ReturnType<typeof createTestDb>)

  it('breadcrumbs skip hidden ancestor categories', async () => {
    // Setup: HiddenParent (hidden) → VisibleChild (visible)
    const hiddenParent = db
      .insert(schema.categories)
      .values({
        catName: 'Hidden Parent',
        catUri: 'hidden-parent',
        catDisplay: 'no',
        catParent: 0,
        catOrder: 1,
      })
      .returning({ catId: schema.categories.catId })
      .get()!

    db.insert(schema.categories)
      .values({
        catName: 'Visible Child',
        catUri: 'hidden-parent/visible-child',
        catDisplay: 'yes',
        catParent: hiddenParent.catId,
        catOrder: 1,
      })
      .run()

    // The visible child should be accessible (it's visible)
    const res = await app.request('/api/categories/hidden-parent/visible-child')
    expect(res.status).toBe(200)

    const json = await res.json()
    const breadcrumbs = json.data.breadcrumbs as Array<{ catName: string; catUri: string }>

    // The hidden parent should NOT appear in breadcrumbs
    const breadcrumbNames = breadcrumbs.map((b) => b.catName)
    expect(breadcrumbNames).not.toContain('Hidden Parent')

    // Only the current visible child should be in breadcrumbs (no ancestors since parent is hidden)
    expect(breadcrumbNames).toContain('Visible Child')
  })

  it('breadcrumbs include visible ancestors only', async () => {
    // Setup: VisibleParent (visible) → VisibleChild (visible)
    const visibleParent = db
      .insert(schema.categories)
      .values({
        catName: 'Visible Parent',
        catUri: 'visible-parent',
        catDisplay: 'yes',
        catParent: 0,
        catOrder: 2,
      })
      .returning({ catId: schema.categories.catId })
      .get()!

    db.insert(schema.categories)
      .values({
        catName: 'Visible Grandchild',
        catUri: 'visible-parent/visible-grandchild',
        catDisplay: 'yes',
        catParent: visibleParent.catId,
        catOrder: 1,
      })
      .run()

    const res = await app.request('/api/categories/visible-parent/visible-grandchild')
    expect(res.status).toBe(200)

    const json = await res.json()
    const breadcrumbs = json.data.breadcrumbs as Array<{ catName: string; catUri: string }>

    // Both visible parent and grandchild should appear
    const breadcrumbNames = breadcrumbs.map((b) => b.catName)
    expect(breadcrumbNames).toContain('Visible Parent')
    expect(breadcrumbNames).toContain('Visible Grandchild')
  })
})

// ---------------------------------------------------------------------------
// VAL-XCUT-002: Hidden sub-categories excluded from category detail page
// ---------------------------------------------------------------------------
describe('VAL-XCUT-002: Hidden sub-categories excluded from category detail', () => {
  const db = createTestDb()
  const app = createApp(db as ReturnType<typeof createTestDb>)

  it('does not include hidden sub-categories in category detail response', async () => {
    const parent = db
      .insert(schema.categories)
      .values({
        catName: 'Parent Category',
        catUri: 'parent-category',
        catDisplay: 'yes',
        catParent: 0,
        catOrder: 1,
      })
      .returning({ catId: schema.categories.catId })
      .get()!

    db.insert(schema.categories)
      .values({
        catName: 'Visible Sub',
        catUri: 'parent-category/visible-sub',
        catDisplay: 'yes',
        catParent: parent.catId,
        catOrder: 1,
      })
      .run()

    db.insert(schema.categories)
      .values({
        catName: 'Hidden Sub',
        catUri: 'parent-category/hidden-sub',
        catDisplay: 'no',
        catParent: parent.catId,
        catOrder: 2,
      })
      .run()

    const res = await app.request('/api/categories/parent-category')
    expect(res.status).toBe(200)

    const json = await res.json()
    const subCats = json.data.subCategories as Array<{ catName: string }>
    const subCatNames = subCats.map((s) => s.catName)

    expect(subCatNames).toContain('Visible Sub')
    expect(subCatNames).not.toContain('Hidden Sub')
  })
})

// ---------------------------------------------------------------------------
// VAL-XCUT-001: XSS protection — search keywords stored and returned safely
// ---------------------------------------------------------------------------
describe('VAL-XCUT-001: XSS protection in search', () => {
  const db = createTestDb()
  const app = createApp(db as ReturnType<typeof createTestDb>)

  it('stores XSS payload as plain text (not interpreted) in search log', async () => {
    const xssPayload = '<script>alert("xss")</script>'

    // Insert a visible article that matches the search
    const now = Math.floor(Date.now() / 1000)
    const art = db
      .insert(schema.articles)
      .values({
        articleTitle: 'Test Article for XSS',
        articleUri: 'test-article-xss',
        articleDescription: 'Some content',
        articleShortDesc: 'Short desc',
        articleDisplay: 'y',
        articleHits: 0,
        articleDate: now,
      })
      .returning({ articleId: schema.articles.articleId })
      .get()!

    // Perform a search with XSS payload mixed into keywords
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: `test ${xssPayload}` }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    // If search found results, verify the hash is returned
    if (!json.data.noResults) {
      expect(json.data.hash).toBeDefined()
      expect(typeof json.data.hash).toBe('string')
      expect(json.data.hash.length).toBe(32)
    }

    // Verify the XSS payload is stored literally in the search log (not executed)
    const logEntry = db
      .select()
      .from(schema.searchLog)
      .all()
      .find((e) => e.searchlogTerm.includes('script'))

    if (logEntry) {
      // The raw payload should be stored as-is (not decoded, not executed)
      expect(logEntry.searchlogTerm).toContain('<script>')
      // It's stored as a plain string — the client is responsible for escaping on render
    }

    // Clean up
    db.delete(schema.articles).run()
  })

  it('search results endpoint returns keywords as plain JSON string (not HTML)', async () => {
    const xssPayload = '<script>alert("xss")</script>'
    const now = Math.floor(Date.now() / 1000)

    // Insert a visible article with xss-like content in title
    db.insert(schema.articles)
      .values({
        articleTitle: 'XSS test article <b>bold</b>',
        articleUri: 'xss-test-article',
        articleDescription: 'Content here',
        articleShortDesc: 'Short',
        articleDisplay: 'y',
        articleHits: 0,
        articleDate: now,
      })
      .run()

    // Search with XSS payload
    const searchRes = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: xssPayload }),
    })

    expect(searchRes.status).toBe(200)
    const searchJson = await searchRes.json()

    if (!searchJson.data.noResults && searchJson.data.hash) {
      const resultsRes = await app.request(
        `/api/search/results/${searchJson.data.hash}`,
      )
      expect(resultsRes.status).toBe(200)

      const resultsJson = await resultsRes.json()
      // keywords field in response is the raw string (React renders it safely as text)
      expect(resultsJson.data.keywords).toBe(xssPayload)
      // The API returns it as a JSON string — the browser/React handles escaping on render
    }
  })
})
