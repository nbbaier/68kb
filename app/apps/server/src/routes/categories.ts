import { Hono } from 'hono'
import { eq, asc, ne, and, count } from 'drizzle-orm'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, unlink } from 'node:fs/promises'
import { categories, article2cat } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Default uploads directory — can be overridden via UPLOADS_DIR env var for tests
const DEFAULT_UPLOADS_DIR = resolve(__dirname, '../../../../uploads')
const getUploadsDir = () => process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR

// Allowed image types for category images
const ALLOWED_IMAGE_EXTENSIONS = new Set(['gif', 'jpg', 'jpeg', 'png'])

// Max image size in bytes (100KB)
const MAX_IMAGE_SIZE = 100 * 1024

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
  catImage: string
  catKeywords: string
  depth: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URI slug from a name string.
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
 * Validate that a URI segment contains only letters, numbers, hyphens, underscores.
 * (alpha-dash rule — no slashes allowed in user input)
 */
function isAlphaDash(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

/**
 * Sanitize a filename to safe characters.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

/**
 * Get the last segment of a hierarchical URI (for display in edit forms).
 * e.g., "parent/child" → "child", "root" → "root"
 */
export function getUriSegment(fullUri: string): string {
  const parts = fullUri.split('/')
  return parts[parts.length - 1]
}

/**
 * Check URI uniqueness and append _1, _2, etc. if duplicate.
 * Excludes a specific catId from the check (for updates).
 */
function ensureUniqueUri(db: DrizzleDB, uri: string, excludeId?: number, count = 0): string {
  const checkUri = count === 0 ? uri : `${uri}_${count}`

  let existing
  if (excludeId !== undefined) {
    existing = db
      .select({ catId: categories.catId })
      .from(categories)
      .where(and(eq(categories.catUri, checkUri), ne(categories.catId, excludeId)))
      .get()
  } else {
    existing = db
      .select({ catId: categories.catId })
      .from(categories)
      .where(eq(categories.catUri, checkUri))
      .get()
  }

  if (existing) {
    return ensureUniqueUri(db, uri, excludeId, count + 1)
  }

  return checkUri
}

/**
 * Build the full hierarchical URI for a category given its parent and slug.
 * The parent's catUri is already the full hierarchical path.
 * e.g., parent.catUri = "grandparent/parent", slug = "child" → "grandparent/parent/child"
 */
function buildHierarchicalUri(db: DrizzleDB, parentId: number, slug: string): string {
  if (parentId === 0) {
    return slug
  }

  const parent = db.select().from(categories).where(eq(categories.catId, parentId)).get()
  if (!parent) {
    return slug
  }

  return `${parent.catUri}/${slug}`
}

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
        catImage: cat.catImage,
        catKeywords: cat.catKeywords,
        depth,
      })
      traverse(cat.catId, depth + 1)
    }
  }

  traverse(0, 0)
  return result
}

/**
 * Delete a category image from disk.
 */
