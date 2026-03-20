import { Hono } from 'hono'
import { eq, like, sql, desc, asc, and, or, inArray } from 'drizzle-orm'
import { resolve, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, unlink, rm } from 'node:fs/promises'
import { articles, article2cat, tags, articleTags, attachments, categories, users } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Default uploads directory — can be overridden via UPLOADS_DIR env var for tests
const DEFAULT_UPLOADS_DIR = resolve(__dirname, '../../../../uploads')
const getUploadsDir = () => process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR

// Allowed file extensions for attachments
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'rtf', 'zip', 'tar', 'gz',
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URI slug from a title string.
 * Only letters, numbers, hyphens, underscores — replace everything else.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Validate that a URI contains only letters, numbers, hyphens, underscores.
 * (alpha-dash rule)
 */
function isAlphaDash(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

/**
 * Parse a comma-separated keywords string into an array of trimmed, lowercase tags.
 */
function parseKeywords(keywords: string): string[] {
  return keywords
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Sanitize a filename to safe characters.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

/**
 * Sync tags for an article:
 * - Parse keywords into tag strings
 * - For each tag, find or create in `tags` table
 * - Replace all `article_tags` links with the new set
 */
function syncTags(db: DrizzleDB, articleId: number, keywords: string): void {
  // Remove all existing tag links for this article
  db.delete(articleTags).where(eq(articleTags.tagsArticleId, articleId)).run()

  // Deduplicate tag names to avoid composite PK collisions on article_tags
  const tagNames = [...new Set(parseKeywords(keywords))]
  if (tagNames.length === 0) return

  for (const tagName of tagNames) {
    // Find existing tag (case-insensitive)
    const existing = db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`LOWER(${tags.tag}) = ${tagName}`)
      .get()

    const tagId = existing
      ? existing.id
      : db.insert(tags).values({ tag: tagName }).returning({ id: tags.id }).get()?.id

    if (tagId !== undefined) {
      db.insert(articleTags).values({ tagsTagId: tagId, tagsArticleId: articleId }).run()
    }
  }
}

/**
 * Sync category associations for an article.
 */
function syncCategories(db: DrizzleDB, articleId: number, categoryIds: number[]): void {
  // Remove all existing links
  db.delete(article2cat).where(eq(article2cat.articleIdRel, articleId)).run()

  for (const catId of categoryIds) {
    db.insert(article2cat).values({ articleIdRel: articleId, categoryIdRel: catId }).run()
  }
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createArticleRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()
  const requireManageArticles = createRequireRole(db)('canManageArticles')
  const requireDeleteArticles = createRequireRole(db)('canDeleteArticles')

  // All article admin routes require article-management permission
  router.use('*', requireManageArticles)

  // -------------------------------------------------------------------------
  // GET /api/admin/articles
  // Paginated list with optional search, sort, filter
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const {
      page = '1',
      limit = '20',
      search = '',
      sort = 'date',
      order = 'desc',
      display,
    } = c.req.query()

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const offset = (pageNum - 1) * pageSize

    // Build WHERE conditions
    const conditions = []

    if (search) {
      conditions.push(
        or(
          like(articles.articleTitle, `%${search}%`),
          like(articles.articleUri, `%${search}%`),
          like(articles.articleKeywords, `%${search}%`),
          like(articles.articleShortDesc, `%${search}%`),
        ),
      )
    }

    if (display === 'y' || display === 'n') {
      conditions.push(eq(articles.articleDisplay, display))
    }

    const condition = conditions.length > 0 ? and(...conditions) : undefined

    // Count total
    const totalResult = db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(condition)
      .get()
    const total = totalResult?.count ?? 0

    // Determine sort column
    const sortColumn =
      sort === 'title'
        ? articles.articleTitle
        : sort === 'modified'
          ? articles.articleModified
          : sort === 'display'
            ? articles.articleDisplay
            : sort === 'order'
              ? articles.articleOrder
              : articles.articleDate

    const orderFn = order === 'asc' ? asc : desc

    // Fetch articles
    const articleList = db
      .select()
      .from(articles)
      .where(condition)
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset(offset)
      .all()

    // Fetch categories for these articles
    const articleIds = articleList.map((a) => a.articleId)
    const categoryMap = new Map<number, Array<{ catId: number; catName: string }>>()

    if (articleIds.length > 0) {
      const categoryLinks = db
        .select({
          articleId: article2cat.articleIdRel,
          catId: categories.catId,
          catName: categories.catName,
        })
        .from(article2cat)
        .innerJoin(categories, eq(article2cat.categoryIdRel, categories.catId))
        .where(inArray(article2cat.articleIdRel, articleIds))
        .all()

      for (const link of categoryLinks) {
        if (!categoryMap.has(link.articleId)) {
          categoryMap.set(link.articleId, [])
        }
        categoryMap.get(link.articleId)!.push({ catId: link.catId, catName: link.catName })
      }
    }

    const data = articleList.map((a) => ({
      articleId: a.articleId,
      articleTitle: a.articleTitle,
      articleUri: a.articleUri,
      articleDate: a.articleDate,
      articleModified: a.articleModified,
      articleDisplay: a.articleDisplay,
      articleOrder: a.articleOrder,
      categories: categoryMap.get(a.articleId) ?? [],
    }))

    return c.json({ data, total, page: pageNum })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/articles/:id
  // Single article with categories, tags, attachments, author
  // -------------------------------------------------------------------------
  router.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const article = db.select().from(articles).where(eq(articles.articleId, id)).get()
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    // Get categories
    const articleCategories = db
      .select({ catId: categories.catId, catName: categories.catName, catUri: categories.catUri })
      .from(article2cat)
      .innerJoin(categories, eq(article2cat.categoryIdRel, categories.catId))
      .where(eq(article2cat.articleIdRel, id))
      .all()

    // Get tags
    const articleTagList = db
      .select({ id: tags.id, tag: tags.tag })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tagsTagId, tags.id))
      .where(eq(articleTags.tagsArticleId, id))
      .all()

    // Get attachments
    const attachmentList = db
      .select()
      .from(attachments)
      .where(eq(attachments.articleId, id))
      .all()

    // Get author
    let author: { userId: number; username: string; email: string } | null = null
    if (article.articleAuthor) {
      const authorRow = db
        .select({ userId: users.userId, username: users.userUsername, email: users.userEmail })
        .from(users)
        .where(eq(users.userId, article.articleAuthor))
        .get()
      if (authorRow) author = authorRow
    }

    return c.json({
      data: {
        ...article,
        categories: articleCategories,
        tags: articleTagList,
        attachments: attachmentList,
        author,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/articles
  // Create new article
  // Body: { title, uri?, shortDesc?, description?, display?, keywords?, order?, categories?, author? }
  // -------------------------------------------------------------------------
  router.post('/', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const {
      title,
      uri,
      shortDesc = '',
      description = '',
      display = 'n',
      keywords = '',
      order,
      categories: categoryIds = [],
      author,
    } = body as {
      title?: string
      uri?: string
      shortDesc?: string
      description?: string
      display?: string
      keywords?: string
      order?: unknown
      categories?: number[]
      author?: number
    }

    // Validation
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return c.json({ error: 'Title is required' }, 400)
    }

    // Validate and resolve URI
    let articleUri: string
    if (uri && typeof uri === 'string' && uri.trim() !== '') {
      if (!isAlphaDash(uri.trim())) {
        return c.json(
          { error: 'URI may only contain letters, numbers, hyphens, and underscores' },
          400,
        )
      }
      articleUri = uri.trim()
    } else {
      articleUri = slugify(title.trim())
    }

    // Validate display
    const displayValue = display === 'y' ? 'y' : 'n'

    // Validate order (must be numeric if provided)
    let orderValue = 0
    if (order !== undefined && order !== null && order !== '') {
      const parsed = Number(order)
      if (isNaN(parsed) || !Number.isFinite(parsed)) {
        return c.json({ error: 'Order must be a numeric value' }, 400)
      }
      orderValue = Math.trunc(parsed)
    }

    // Validate categories is an array of numbers
    if (!Array.isArray(categoryIds) || categoryIds.some((id) => typeof id !== 'number')) {
      return c.json({ error: 'Categories must be an array of numeric IDs' }, 400)
    }

    // Get author from body or session
    const session = c.get('session')
    const sessionUserId = session.get('userId') ?? 0
    const authorId = typeof author === 'number' ? author : sessionUserId

    const now = Math.floor(Date.now() / 1000)

    // Insert article
    const inserted = db
      .insert(articles)
      .values({
        articleTitle: title.trim(),
        articleUri,
        articleShortDesc: typeof shortDesc === 'string' ? shortDesc : '',
        articleDescription: typeof description === 'string' ? description : '',
        articleDisplay: displayValue,
        articleKeywords: typeof keywords === 'string' ? keywords : '',
        articleOrder: orderValue,
        articleAuthor: authorId,
        articleDate: now,
        articleModified: now,
        articleHits: 0,
        articleRating: 0,
      })
      .returning({ articleId: articles.articleId })
      .get()

    if (!inserted) {
      return c.json({ error: 'Failed to create article' }, 500)
    }

    const articleId = inserted.articleId

    // Associate categories
    syncCategories(db, articleId, categoryIds)

    // Create/reuse tags from keywords
    if (keywords && typeof keywords === 'string') {
      syncTags(db, articleId, keywords)
    }

    // Return the created article
    const created = db.select().from(articles).where(eq(articles.articleId, articleId)).get()

    return c.json({ data: created }, 201)
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/articles/:id
  // Update an existing article
  // -------------------------------------------------------------------------
  router.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const existing = db.select().from(articles).where(eq(articles.articleId, id)).get()
    if (!existing) {
      return c.json({ error: 'Article not found' }, 404)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const {
      title,
      uri,
      shortDesc,
      description,
      display,
      keywords,
      order,
      categories: categoryIds,
      author,
    } = body as {
      title?: string
      uri?: string
      shortDesc?: string
      description?: string
      display?: string
      keywords?: string
      order?: unknown
      categories?: number[]
      author?: number
    }

    // Validation
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return c.json({ error: 'Title is required' }, 400)
      }
    }

    // Validate URI if provided
    let articleUri: string | undefined
    if (uri !== undefined) {
      if (typeof uri === 'string' && uri.trim() !== '') {
        if (!isAlphaDash(uri.trim())) {
          return c.json(
            { error: 'URI may only contain letters, numbers, hyphens, and underscores' },
            400,
          )
        }
        articleUri = uri.trim()
      } else if (typeof uri === 'string' && uri.trim() === '') {
        // Empty URI → auto-generate from current title or provided title
        const titleSource = typeof title === 'string' ? title.trim() : existing.articleTitle
        articleUri = slugify(titleSource)
      }
    }

    // Validate order if provided
    let orderValue: number | undefined
    if (order !== undefined && order !== null && order !== '') {
      const parsed = Number(order)
      if (isNaN(parsed) || !Number.isFinite(parsed)) {
        return c.json({ error: 'Order must be a numeric value' }, 400)
      }
      orderValue = Math.trunc(parsed)
    }

    // Validate categories if provided
    if (
      categoryIds !== undefined &&
      (!Array.isArray(categoryIds) || categoryIds.some((id) => typeof id !== 'number'))
    ) {
      return c.json({ error: 'Categories must be an array of numeric IDs' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // Build update values (only update fields that were provided)
    const updateValues: Partial<{
      articleTitle: string
      articleUri: string
      articleShortDesc: string
      articleDescription: string
      articleDisplay: 'y' | 'n'
      articleKeywords: string
      articleOrder: number
      articleAuthor: number
      articleModified: number
    }> = { articleModified: now }

    if (title !== undefined) updateValues.articleTitle = title.trim()
    if (articleUri !== undefined) updateValues.articleUri = articleUri
    if (shortDesc !== undefined && typeof shortDesc === 'string')
      updateValues.articleShortDesc = shortDesc
    if (description !== undefined && typeof description === 'string')
      updateValues.articleDescription = description
    if (display !== undefined)
      updateValues.articleDisplay = display === 'y' ? 'y' : 'n'
    if (orderValue !== undefined) updateValues.articleOrder = orderValue
    if (author !== undefined && typeof author === 'number')
      updateValues.articleAuthor = author
    if (keywords !== undefined && typeof keywords === 'string')
      updateValues.articleKeywords = keywords

    db.update(articles).set(updateValues).where(eq(articles.articleId, id)).run()

    // Update category associations if provided
    if (categoryIds !== undefined) {
      syncCategories(db, id, categoryIds)
    }

    // Update tags if keywords were provided
    if (keywords !== undefined && typeof keywords === 'string') {
      syncTags(db, id, keywords)
    }

    const updated = db.select().from(articles).where(eq(articles.articleId, id)).get()

    return c.json({ data: updated })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/articles/:id
  // Delete article and cascade: article2cat, article_tags, attachments, files
  // -------------------------------------------------------------------------
  router.delete('/:id', requireDeleteArticles, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Article not found' }, 404)
    }

    const article = db.select().from(articles).where(eq(articles.articleId, id)).get()
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    // Get attachments before deleting records (need file paths)
    const attachmentList = db
      .select()
      .from(attachments)
      .where(eq(attachments.articleId, id))
      .all()

    // Delete DB records (cascade order to satisfy FK constraints)
    db.delete(articleTags).where(eq(articleTags.tagsArticleId, id)).run()
    db.delete(article2cat).where(eq(article2cat.articleIdRel, id)).run()
    db.delete(attachments).where(eq(attachments.articleId, id)).run()
    db.delete(articles).where(eq(articles.articleId, id)).run()

    // Delete attachment files from disk
    const uploadsDir = getUploadsDir()
    for (const attachment of attachmentList) {
      const filePath = resolve(uploadsDir, String(id), attachment.attachFile)
      try {
        await unlink(filePath)
      } catch {
        // File may not exist; ignore error
      }
    }

    // Remove the article's upload directory if empty
    try {
      await rm(resolve(uploadsDir, String(id)), { recursive: true, force: true })
    } catch {
      // Directory may not exist; ignore error
    }

    return c.json({ data: { deleted: true, articleId: id } })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/articles/:id/attachments
  // Upload a file attachment for an article
  // -------------------------------------------------------------------------
  router.post('/:id/attachments', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const article = db.select().from(articles).where(eq(articles.articleId, id)).get()
    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    let formData: Record<string, unknown>
    try {
      formData = await c.req.parseBody()
    } catch {
      return c.json({ error: 'Invalid form data' }, 400)
    }

    const title = formData['title']
    const file = formData['file']

    // If no file provided, return OK (article saved normally, no attachment record)
    if (!file || !(file instanceof File)) {
      return c.json({ data: null }, 200)
    }

    // Validate file extension
    const originalName = file.name || 'upload'
    const ext = extname(originalName).toLowerCase().replace('.', '')
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return c.json(
        {
          error: `File type ".${ext}" is not allowed. Allowed types: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
        },
        400,
      )
    }

    const attachTitle = typeof title === 'string' && title.trim() ? title.trim() : basename(originalName, extname(originalName))

    // Build safe filename with timestamp prefix to avoid collisions
    const safeFilename = `${Date.now()}_${sanitizeFilename(originalName)}`
    const uploadsDir = getUploadsDir()
    const articleDir = resolve(uploadsDir, String(id))

    // Ensure directory exists
    await mkdir(articleDir, { recursive: true })

    // Write file
    const filePath = resolve(articleDir, safeFilename)
    await Bun.write(filePath, file)

    // Insert attachment record
    const inserted = db
      .insert(attachments)
      .values({
        articleId: id,
        attachFile: safeFilename,
        attachTitle,
        attachType: file.type || 'application/octet-stream',
        attachSize: String(file.size),
      })
      .returning()
      .get()

    return c.json({ data: inserted }, 201)
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/articles/:id/attachments/:attachId
  // Delete a specific attachment (DB record + file)
  // -------------------------------------------------------------------------
  router.delete('/:id/attachments/:attachId', requireDeleteArticles, async (c) => {
    const articleId = parseInt(c.req.param('id'), 10)
    const attachId = parseInt(c.req.param('attachId'), 10)

    if (isNaN(articleId) || isNaN(attachId)) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    const attachment = db
      .select()
      .from(attachments)
      .where(and(eq(attachments.attachId, attachId), eq(attachments.articleId, articleId)))
      .get()

    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404)
    }

    // Delete DB record
    db.delete(attachments).where(eq(attachments.attachId, attachId)).run()

    // Delete file from disk
    const uploadsDir = getUploadsDir()
    const filePath = resolve(uploadsDir, String(articleId), attachment.attachFile)
    try {
      await unlink(filePath)
    } catch {
      // File may not exist; ignore error
    }

    return c.json({ data: { deleted: true, attachId } })
  })

  return router
}
