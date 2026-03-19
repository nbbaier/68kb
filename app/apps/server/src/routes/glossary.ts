import { Hono } from 'hono'
import { eq, inArray, sql } from 'drizzle-orm'
import { glossary } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a string starts with a digit (0-9) or a symbol (non-alpha, non-digit).
 * Used for the "sym" filter bucket.
 */
function isSymOrDigit(char: string): boolean {
  if (!char) return false
  return /^[^a-zA-Z]/.test(char)
}

// ---------------------------------------------------------------------------
// Public glossary routes
// ---------------------------------------------------------------------------

export function createPublicGlossaryRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // GET /api/glossary → all terms, ordered alphabetically (case-insensitive)
  router.get('/', (c) => {
    const terms = db
      .select()
      .from(glossary)
      .orderBy(sql`LOWER(${glossary.gTerm}) ASC`)
      .all()

    return c.json({ data: terms })
  })

  // GET /api/glossary/term/:letter → filtered by letter or 'sym'
  router.get('/term/:letter', (c) => {
    const letter = c.req.param('letter').toLowerCase()

    // Validate: must be a single letter a-z, or 'sym'
    if (letter !== 'sym' && !/^[a-z]$/.test(letter)) {
      return c.json({ error: 'Invalid letter parameter. Must be a single letter (a-z) or "sym".' }, 400)
    }

    let terms: Array<typeof glossary.$inferSelect>

    if (letter === 'sym') {
      // Return terms starting with digits (0-9) or symbols (not a-z/A-Z)
      // We fetch all terms and filter in JS since SQLite doesn't have easy regex support
      const allTerms = db
        .select()
        .from(glossary)
        .orderBy(sql`LOWER(${glossary.gTerm}) ASC`)
        .all()

      terms = allTerms.filter((t) => t.gTerm.length > 0 && isSymOrDigit(t.gTerm[0]!))
    } else {
      // Return terms starting with the given letter (case-insensitive)
      const allTerms = db
        .select()
        .from(glossary)
        .orderBy(sql`LOWER(${glossary.gTerm}) ASC`)
        .all()

      terms = allTerms.filter((t) => t.gTerm.toLowerCase().startsWith(letter))
    }

    return c.json({ data: terms })
  })

  return router
}

// ---------------------------------------------------------------------------
// Admin glossary routes
// ---------------------------------------------------------------------------

export function createAdminGlossaryRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/admin/glossary
  // Paginated list with optional search and sort
  // -------------------------------------------------------------------------
  router.get('/', (c) => {
    const page = parseInt(c.req.query('page') ?? '1', 10)
    const limit = parseInt(c.req.query('limit') ?? '20', 10)
    const search = c.req.query('search') ?? ''
    const sortField = c.req.query('sort') ?? 'term'
    const sortOrder = c.req.query('order') ?? 'asc'

    const safePage = isNaN(page) || page < 1 ? 1 : page
    const safeLimit = isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100)
    const offset = (safePage - 1) * safeLimit

    // Fetch all matching terms (we sort/paginate in memory due to simplicity)
    const allTerms = db.select().from(glossary).orderBy(sql`LOWER(${glossary.gTerm}) ASC`).all()

    // Filter by search
    const filtered = search.trim()
      ? allTerms.filter(
          (t) =>
            t.gTerm.toLowerCase().includes(search.toLowerCase()) ||
            t.gDefinition.toLowerCase().includes(search.toLowerCase()),
        )
      : allTerms

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string
      let bVal: string
      if (sortField === 'definition') {
        aVal = a.gDefinition.toLowerCase()
        bVal = b.gDefinition.toLowerCase()
      } else {
        aVal = a.gTerm.toLowerCase()
        bVal = b.gTerm.toLowerCase()
      }
      const cmp = aVal.localeCompare(bVal)
      return sortOrder === 'desc' ? -cmp : cmp
    })

    const total = sorted.length
    const data = sorted.slice(offset, offset + safeLimit)

    return c.json({ data, total, page: safePage, limit: safeLimit })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/glossary/:id
  // Returns a single glossary term
  // -------------------------------------------------------------------------
  router.get('/:id', (c) => {
    const idParam = c.req.param('id')
    const id = parseInt(idParam, 10)

    if (isNaN(id) || String(id) !== idParam) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    const term = db.select().from(glossary).where(eq(glossary.gId, id)).get()

    if (!term) {
      return c.json({ error: 'Glossary term not found' }, 404)
    }

    return c.json({ data: term })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/glossary
  // Creates a new glossary term
  // -------------------------------------------------------------------------
  router.post('/', async (c) => {
    let body: { gTerm?: string; gDefinition?: string } = {}
    try {
      body = await c.req.json<{ gTerm?: string; gDefinition?: string }>()
    } catch {
      body = {}
    }

    const gTerm = (body.gTerm ?? '').trim()
    const gDefinition = (body.gDefinition ?? '').trim()

    if (!gTerm) {
      return c.json({ error: 'Term is required' }, 422)
    }

    const inserted = db
      .insert(glossary)
      .values({ gTerm, gDefinition })
      .returning()
      .get()

    return c.json({ data: inserted }, 201)
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/glossary/:id
  // Updates a glossary term
  // -------------------------------------------------------------------------
  router.put('/:id', async (c) => {
    const idParam = c.req.param('id')
    const id = parseInt(idParam, 10)

    if (isNaN(id) || String(id) !== idParam) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    // Check exists
    const existing = db.select().from(glossary).where(eq(glossary.gId, id)).get()
    if (!existing) {
      return c.json({ error: 'Glossary term not found' }, 404)
    }

    let body: { gTerm?: string; gDefinition?: string } = {}
    try {
      body = await c.req.json<{ gTerm?: string; gDefinition?: string }>()
    } catch {
      body = {}
    }

    const gTerm = (body.gTerm ?? '').trim()
    const gDefinition = (body.gDefinition ?? '').trim()

    if (!gTerm) {
      return c.json({ error: 'Term is required' }, 422)
    }

    const updated = db
      .update(glossary)
      .set({ gTerm, gDefinition })
      .where(eq(glossary.gId, id))
      .returning()
      .get()

    return c.json({ data: updated })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/glossary
  // Bulk delete selected glossary terms by ID
  // -------------------------------------------------------------------------
  router.delete('/', async (c) => {
    let body: { ids?: number[] } = {}
    try {
      body = await c.req.json<{ ids?: number[] }>()
    } catch {
      body = {}
    }

    const ids = body.ids ?? []

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'At least one ID is required' }, 422)
    }

    // Validate all IDs are numbers
    if (ids.some((id) => typeof id !== 'number' || !Number.isInteger(id))) {
      return c.json({ error: 'All IDs must be integers' }, 422)
    }

    db.delete(glossary).where(inArray(glossary.gId, ids)).run()

    return c.json({ data: { deleted: ids.length } })
  })

  return router
}
