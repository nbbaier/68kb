import { Hono } from 'hono'
import { and, asc, count, desc, eq, like, or } from 'drizzle-orm'
import { articles, comments } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

type CommentStatus = '0' | '1' | 'spam'
type CommentInsert = typeof comments.$inferInsert

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /(href\s*=\s*['"]?)?(https?:)?\/\//gi

function normalizeStatus(value: string | null | undefined): CommentStatus | null {
  if (value === '0' || value === '1' || value === 'spam') return value
  return null
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const realIp = c.req.header('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return '0.0.0.0'
}

function countLinks(content: string): number {
  return (content.match(URL_RE) ?? []).length
}

function resolveCommentApproval(db: DrizzleDB, email: string, content: string): CommentStatus {
  if (countLinks(content) >= 2) {
    return 'spam'
  }

  const existingApproved = db
    .select({ value: count() })
    .from(comments)
    .where(and(eq(comments.commentAuthorEmail, email), eq(comments.commentApproved, '1')))
    .get()
    ?.value ?? 0

  return existingApproved > 0 ? '1' : '0'
}

export function createPublicCommentRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/comments/article/:articleId
  // Returns approved comments for a visible article.
  // -------------------------------------------------------------------------
  router.get('/article/:articleId', async (c) => {
    const articleId = parseInt(c.req.param('articleId'), 10)
    if (isNaN(articleId) || articleId <= 0) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const article = db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(eq(articles.articleId, articleId), eq(articles.articleDisplay, 'y')))
      .get()

    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    const rows = db
      .select({
        commentId: comments.commentId,
        commentAuthor: comments.commentAuthor,
        commentDate: comments.commentDate,
        commentContent: comments.commentContent,
      })
      .from(comments)
      .where(and(eq(comments.commentArticleId, articleId), eq(comments.commentApproved, '1')))
      .orderBy(asc(comments.commentDate), asc(comments.commentId))
      .all()

    return c.json({
      data: rows,
      total: rows.length,
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/comments/article/:articleId
  // Adds a new comment with spam + auto-approve logic.
  // -------------------------------------------------------------------------
  router.post('/article/:articleId', async (c) => {
    const articleId = parseInt(c.req.param('articleId'), 10)
    if (isNaN(articleId) || articleId <= 0) {
      return c.json({ error: 'Invalid article ID' }, 400)
    }

    const article = db
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(eq(articles.articleId, articleId), eq(articles.articleDisplay, 'y')))
      .get()

    if (!article) {
      return c.json({ error: 'Article not found' }, 404)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const author = typeof body.author === 'string' ? body.author.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!author) {
      return c.json({ error: 'Author name is required' }, 400)
    }
    if (!email || !EMAIL_RE.test(email)) {
      return c.json({ error: 'Valid email is required' }, 400)
    }
    if (!content) {
      return c.json({ error: 'Comment content is required' }, 400)
    }

    const approval = resolveCommentApproval(db, email, content)
    const now = Math.floor(Date.now() / 1000)
    const ip = getClientIp(c)

    const inserted = db
      .insert(comments)
      .values({
        commentArticleId: articleId,
        commentAuthor: author.slice(0, 120),
        commentAuthorEmail: email.slice(0, 255),
        commentAuthorIp: ip.slice(0, 64),
        commentDate: now,
        commentContent: content,
        commentApproved: approval,
      })
      .returning({ commentId: comments.commentId })
      .get()

    if (!inserted) {
      return c.json({ error: 'Failed to add comment' }, 500)
    }

    return c.json(
      {
        data: {
          commentId: inserted.commentId,
          status: approval,
          message:
            approval === '1'
              ? 'Comment posted'
              : approval === 'spam'
                ? 'Comment flagged as spam'
                : 'Comment submitted for moderation',
        },
      },
      201,
    )
  })

  return router
}

export function createAdminCommentRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()
  const requireManageUsers = createRequireRole(db)('canManageUsers')
  router.use('*', requireManageUsers)

  // -------------------------------------------------------------------------
  // GET /api/admin/comments
  // List comments with status/search filters and pagination.
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const page = parseInt(c.req.query('page') ?? '1', 10)
    const limit = parseInt(c.req.query('limit') ?? '20', 10)
    const status = normalizeStatus(c.req.query('status'))
    const search = (c.req.query('search') ?? '').trim()
    const articleIdRaw = c.req.query('articleId')

    const safePage = isNaN(page) || page < 1 ? 1 : page
    const safeLimit = isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100)
    const offset = (safePage - 1) * safeLimit

    let articleId: number | null = null
    if (articleIdRaw && articleIdRaw.trim() !== '') {
      const parsed = parseInt(articleIdRaw, 10)
      if (isNaN(parsed) || parsed <= 0) {
        return c.json({ error: 'Invalid articleId' }, 400)
      }
      articleId = parsed
    }

    const conditions = []
    if (status) {
      conditions.push(eq(comments.commentApproved, status))
    }
    if (articleId !== null) {
      conditions.push(eq(comments.commentArticleId, articleId))
    }
    if (search) {
      conditions.push(
        or(
          like(comments.commentAuthor, `%${search}%`),
          like(comments.commentAuthorEmail, `%${search}%`),
          like(comments.commentContent, `%${search}%`),
          like(articles.articleTitle, `%${search}%`),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const total = db
      .select({ value: count() })
      .from(comments)
      .innerJoin(articles, eq(comments.commentArticleId, articles.articleId))
      .where(whereClause)
      .get()
      ?.value ?? 0

    const rows = db
      .select({
        commentId: comments.commentId,
        commentArticleId: comments.commentArticleId,
        commentAuthor: comments.commentAuthor,
        commentAuthorEmail: comments.commentAuthorEmail,
        commentAuthorIp: comments.commentAuthorIp,
        commentDate: comments.commentDate,
        commentContent: comments.commentContent,
        commentApproved: comments.commentApproved,
        articleTitle: articles.articleTitle,
        articleUri: articles.articleUri,
      })
      .from(comments)
      .innerJoin(articles, eq(comments.commentArticleId, articles.articleId))
      .where(whereClause)
      .orderBy(desc(comments.commentDate), desc(comments.commentId))
      .limit(safeLimit)
      .offset(offset)
      .all()

    return c.json({
      data: rows,
      total,
      page: safePage,
      limit: safeLimit,
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/comments/:id
  // -------------------------------------------------------------------------
  router.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    const row = db
      .select({
        commentId: comments.commentId,
        commentArticleId: comments.commentArticleId,
        commentAuthor: comments.commentAuthor,
        commentAuthorEmail: comments.commentAuthorEmail,
        commentAuthorIp: comments.commentAuthorIp,
        commentDate: comments.commentDate,
        commentContent: comments.commentContent,
        commentApproved: comments.commentApproved,
        articleTitle: articles.articleTitle,
        articleUri: articles.articleUri,
      })
      .from(comments)
      .innerJoin(articles, eq(comments.commentArticleId, articles.articleId))
      .where(eq(comments.commentId, id))
      .get()

    if (!row) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    return c.json({ data: row })
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/comments/:id/status
  // -------------------------------------------------------------------------
  router.put('/:id/status', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const status = normalizeStatus(typeof body.status === 'string' ? body.status : null)
    if (!status) {
      return c.json({ error: 'Invalid status (must be 0, 1, or spam)' }, 400)
    }

    const existing = db
      .select({ commentId: comments.commentId })
      .from(comments)
      .where(eq(comments.commentId, id))
      .get()

    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    db
      .update(comments)
      .set({ commentApproved: status })
      .where(eq(comments.commentId, id))
      .run()

    return c.json({ data: { commentId: id, commentApproved: status } })
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/comments/:id
  // -------------------------------------------------------------------------
  router.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const updateValues: Partial<CommentInsert> = {}

    if (typeof body.author === 'string') {
      const author = body.author.trim()
      if (!author) return c.json({ error: 'Author cannot be empty' }, 400)
      updateValues.commentAuthor = author.slice(0, 120)
    }

    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) {
        return c.json({ error: 'Valid email is required' }, 400)
      }
      updateValues.commentAuthorEmail = email.slice(0, 255)
    }

    if (typeof body.content === 'string') {
      const content = body.content.trim()
      if (!content) return c.json({ error: 'Comment content cannot be empty' }, 400)
      updateValues.commentContent = content
    }

    if (typeof body.status === 'string') {
      const status = normalizeStatus(body.status)
      if (!status) return c.json({ error: 'Invalid status (must be 0, 1, or spam)' }, 400)
      updateValues.commentApproved = status
    }

    if (Object.keys(updateValues).length === 0) {
      return c.json({ error: 'No valid fields provided for update' }, 400)
    }

    const existing = db
      .select({ commentId: comments.commentId })
      .from(comments)
      .where(eq(comments.commentId, id))
      .get()

    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    db
      .update(comments)
      .set(updateValues)
      .where(eq(comments.commentId, id))
      .run()

    return c.json({ data: { commentId: id } })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/comments/:id
  // -------------------------------------------------------------------------
  router.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid comment ID' }, 400)
    }

    const existing = db
      .select({ commentId: comments.commentId })
      .from(comments)
      .where(eq(comments.commentId, id))
      .get()

    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    db
      .delete(comments)
      .where(eq(comments.commentId, id))
      .run()

    return c.json({ data: { deleted: true, commentId: id } })
  })

  return router
}
