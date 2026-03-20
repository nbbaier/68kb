import { describe, it, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { resolve, dirname } from 'node:path'
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

beforeAll(() => {
  const now = Math.floor(Date.now() / 1000)

  testDb
    .insert(schema.settings)
    .values([
      { optionName: 'site_name', optionValue: 'Test & KB', optionGroup: 'site' },
      { optionName: 'site_description', optionValue: 'Desc with <xml> chars', optionGroup: 'site' },
    ])
    .run()

  testDb
    .insert(schema.categories)
    .values([
      {
        catId: 1,
        catName: 'Guides',
        catUri: 'guides',
        catDisplay: 'yes',
        catOrder: 1,
      },
      {
        catId: 2,
        catName: 'API',
        catUri: 'api',
        catDisplay: 'yes',
        catOrder: 2,
      },
      {
        catId: 3,
        catName: 'Hidden',
        catUri: 'hidden',
        catDisplay: 'no',
        catOrder: 3,
      },
    ])
    .run()

  testDb
    .insert(schema.articles)
    .values([
      {
        articleId: 1,
        articleUri: 'intro-special',
        articleTitle: 'A & B <C>',
        articleShortDesc: 'Use > and < symbols',
        articleDescription: 'Body 1',
        articleKeywords: 'rss,xml',
        articleDate: now - 100,
        articleDisplay: 'y',
      },
      {
        articleId: 2,
        articleUri: 'api-overview',
        articleTitle: 'API Overview',
        articleShortDesc: 'API body',
        articleDescription: 'Body 2',
        articleKeywords: 'api',
        articleDate: now - 50,
        articleDisplay: 'y',
      },
      {
        articleId: 3,
        articleUri: 'hidden-article',
        articleTitle: 'Hidden Draft',
        articleShortDesc: 'Should not appear',
        articleDescription: 'Body 3',
        articleKeywords: 'hidden',
        articleDate: now - 10,
        articleDisplay: 'n',
      },
    ])
    .run()

  testDb
    .insert(schema.article2cat)
    .values([
      { articleIdRel: 1, categoryIdRel: 1 },
      { articleIdRel: 2, categoryIdRel: 2 },
      { articleIdRel: 3, categoryIdRel: 1 },
    ])
    .run()
})

describe('RSS feed routes', () => {
  it('returns a valid global RSS feed with XML escaping', async () => {
    const res = await app.request('/api/rss')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml')

    const body = await res.text()
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(body).toContain('<rss version="2.0">')
    expect(body).toContain('<title>Test &amp; KB</title>')
    expect(body).toContain('A &amp; B &lt;C&gt;')
    expect(body).toContain('Use &gt; and &lt; symbols')
    expect(body).toContain('/article/intro-special')
    expect(body).toContain('/article/api-overview')
    expect(body).not.toContain('Hidden Draft')
  })

  it('returns category-specific RSS feed', async () => {
    const res = await app.request('/api/rss/category/guides')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml')

    const body = await res.text()
    expect(body).toContain('Test &amp; KB - Guides')
    expect(body).toContain('/article/intro-special')
    expect(body).not.toContain('/article/api-overview')
  })

  it('returns 404 for unknown or hidden categories', async () => {
    const missingRes = await app.request('/api/rss/category/does-not-exist')
    expect(missingRes.status).toBe(404)

    const hiddenRes = await app.request('/api/rss/category/hidden')
    expect(hiddenRes.status).toBe(404)
  })
})
