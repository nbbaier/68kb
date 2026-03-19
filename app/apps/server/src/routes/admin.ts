import { Hono } from 'hono'
import { eq, count } from 'drizzle-orm'
import { settings, users } from '../db/schema'
import { createRequireAdmin } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

export function createAdminRoutes(db: DrizzleDB) {
  const admin = new Hono<{ Variables: AppVariables }>()

  const requireAdmin = createRequireAdmin(db)

  // ---------------------------------------------------------------------------
  // GET /api/admin/stats
  // Dashboard statistics: app version, user count
  // Requires admin session
  // ---------------------------------------------------------------------------
  admin.get('/stats', requireAdmin, (c) => {
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

  return admin
}
