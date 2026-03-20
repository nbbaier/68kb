import { Hono } from 'hono'
import { eq, desc, asc, and, count, inArray, ne } from 'drizzle-orm'
import { categories, articles, article2cat, settings, attachments, glossary, articleTags, users } from '../db/schema'
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

  // GET /:uri{.+} → /api/categories/{uri}
  // Returns a single category by its full URI (supports nested URIs with slashes,
  // e.g., "php", "php/oop", "php/oop/basics").
  // 404 when the category doesn't exist or is hidden (cat_display != 'yes').
  router.get('/:uri{.+}', (c) => {
    const uri = c.req.param('uri') ?? ''

    if (!uri) {
      return c.json({ error: 'Category not found' }, 404)
    }

    // Lookup by full URI — only visible categories
    const category = db
      .select()
      .from(categories)
      .where(and(eq(categories.catUri, uri), eq(categories.catDisplay, 'yes')))
      .get()

    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    // Build breadcrumbs: traverse catParent chain from root → current.
    // The returned array includes all ancestors PLUS the current category as last item.
    // Hidden ancestors (cat_display != 'yes') are skipped in the breadcrumb trail
    // but traversal continues upward so visible grandparents are still included.
    const breadcrumbs: Array<{ catName: string; catUri: string }> = []
    let curr = category
    const visited = new Set<number>()
    while (curr.catParent !== 0) {
      if (visited.has(curr.catParent)) break // guard against circular refs
      visited.add(curr.catParent)
      // Fetch parent regardless of visibility so we can continue traversal
      const parent = db
        .select()
        .from(categories)
        .where(eq(categories.catId, curr.catParent))
        .get()
      if (!parent) break
      // Only include visible parent categories in the breadcrumb trail
      if (parent.catDisplay === 'yes') {
        breadcrumbs.unshift({ catName: parent.catName, catUri: parent.catUri })
      }
      curr = parent
    }
    breadcrumbs.push({ catName: category.catName, catUri: category.catUri })

    // Get direct sub-categories (visible only), ordered by catOrder then name
    const children = db
      .select()
      .from(categories)
      .where(and(eq(categories.catParent, category.catId), eq(categories.catDisplay, 'yes')))
      .orderBy(asc(categories.catOrder), asc(categories.catName))
      .all()

    // Get article counts for each sub-category
    let childCountMap = new Map<number, number>()
    if (children.length > 0) {
      const childIds = children.map((c) => c.catId)
      const childCounts = db
        .select({
          categoryIdRel: article2cat.categoryIdRel,
          cnt: count(),
        })
        .from(article2cat)
        .innerJoin(
          articles,
          and(eq(article2cat.articleIdRel, articles.articleId), eq(articles.articleDisplay, 'y')),
        )
        .where(inArray(article2cat.categoryIdRel, childIds))
        .groupBy(article2cat.categoryIdRel)
        .all()
      childCountMap = new Map(childCounts.map((r) => [r.categoryIdRel, r.cnt]))
    }

    // Pagination
    const page = parseInt(c.req.query('page') ?? '1', 10)
    const limit = parseInt(c.req.query('limit') ?? '10', 10)
    const safePage = isNaN(page) || page < 1 ? 1 : page
    const safeLimit = isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100)
    const offset = (safePage - 1) * safeLimit

    // Total visible articles in this category
    const totalResult = db
      .select({ cnt: count() })
      .from(article2cat)
      .innerJoin(
        articles,
        and(eq(article2cat.articleIdRel, articles.articleId), eq(articles.articleDisplay, 'y')),
      )
      .where(eq(article2cat.categoryIdRel, category.catId))
      .get()

    const total = totalResult?.cnt ?? 0

    // Paginated articles
    const articleList = db
      .select({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(article2cat)
      .innerJoin(
        articles,
        and(eq(article2cat.articleIdRel, articles.articleId), eq(articles.articleDisplay, 'y')),
      )
      .where(eq(article2cat.categoryIdRel, category.catId))
      .orderBy(desc(articles.articleDate), desc(articles.articleId))
      .limit(safeLimit)
      .offset(offset)
      .all()

    return c.json({
      data: {
        category: {
          catId: category.catId,
          catName: category.catName,
          catUri: category.catUri,
          catDescription: category.catDescription,
          catParent: category.catParent,
          catImage: category.catImage,
          catKeywords: category.catKeywords,
        },
        breadcrumbs,
        subCategories: children.map((ch) => ({
          catId: ch.catId,
          catName: ch.catName,
          catUri: ch.catUri,
          catDescription: ch.catDescription,
          articleCount: childCountMap.get(ch.catId) ?? 0,
        })),
        articles: {
          data: articleList,
          total,
          page: safePage,
          limit: safeLimit,
        },
      },
    })
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

  // GET /:slug/related → /api/articles/:slug/related
  // Returns articles sharing tags with the given article (excluding the article itself).
  // Returns an empty array if the article has no tags or doesn't exist.
  router.get('/:slug/related', (c) => {
    const slug = c.req.param('slug')

    // Find the article (must be visible)
    const article = db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(eq(articles.articleUri, slug), eq(articles.articleDisplay, 'y')))
      .get()

    if (!article) {
      return c.json({ data: [] })
    }

    // Get tags for this article
    const articleTagRows = db
      .select({ tagsTagId: articleTags.tagsTagId })
      .from(articleTags)
      .where(eq(articleTags.tagsArticleId, article.articleId))
      .all()

    const tagIds = articleTagRows.map((r) => r.tagsTagId)

    if (tagIds.length === 0) {
      return c.json({ data: [] })
    }

    // Find other visible articles sharing any of these tags, excluding current article
    const related = db
      .selectDistinct({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(articles)
      .innerJoin(articleTags, eq(articleTags.tagsArticleId, articles.articleId))
      .where(
        and(
          eq(articles.articleDisplay, 'y'),
          ne(articles.articleId, article.articleId),
          inArray(articleTags.tagsTagId, tagIds),
        ),
      )
      .orderBy(desc(articles.articleHits))
      .limit(5)
      .all()

    return c.json({ data: related })
  })

  // GET /:slug → /api/articles/:slug
  // Returns a single public article by URI slug.
  // 404 for non-existent or hidden articles.
  router.get('/:slug', (c) => {
    const slug = c.req.param('slug')

    const article = db
      .select()
      .from(articles)
      .where(and(eq(articles.articleUri, slug), eq(articles.articleDisplay, 'y')))
      .get()

    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    // Get visible categories for this article
    const articleCategories = db
      .select({
        catId: categories.catId,
        catName: categories.catName,
        catUri: categories.catUri,
      })
      .from(article2cat)
      .innerJoin(
        categories,
        and(
          eq(article2cat.categoryIdRel, categories.catId),
          eq(categories.catDisplay, 'yes'),
        ),
      )
      .where(eq(article2cat.articleIdRel, article.articleId))
      .all()

    // Get attachments for this article
    const attachmentList = db
      .select()
      .from(attachments)
      .where(eq(attachments.articleId, article.articleId))
      .all()

    // Get all glossary terms for tooltip processing on the client
    const glossaryTerms = db
      .select({ gTerm: glossary.gTerm, gDefinition: glossary.gDefinition })
      .from(glossary)
      .all()

    let articleAuthorUsername: string | null = null
    if (article.articleAuthor > 0) {
      const author = db
        .select({ userUsername: users.userUsername })
        .from(users)
        .where(eq(users.userId, article.articleAuthor))
        .get()
      articleAuthorUsername = author?.userUsername ?? null
    }

    return c.json({
      data: {
        articleId: article.articleId,
        articleUri: article.articleUri,
        articleTitle: article.articleTitle,
        articleKeywords: article.articleKeywords,
        articleDescription: article.articleDescription,
        articleShortDesc: article.articleShortDesc,
        articleDate: article.articleDate,
        articleModified: article.articleModified,
        articleDisplay: article.articleDisplay,
        articleHits: article.articleHits,
        articleAuthor: article.articleAuthor,
        articleAuthorUsername,
        categories: articleCategories,
        attachments: attachmentList,
        glossaryTerms,
      },
    })
  })

  // POST /:id/hit → /api/articles/:id/hit
  // Increments the article hit counter by 1.
  router.post('/:id/hit', (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const article = db.select().from(articles).where(eq(articles.articleId, id)).get()
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    const newHits = article.articleHits + 1
    db
      .update(articles)
      .set({ articleHits: newHits })
      .where(eq(articles.articleId, id))
      .run()

    return c.json({ data: { hits: newHits } })
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
