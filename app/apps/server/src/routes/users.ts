import { Hono } from 'hono'
import { like, or } from 'drizzle-orm'
import { users } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

export function createUserRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/admin/users/search?q=term
  // Search users by username or email (for author field AJAX lookup)
  // -------------------------------------------------------------------------
  router.get('/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()

    if (q.length < 1) {
      return c.json({ data: [] })
    }

    const results = db
      .select({
        userId: users.userId,
        username: users.userUsername,
        email: users.userEmail,
      })
      .from(users)
      .where(
        or(
          like(users.userUsername, `%${q}%`),
          like(users.userEmail, `%${q}%`),
        ),
      )
      .limit(10)
      .all()

    return c.json({ data: results })
  })

  return router
}
