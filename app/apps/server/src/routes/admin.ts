import { Hono } from 'hono'
import { eq, count } from 'drizzle-orm'
import { settings, users } from '../db/schema'
import { createRequireAdmin } from '../middleware/auth'
import { createArticleRoutes } from './articles'
import { createCategoryRoutes } from './categories'
import { createUserRoutes } from './users'
import { createAdminGlossaryRoutes } from './glossary'
import type { AppVariables, DrizzleDB } from '../types'

export function createAdminRoutes(db: DrizzleDB) {
  const admin = new Hono<{ Variables: AppVariables }>()

  const requireAdmin = createRequireAdmin(db)

  // Apply requireAdmin middleware globally to all /api/admin/* routes
  admin.use('*', requireAdmin)

  // ---------------------------------------------------------------------------
  // GET /api/admin/stats
  // Dashboard statistics: app version, user count
  // Requires admin session (enforced globally above)
  // ---------------------------------------------------------------------------
  admin.get('/stats', (c) => {
    const versionSetting = db
      .select({ optionValue: settings.optionValue })
      .from(settings)
      .where(eq(settings.optionName, 'script_version'))
      .get()

    const version = versionSetting?.optionValue ?? '1.0.0'

    const userCountResult = db
      .select({ value: count() })
      .from(users)
      .get()

    const userCount = userCountResult?.value ?? 0

    return c.json({
      data: {
        version,
        userCount,
      },
    })
  })

  // Mount articles CRUD routes
  admin.route('/articles', createArticleRoutes(db))

  // Mount categories routes
  admin.route('/categories', createCategoryRoutes(db))

  // Mount user routes (includes /search)
  admin.route('/users', createUserRoutes(db))

  // Mount glossary admin routes
  admin.route('/glossary', createAdminGlossaryRoutes(db))

  return admin
}
