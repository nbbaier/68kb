import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { users, userGroups } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value)
}

export function createPublicUserProfileRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/users/profile/:username
  // Public-facing user profile details
  // -------------------------------------------------------------------------
  router.get('/profile/:username', (c) => {
    const username = (c.req.param('username') ?? '').trim()
    if (!username || !isAlphanumeric(username)) {
      return c.json({ error: 'Invalid username' }, 400)
    }

    const user = db
      .select({
        userId: users.userId,
        userUsername: users.userUsername,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userGroup: users.userGroup,
        groupName: userGroups.groupName,
      })
      .from(users)
      .innerJoin(
        userGroups,
        and(eq(users.userGroup, userGroups.groupId), eq(userGroups.canViewSite, 'y')),
      )
      .where(eq(users.userUsername, username))
      .get()

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({
      data: {
        userId: user.userId,
        username: user.userUsername,
        userGroup: user.userGroup,
        groupName: user.groupName,
        userJoinDate: user.userJoinDate,
        userLastLogin: user.userLastLogin,
      },
    })
  })

  return router
}
