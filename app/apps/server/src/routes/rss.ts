import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { article2cat, articles, categories, settings } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

type FeedItem = {
  articleTitle: string
  articleUri: string
  articleShortDesc: string
  articleDate: number
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatRssDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toUTCString()
}

function readSetting(db: DrizzleDB, optionName: string, fallback = ''): string {
  const row = db
    .select({ optionValue: settings.optionValue })
    .from(settings)
    .where(eq(settings.optionName, optionName))
    .get()

  return row?.optionValue ?? fallback
}

function listFeedItems(db: DrizzleDB, categoryId?: number): FeedItem[] {
  if (typeof categoryId === 'number') {
    return db
      .select({
        articleTitle: articles.articleTitle,
        articleUri: articles.articleUri,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
      })
      .from(article2cat)
      .innerJoin(
        articles,
        and(eq(article2cat.articleIdRel, articles.articleId), eq(articles.articleDisplay, 'y')),
      )
      .where(eq(article2cat.categoryIdRel, categoryId))
      .orderBy(desc(articles.articleDate), desc(articles.articleId))
      .limit(20)
      .all()
  }

  return db
    .select({
      articleTitle: articles.articleTitle,
      articleUri: articles.articleUri,
      articleShortDesc: articles.articleShortDesc,
      articleDate: articles.articleDate,
    })
    .from(articles)
    .where(eq(articles.articleDisplay, 'y'))
    .orderBy(desc(articles.articleDate), desc(articles.articleId))
    .limit(20)
    .all()
}

function renderRssXml({
  siteTitle,
  siteDescription,
  baseUrl,
  items,
}: {
  siteTitle: string
  siteDescription: string
  baseUrl: string
  items: FeedItem[]
}): string {
  const now = Math.floor(Date.now() / 1000)
  const safeSiteTitle = xmlEscape(siteTitle)
  const safeSiteDescription = xmlEscape(siteDescription)
  const safeBaseUrl = xmlEscape(baseUrl)

  const itemXml = items
    .map((item) => {
      const articleUrl = `${baseUrl.replace(/\/$/, '')}/article/${encodeURIComponent(item.articleUri)}`
      return [
        '<item>',
        `<title>${xmlEscape(item.articleTitle)}</title>`,
        `<link>${xmlEscape(articleUrl)}</link>`,
        `<guid>${xmlEscape(articleUrl)}</guid>`,
        `<description>${xmlEscape(item.articleShortDesc ?? '')}</description>`,
        `<pubDate>${xmlEscape(formatRssDate(item.articleDate))}</pubDate>`,
        '</item>',
      ].join('')
    })
    .join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${safeSiteTitle}</title>`,
    `<link>${safeBaseUrl}</link>`,
    `<description>${safeSiteDescription}</description>`,
    `<language>en-us</language>`,
    `<lastBuildDate>${xmlEscape(formatRssDate(now))}</lastBuildDate>`,
    itemXml,
    '</channel>',
    '</rss>',
  ].join('')
}

export function createRssRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/rss
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const siteTitle = readSetting(db, 'site_name', '68kb')
    const siteDescription = readSetting(db, 'site_description', '')
    const baseUrl = c.req.url.startsWith('http')
      ? new URL(c.req.url).origin
      : 'http://localhost:3100'
    const items = listFeedItems(db)

    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    return c.body(renderRssXml({ siteTitle, siteDescription, baseUrl, items }))
  })

  // -------------------------------------------------------------------------
  // GET /api/rss/category/:uri
  // -------------------------------------------------------------------------
  router.get('/category/:uri{.+}', async (c) => {
    const uri = (c.req.param('uri') ?? '').trim()
    if (!uri) {
      return c.json({ error: 'Category not found' }, 404)
    }

    const category = db
      .select({ catId: categories.catId, catName: categories.catName })
      .from(categories)
      .where(and(eq(categories.catUri, uri), eq(categories.catDisplay, 'yes')))
      .get()

    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    const siteTitle = readSetting(db, 'site_name', '68kb')
    const siteDescription = readSetting(db, 'site_description', '')
    const baseUrl = c.req.url.startsWith('http')
      ? new URL(c.req.url).origin
      : 'http://localhost:3100'
    const items = listFeedItems(db, category.catId)

    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    return c.body(
      renderRssXml({
        siteTitle: `${siteTitle} - ${category.catName}`,
        siteDescription,
        baseUrl,
        items,
      }),
    )
  })

  return router
}
