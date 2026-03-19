import { Hono } from 'hono'
import { eq, like, or, and, lt, inArray, count } from 'drizzle-orm'
import { articles, categories, article2cat, searchCache, searchLog, settings } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchParams = {
  keywords: string
  categoryId: number | null
}

type SearchArticle = {
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
 * Generate a 32-character hex search hash.
 */
function generateHash(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Get all descendant category IDs (including the given categoryId itself).
 * Traverses the category tree recursively.
 */
function getDescendantCategoryIds(
  allCategories: Array<{ catId: number; catParent: number }>,
  rootId: number,
): number[] {
  const result: number[] = [rootId]
  const queue: number[] = [rootId]

  while (queue.length > 0) {
    const current = queue.shift()!
    const children = allCategories.filter((c) => c.catParent === current)
    for (const child of children) {
      result.push(child.catId)
      queue.push(child.catId)
    }
  }

  return result
}

/**
 * Clean up search cache entries older than 1 hour.
 */
function cleanExpiredSearchCache(db: DrizzleDB): void {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600
  db.delete(searchCache).where(lt(searchCache.searchDate, oneHourAgo)).run()
}

/**
 * Get per-page limit from site_max_search setting (default 10).
 */
function getMaxSearchPerPage(db: DrizzleDB): number {
  const setting = db
    .select({ optionValue: settings.optionValue })
    .from(settings)
    .where(eq(settings.optionName, 'site_max_search'))
    .get()

  const parsed = parseInt(setting?.optionValue ?? '10', 10)
  return isNaN(parsed) || parsed < 1 ? 10 : parsed
}

/**
 * Build a per-word keyword condition (AND-ed together, each word OR-ed across fields).
 * Matches the original PHP search: each word must appear in at least one of the three fields.
 */
function buildKeywordCondition(keywords: string) {
  const words = keywords.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return undefined

  const wordConditions = words.map((word) => {
    const kw = `%${word}%`
    return or(
      like(articles.articleTitle, kw),
      like(articles.articleShortDesc, kw),
      like(articles.articleDescription, kw),
    )
  })

  // AND all per-word conditions together
  return wordConditions.length === 1
    ? wordConditions[0]
    : and(...(wordConditions as [ReturnType<typeof or>, ...ReturnType<typeof or>[]] ))
}

/**
 * Execute the article search query and return matching articles.
 * Returns all matching (visible) articles.
 */
function executeSearch(
  db: DrizzleDB,
  params: SearchParams,
): SearchArticle[] {
  const { keywords, categoryId } = params

  // Build category filter: collect all descendant category IDs if categoryId provided
  let categoryIds: number[] | null = null
  if (categoryId !== null && categoryId > 0) {
    const allCats = db
      .select({ catId: categories.catId, catParent: categories.catParent })
      .from(categories)
      .all()
    categoryIds = getDescendantCategoryIds(allCats, categoryId)
  }

  const keywordCondition = keywords.trim() ? buildKeywordCondition(keywords) : undefined

  // Base query for visible articles
  // If category filter, join with article2cat
  if (categoryIds !== null) {
    const whereClause = keywordCondition
      ? and(
          eq(articles.articleDisplay, 'y'),
          inArray(article2cat.categoryIdRel, categoryIds),
          keywordCondition,
        )
      : and(
          eq(articles.articleDisplay, 'y'),
          inArray(article2cat.categoryIdRel, categoryIds),
        )

    return db
      .selectDistinct({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(articles)
      .innerJoin(
        article2cat,
        eq(article2cat.articleIdRel, articles.articleId),
      )
      .where(whereClause)
      .orderBy(articles.articleDate)
      .all()
  } else {
    // No category filter — keyword search only
    const whereClause = keywordCondition
      ? and(eq(articles.articleDisplay, 'y'), keywordCondition)
      : eq(articles.articleDisplay, 'y')

    return db
      .selectDistinct({
        articleId: articles.articleId,
        articleUri: articles.articleUri,
        articleTitle: articles.articleTitle,
        articleShortDesc: articles.articleShortDesc,
        articleDate: articles.articleDate,
        articleHits: articles.articleHits,
      })
      .from(articles)
      .where(whereClause)
      .orderBy(articles.articleDate)
      .all()
  }
}

// ---------------------------------------------------------------------------
// Search routes
// ---------------------------------------------------------------------------

export function createSearchRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // POST /api/search
  // Executes a search, stores the hash, logs the term, returns hash or noResults.
  // -------------------------------------------------------------------------
  router.post('/', async (c) => {
    let body: { keywords?: string; categoryId?: number } = {}
    try {
      body = await c.req.json<{ keywords?: string; categoryId?: number }>()
    } catch {
      body = {}
    }
    const keywords = (body.keywords ?? '').trim()
    const categoryId = body.categoryId ?? null

    // Clean up expired search cache entries
    cleanExpiredSearchCache(db)

    // If no meaningful input, return noResults
    if (!keywords && !categoryId) {
      return c.json({ data: { noResults: true } })
    }

    // Execute search
    const searchParams: SearchParams = { keywords, categoryId }
    const results = executeSearch(db, searchParams)

    if (results.length === 0) {
      return c.json({ data: { noResults: true } })
    }

    // Generate hash
    const hash = generateHash()

    // Get client IP and user from session
    const clientIp = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '0.0.0.0'
    const session = c.get('session')
    const userId: number = (session?.get('userId') as number) ?? 0

    // Store in search cache
    db.insert(searchCache)
      .values({
        searchId: hash,
        searchDate: Math.floor(Date.now() / 1000),
        searchKeywords: JSON.stringify({ keywords, categoryId }),
        searchTotal: results.length,
        searchUserId: userId,
        searchIp: clientIp,
      })
      .run()

    // Log to searchlog if keywords provided
    if (keywords) {
      db.insert(searchLog)
        .values({
          searchlogTerm: keywords,
          searchlogDate: Math.floor(Date.now() / 1000),
          searchlogUserId: userId,
          searchlogIp: clientIp,
        })
        .run()
    }

    return c.json({ data: { hash, total: results.length } })
  })

  // -------------------------------------------------------------------------
  // GET /api/search/results/:hash
  // Returns paginated results for a stored search hash.
  // -------------------------------------------------------------------------
  router.get('/results/:hash', (c) => {
    const hash = c.req.param('hash')

    // Validate hash length (must be exactly 32 chars)
    if (!hash || hash.length !== 32) {
      return c.json({ error: 'Invalid search hash' }, 404)
    }

    // Clean up expired entries
    cleanExpiredSearchCache(db)

    // Look up the hash in search cache
    const cached = db
      .select()
      .from(searchCache)
      .where(eq(searchCache.searchId, hash))
      .get()

    if (!cached) {
      return c.json({ error: 'Search results not found or expired' }, 404)
    }

    // Parse stored search parameters
    let searchParams: SearchParams
    try {
      const parsed = JSON.parse(cached.searchKeywords) as { keywords?: string; categoryId?: number | null }
      searchParams = {
        keywords: parsed.keywords ?? '',
        categoryId: parsed.categoryId ?? null,
      }
    } catch {
      return c.json({ error: 'Invalid search data' }, 404)
    }

    // Re-execute the search query
    const allResults = executeSearch(db, searchParams)

    // Pagination
    const perPage = getMaxSearchPerPage(db)
    const page = parseInt(c.req.query('page') ?? '1', 10)
    const limit = parseInt(c.req.query('limit') ?? String(perPage), 10)
    const safePage = isNaN(page) || page < 1 ? 1 : page
    const safeLimit = isNaN(limit) || limit < 1 ? perPage : Math.min(limit, 100)
    const offset = (safePage - 1) * safeLimit

    const pageResults = allResults.slice(offset, offset + safeLimit)

    return c.json({
      data: {
        articles: pageResults,
        total: allResults.length,
        page: safePage,
        limit: safeLimit,
        keywords: searchParams.keywords,
        categoryId: searchParams.categoryId,
      },
    })
  })

  return router
}
