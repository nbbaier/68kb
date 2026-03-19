import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { categories } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CategoryWithDepth = {
  catId: number
  catParent: number
  catUri: string
  catName: string
  catDescription: string
  catAllowads: string
  catDisplay: string
  catOrder: number
  depth: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat list of categories ordered by tree traversal (parent first, then
 * children in order) with a `depth` field indicating nesting level.
 */
function buildCategoryTree(rows: (typeof categories.$inferSelect)[]): CategoryWithDepth[] {
  // Build a map of parent -> children
  const childMap = new Map<number, (typeof categories.$inferSelect)[]>()
  for (const row of rows) {
    const parent = row.catParent ?? 0
    if (!childMap.has(parent)) {
      childMap.set(parent, [])
    }
    childMap.get(parent)!.push(row)
  }

  const result: CategoryWithDepth[] = []

  function traverse(parentId: number, depth: number): void {
    const children = childMap.get(parentId) ?? []
    // Sort by catOrder, then by name
    children.sort((a, b) => a.catOrder - b.catOrder || a.catName.localeCompare(b.catName))
    for (const cat of children) {
      result.push({
        catId: cat.catId,
        catParent: cat.catParent,
        catUri: cat.catUri,
        catName: cat.catName,
        catDescription: cat.catDescription,
        catAllowads: cat.catAllowads,
        catDisplay: cat.catDisplay,
        catOrder: cat.catOrder,
        depth,
      })
      traverse(cat.catId, depth + 1)
    }
  }

  traverse(0, 0)
  return result
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createCategoryRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/admin/categories
  // Return all categories in tree order with depth
  // -------------------------------------------------------------------------
  router.get('/', (c) => {
    const allCategories = db
      .select()
      .from(categories)
      .orderBy(asc(categories.catOrder), asc(categories.catName))
      .all()

    const tree = buildCategoryTree(allCategories)

    return c.json({ data: tree })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/categories/:id
  // Return a single category by ID
  // -------------------------------------------------------------------------
  router.get('/:id', (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const category = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    return c.json({ data: category })
  })

  return router
}
