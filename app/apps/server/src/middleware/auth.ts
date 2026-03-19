import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { users, userGroups } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

type UserGroupRow = typeof userGroups.$inferSelect
type CanPermission = {
  [K in keyof UserGroupRow]: K extends `can${string}` ? K : never
}[keyof UserGroupRow]

// ---------------------------------------------------------------------------
// requireAuth
// Rejects requests without a valid session userId (401)
// ---------------------------------------------------------------------------
export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const session = c.get('session')
  const userId = session.get('userId')

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
})

// ---------------------------------------------------------------------------
// requireAdmin
// Rejects requests from users who don't have canAccessAdmin = 'y' (401/403)
// ---------------------------------------------------------------------------
export function createRequireAdmin(db: DrizzleDB) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const session = c.get('session')
    const userId = session.get('userId')

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const user = await db.query.users.findFirst({
      where: eq(users.userId, userId),
      with: { group: true },
    })

    if (!user || user.group.canAccessAdmin !== 'y') {
      return c.json({ error: 'Forbidden: admin access required' }, 403)
    }

    await next()
  })
}

// ---------------------------------------------------------------------------
// requireRole
// Rejects requests from users who lack the specified permission (401/403)
// ---------------------------------------------------------------------------
export function createRequireRole(db: DrizzleDB) {
  return (permission: CanPermission) =>
    createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
      const session = c.get('session')
      const userId = session.get('userId')

      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const user = await db.query.users.findFirst({
        where: eq(users.userId, userId),
        with: { group: true },
      })

      if (!user || user.group[permission] !== 'y') {
        return c.json({ error: 'Forbidden: insufficient permissions' }, 403)
      }

      await next()
    })
}