async function deleteCategoryImage(imageName: string): Promise<void> {
  if (!imageName) return
  const uploadsDir = getUploadsDir()
  const imagePath = resolve(uploadsDir, 'categories', imageName)
  try {
    await unlink(imagePath)
  } catch {
    // File may not exist; ignore error
  }
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createCategoryRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()
  const requireManageCategories = createRequireRole(db)('canManageCategories')
  const requireDeleteCategories = createRequireRole(db)('canDeleteCategories')

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
  // GET /api/admin/categories/:id/article-count
  // Return the number of articles assigned to a category
  // Must come before /:id to avoid route conflict
  // -------------------------------------------------------------------------
  router.get('/:id/article-count', (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const category = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    const result = db
      .select({ count: count() })
      .from(article2cat)
      .where(eq(article2cat.categoryIdRel, id))
      .get()

    return c.json({ data: { count: result?.count ?? 0 } })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/categories/:id/duplicate
  // Return category data to pre-fill a duplicate form
  // Must come before /:id to avoid route conflict
  // -------------------------------------------------------------------------
  router.get('/:id/duplicate', (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const category = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    // Return data for pre-filling the add form
    // Strip path from URI so only the last segment is returned (for the form)
    return c.json({
      data: {
        catId: category.catId,
        catName: category.catName,
        catUri: getUriSegment(category.catUri),
        catDescription: category.catDescription,
        catAllowads: category.catAllowads,
        catDisplay: category.catDisplay,
        catParent: category.catParent,
        catKeywords: category.catKeywords,
        catOrder: category.catOrder,
        catPromo: category.catPromo,
        // Note: image is NOT duplicated (form shows no image)
        catImage: '',
      },
    })
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

  // -------------------------------------------------------------------------
  // POST /api/admin/categories
  // Create a new category
  // Requires: can_manage_categories
  // Accepts multipart form data (for image upload) or JSON
  // -------------------------------------------------------------------------
  router.post('/', requireManageCategories, async (c) => {
    let body: Record<string, unknown>
    let imageFile: File | null = null

    const contentType = c.req.header('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await c.req.parseBody()
        body = formData as Record<string, unknown>
        if (formData['image'] instanceof File) {
          imageFile = formData['image']
        }
      } catch {
        return c.json({ error: 'Invalid form data' }, 400)
      }
    } else {
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid request body' }, 400)
      }
    }

    const {
      name,
      uri,
      description = '',
      display = 'yes',
      allowAds = 'yes',
      parent,
      keywords = '',
      order,
      promo = '',
    } = body as {
      name?: string
      uri?: string
      description?: string
      display?: string
      allowAds?: string
      parent?: unknown
      keywords?: string
      order?: unknown
      promo?: string
    }

    // Validation: name is required
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return c.json({ error: 'Category name is required' }, 400)
    }

    // Validate URI segment if provided
    let uriSegment: string
    if (uri && typeof uri === 'string' && uri.trim() !== '') {
      if (!isAlphaDash(uri.trim())) {
        return c.json(
          { error: 'URI may only contain letters, numbers, hyphens, and underscores' },
          400,
        )
      }
      uriSegment = uri.trim()
    } else {
      uriSegment = slugify(name.trim())
    }

    // Validate parent
    const parentId = parent !== undefined && parent !== null && parent !== ''
      ? parseInt(String(parent), 10)
      : 0
    if (parentId !== 0) {
      if (isNaN(parentId) || parentId < 0) {
        return c.json({ error: 'Invalid parent category ID' }, 400)
      }
      const parentCat = db.select().from(categories).where(eq(categories.catId, parentId)).get()
      if (!parentCat) {
        return c.json({ error: 'Parent category not found' }, 400)
      }
    }

    // Validate order (must be numeric if provided)
    let orderValue = 0
    if (order !== undefined && order !== null && order !== '') {
      const parsed = Number(order)
      if (isNaN(parsed) || !Number.isFinite(parsed)) {
        return c.json({ error: 'Order must be a numeric value' }, 400)
      }
      orderValue = Math.trunc(parsed)
    }

    // Build hierarchical URI
    const fullUri = buildHierarchicalUri(db, parentId, uriSegment)

    // Ensure URI uniqueness
    const uniqueUri = ensureUniqueUri(db, fullUri)

    // Validate display/allowAds values
    const displayValue = display === 'yes' || display === 'y' ? 'yes' : 'no'
    const allowAdsValue = allowAds === 'yes' || allowAds === 'y' ? 'yes' : 'no'

    // Handle image upload
    let imageName = ''
    if (imageFile && imageFile.size > 0) {
      const imageResult = await handleImageUpload(imageFile)
      if ('error' in imageResult) {
        return c.json({ error: imageResult.error }, 400)
      }
      imageName = imageResult.filename
    }

    // Insert category
    const inserted = db
      .insert(categories)
      .values({
        catName: name.trim(),
        catUri: uniqueUri,
        catDescription: typeof description === 'string' ? description : '',
        catAllowads: allowAdsValue,
        catDisplay: displayValue,
        catParent: parentId,
        catKeywords: typeof keywords === 'string' ? keywords : '',
        catOrder: orderValue,
        catImage: imageName,
        catPromo: typeof promo === 'string' ? promo : '',
        catViews: 0,
      })
      .returning({ catId: categories.catId })
      .get()

    if (!inserted) {
      return c.json({ error: 'Failed to create category' }, 500)
    }

    // If image was uploaded, save it with the new catId
    if (imageFile && imageFile.size > 0 && imageName) {
      const uploadsDir = getUploadsDir()
      const categoriesDir = resolve(uploadsDir, 'categories')
      await mkdir(categoriesDir, { recursive: true })
      const imagePath = resolve(categoriesDir, imageName)
      await Bun.write(imagePath, imageFile)
    }

    const created = db
      .select()
      .from(categories)
      .where(eq(categories.catId, inserted.catId))
      .get()

    return c.json({ data: created }, 201)
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/categories/:id
  // Update a category
  // Requires: can_manage_categories
  // -------------------------------------------------------------------------
  router.put('/:id', requireManageCategories, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const existing = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!existing) {
      return c.json({ error: 'Category not found' }, 404)
    }

    let body: Record<string, unknown>
    let imageFile: File | null = null

    const contentType = c.req.header('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await c.req.parseBody()
        body = formData as Record<string, unknown>
        if (formData['image'] instanceof File) {
          imageFile = formData['image']
        }
      } catch {
        return c.json({ error: 'Invalid form data' }, 400)
      }
    } else {
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid request body' }, 400)
      }
    }

    const {
      name,
      uri,
      description,
      display,
      allowAds,
      parent,
      keywords,
      order,
      promo,
    } = body as {
      name?: string
      uri?: string
      description?: string
      display?: string
      allowAds?: string
      parent?: unknown
      keywords?: string
      order?: unknown
      promo?: string
    }

    // Validation: name is required if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return c.json({ error: 'Category name is required' }, 400)
      }
    }

    // Validate URI segment if provided
    let uriSegment: string | undefined
    if (uri !== undefined) {
      if (typeof uri === 'string' && uri.trim() !== '') {
        if (!isAlphaDash(uri.trim())) {
          return c.json(
            { error: 'URI may only contain letters, numbers, hyphens, and underscores' },
            400,
          )
        }
        uriSegment = uri.trim()
      } else if (typeof uri === 'string' && uri.trim() === '') {
        // Empty URI → auto-generate from current or new name
        const nameSource = typeof name === 'string' ? name.trim() : existing.catName
        uriSegment = slugify(nameSource)
      }
    }

    // Validate order if provided
    let orderValue: number | undefined
    if (order !== undefined && order !== null && order !== '') {
      const parsed = Number(order)
      if (isNaN(parsed) || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return c.json({ error: 'Order must be an integer value' }, 400)
      }
      orderValue = parsed
    }

    // Validate parent if provided
    let parentId: number | undefined
    if (parent !== undefined) {
      const parsedParent = parent !== null && parent !== '' ? parseInt(String(parent), 10) : 0
      if (isNaN(parsedParent) || parsedParent < 0) {
        return c.json({ error: 'Invalid parent category ID' }, 400)
      }
      if (parsedParent !== 0) {
        const parentCat = db.select().from(categories).where(eq(categories.catId, parsedParent)).get()
        if (!parentCat) {
          return c.json({ error: 'Parent category not found' }, 400)
        }
        // Prevent circular references
        if (parsedParent === id) {
          return c.json({ error: 'Category cannot be its own parent' }, 400)
        }
      }
      parentId = parsedParent
    }

    // Determine if URI needs to be rebuilt
    // URI needs rebuild if: URI segment changed, or parent changed
    let newFullUri: string | undefined
    const effectiveParentId = parentId !== undefined ? parentId : existing.catParent

    if (uriSegment !== undefined || parentId !== undefined) {
      // Use provided segment or derive from existing URI
      const segment = uriSegment ?? getUriSegment(existing.catUri)
      newFullUri = buildHierarchicalUri(db, effectiveParentId, segment)
      // Ensure uniqueness (exclude current category)
      newFullUri = ensureUniqueUri(db, newFullUri, id)
    }

    // Handle image upload
    let imageName: string | undefined
    if (imageFile && imageFile.size > 0) {
      const imageResult = await handleImageUpload(imageFile)
      if ('error' in imageResult) {
        return c.json({ error: imageResult.error }, 400)
      }
      imageName = imageResult.filename

      // Delete old image if it exists
      if (existing.catImage) {
        await deleteCategoryImage(existing.catImage)
      }

      // Save new image to disk
      const uploadsDir = getUploadsDir()
      const categoriesDir = resolve(uploadsDir, 'categories')
      await mkdir(categoriesDir, { recursive: true })
      const imagePath = resolve(categoriesDir, imageName)
      await Bun.write(imagePath, imageFile)
    }

    // Build update values (only update fields that were provided)
    const updateValues: Partial<typeof categories.$inferInsert> = {}

    if (name !== undefined) updateValues.catName = name.trim()
    if (newFullUri !== undefined) updateValues.catUri = newFullUri
    if (description !== undefined && typeof description === 'string')
      updateValues.catDescription = description
    if (display !== undefined)
      updateValues.catDisplay = display === 'yes' || display === 'y' ? 'yes' : 'no'
    if (allowAds !== undefined)
      updateValues.catAllowads = allowAds === 'yes' || allowAds === 'y' ? 'yes' : 'no'
    if (parentId !== undefined) updateValues.catParent = parentId
    if (keywords !== undefined && typeof keywords === 'string')
      updateValues.catKeywords = keywords
    if (orderValue !== undefined) updateValues.catOrder = orderValue
    if (promo !== undefined && typeof promo === 'string')
      updateValues.catPromo = promo
    if (imageName !== undefined) updateValues.catImage = imageName

    if (Object.keys(updateValues).length > 0) {
      db.update(categories).set(updateValues).where(eq(categories.catId, id)).run()
    }

    const updated = db.select().from(categories).where(eq(categories.catId, id)).get()

    return c.json({ data: updated })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/categories/:id/image
  // Delete the image for a category
  // Requires: can_manage_categories
  // -------------------------------------------------------------------------
  router.delete('/:id/image', requireManageCategories, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const category = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    if (!category.catImage) {
      return c.json({ error: 'Category has no image' }, 400)
    }

    // Delete file from disk
    await deleteCategoryImage(category.catImage)

    // Clear image from DB
    db.update(categories)
      .set({ catImage: '' })
      .where(eq(categories.catId, id))
      .run()

    return c.json({ data: { deleted: true, catId: id } })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/categories/:id
  // Delete a category
  // Requires: can_delete_categories
  // - If no articles: delete directly
  // - If has articles: require newCatId in body to reassign articles
  // -------------------------------------------------------------------------
  router.delete('/:id', requireDeleteCategories, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid category ID' }, 400)
    }

    const category = db.select().from(categories).where(eq(categories.catId, id)).get()
    if (!category) {
      return c.json({ error: 'Category not found' }, 404)
    }

    // Count articles in this category
    const articleCountResult = db
      .select({ count: count() })
      .from(article2cat)
      .where(eq(article2cat.categoryIdRel, id))
      .get()

    const articleCount = articleCountResult?.count ?? 0

    if (articleCount > 0) {
      // Articles exist — require newCatId for reassignment
      let body: Record<string, unknown> = {}
      try {
        body = await c.req.json()
      } catch {
        // Body may be empty or not JSON — that's ok for validation
      }

      const { newCatId } = body as { newCatId?: unknown }

      if (newCatId === undefined || newCatId === null || newCatId === '') {
        return c.json(
          {
            error: 'This category has articles. Provide newCatId to reassign articles before deletion.',
            articleCount,
          },
          400,
        )
      }

      const newCatIdParsed = parseInt(String(newCatId), 10)
      if (isNaN(newCatIdParsed) || newCatIdParsed <= 0) {
        return c.json({ error: 'Invalid newCatId' }, 400)
      }

      if (newCatIdParsed === id) {
        return c.json({ error: 'newCatId must be a different category' }, 400)
      }

      const newCategory = db
        .select()
        .from(categories)
        .where(eq(categories.catId, newCatIdParsed))
        .get()
      if (!newCategory) {
        return c.json({ error: 'New category not found' }, 400)
      }

      // Reassign articles: update article2cat rows that point to the old category
      // But avoid creating duplicate entries if article already belongs to newCatId
      // First, get articles that don't already have the new category
      const articlesInOldCat = db
        .select({ articleId: article2cat.articleIdRel })
        .from(article2cat)
        .where(eq(article2cat.categoryIdRel, id))
        .all()

      for (const { articleId } of articlesInOldCat) {
        // Check if this article already belongs to the new category
        const existingLink = db
          .select()
          .from(article2cat)
          .where(
            and(
              eq(article2cat.articleIdRel, articleId),
              eq(article2cat.categoryIdRel, newCatIdParsed),
            ),
          )
          .get()

        if (existingLink) {
          // Article already in new category — just remove old link
          db.delete(article2cat)
            .where(
              and(
                eq(article2cat.articleIdRel, articleId),
                eq(article2cat.categoryIdRel, id),
              ),
            )
            .run()
        } else {
          // Reassign: update the link
          db.update(article2cat)
            .set({ categoryIdRel: newCatIdParsed })
            .where(
              and(
                eq(article2cat.articleIdRel, articleId),
                eq(article2cat.categoryIdRel, id),
              ),
            )
            .run()
        }
      }
    }

    // Delete all remaining article2cat links (should be 0 after reassignment, or was 0)
    db.delete(article2cat).where(eq(article2cat.categoryIdRel, id)).run()

    // Delete category image
    if (category.catImage) {
      await deleteCategoryImage(category.catImage)
    }

    // Delete the category
    db.delete(categories).where(eq(categories.catId, id)).run()

    return c.json({ data: { deleted: true, catId: id, articleCount } })
  })

  return router
}

// ---------------------------------------------------------------------------
// Image upload helper
// ---------------------------------------------------------------------------

async function handleImageUpload(
  file: File,
): Promise<{ filename: string } | { error: string }> {
  // Validate file type
  const originalName = file.name || 'image'
  const ext = extname(originalName).toLowerCase().replace('.', '')
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      error: `Image type ".${ext}" is not allowed. Allowed types: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
    }
  }

  // Validate file size (max 100KB)
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      error: `Image is too large. Maximum size is 100KB (${MAX_IMAGE_SIZE} bytes). File is ${file.size} bytes.`,
    }
  }

  // Build safe filename with timestamp prefix
  const safeFilename = `${Date.now()}_${sanitizeFilename(originalName)}`
  return { filename: safeFilename }
}
