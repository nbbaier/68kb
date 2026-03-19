import { Hono } from 'hono'
import { eq, desc, asc, and, count, sql } from 'drizzle-orm'
import { categories, articles, article2cat, settings } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicCategory = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDescription: string
  catOrder: number
  catImage: string
  catKeywords: string
  catDisplay: string
  depth: number
  articleCount: number
}

export type PublicArticle = {
  articleId: number
  articleUri: string
  articleTitle: string
  articleShortDesc: string
  articleDate: number
  articleHits: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat tree of visible categories (cat_display='yes') in traversal order,
 * with depth and article counts.
 */
function buildPublicCategoryTree(
  rows: (typeof categories.$inferSelect)[],
  countMap: Map<number, number>,
): PublicCategory[] {
  // Only include visible categories
  const visible = rows.filter((c) => c.catDisplay === 'yes')

  // Build parent → children map
  const childMap = new Map<number, (typeof categories.$inferSelect)[]>()
  for (const row of visible) {
    const parent = row.catParent ?? 0
    if (!childMap.has(parent)) {
      childMap.set(parent, [])
    }
    childMap.get(parent)!.push(row)
  }

  const result: PublicCategory[] = []

  function traverse(parentId: number, depth: number): void {
    const children = childMap.get(parentId) ?? []
    children.sort((a, b) => a.catOrder - b.catOrder || a.catName.localeCompare(b.catName))
    for (const cat of children) {
      result.push({
        catId: cat.catId,
        catParent: cat.catParent,
        catUri: cat.catUri,
        catName: cat.catName,
        catDescription: cat.catDescription,
        catOrder: cat.catOrder,
        catImage: cat.catImage,
        catKeywords: cat.catKeywords,
        catDisplay: cat.catDisplay,
        depth,
        articleCount: countMap.get(cat.catId) ?? 0,
      })
      traverse(cat.catId, depth + 1)
    }
  }

  traverse(0, 0)
  return result
}

// ---------------------------------------------------------------------------
// Public category routes
// ---------------------------------------------------------------------------

export function createPublicCategoryRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // GET / → /api/categories
  router.get('/', (c) => {
    // Fetch all categories
    const allCategories = db
      .select()
      .from(categories)
      .orderBy(asc(categories.catOrder), asc(categories.catName))
      .all()

    // Get article counts per category (only visible/displayed articles)
    const counts = db
      .select({
        categoryIdRel: article2cat.categoryIdRel,
        cnt: count(),
      })
      .from(article2cat)
      .innerJoin(articles, and(
        eq(article2cat.articleIdRel, articles.articleId),
        eq(articles.articleDisplay, 'y'),
      ))
      .groupBy(article2cat.categoryIdRel)
      .all()

    const countMap = new Map<number, number>(counts.map((r) => [r.categoryIdRel, r.cnt]))

    const tree = buildPublicCategoryTree(allCategories, countMap)

    return c.json({ data: tree })
  })

  return router
}

// ---------------------------------------------------------------------------
// Public article routes
// ---------------------------------------------------------------------------

export function createPublicArticleRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // GET /popular → /api/articles/popular
  router.get('/popular', (c) => {
    const rows = db
      .select({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(articles)
      .where(eq(articles.articleDisplay, 'y'))
      .orderBy(desc(articles.articleHits))
      .limit(10)
      .all()

    return c.json({ data: rows })
  })

  // GET /recent → /api/articles/recent
  router.get('/recent', (c) => {
    const rows = db
      .select({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(articles)
      .where(eq(articles.articleDisplay, 'y'))
      .orderBy(desc(articles.articleDate))
      .limit(10)
      .all()

    return c.json({ data: rows })
  })

  return router
}

// ---------------------------------------------------------------------------
// Public settings routes
// ---------------------------------------------------------------------------

export function createPublicSettingsRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // GET /public → /api/settings/public
  router.get('/public', (c) => {
    const siteNameSetting = db
      .select({ optionValue: settings.optionValue })
      .from(settings)
      .where(eq(settings.optionName, 'site_name'))
      .get()

    const siteDescSetting = db
      .select({ optionValue: settings.optionValue })
      .from(settings)
      .where(eq(settings.optionName, 'site_description'))
      .get()

    return c.json({
      data: {
        siteName: siteNameSetting?.optionValue ?? '68kb',
        siteDescription: siteDescSetting?.optionValue ?? '',
      },
    })
  })

  return router
}
