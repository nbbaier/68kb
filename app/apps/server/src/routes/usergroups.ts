import { Hono } from 'hono'
import { eq, count, asc } from 'drizzle-orm'
import { userGroups, users } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Coerce a value to 'y' or 'n' for permission fields.
 */
function toYN(val: unknown): 'y' | 'n' {
  return val === 'y' ? 'y' : 'n'
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createUserGroupRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  const requireManageUsers = createRequireRole(db)('canManageUsers')

  // -------------------------------------------------------------------------
  // GET /api/admin/usergroups
  // List all groups with member counts (ordered by group_id ASC)
  // No additional permission beyond admin access (used by user forms too)
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const groups = db
      .select({
        groupId: userGroups.groupId,
        groupName: userGroups.groupName,
        groupDescription: userGroups.groupDescription,
        canViewSite: userGroups.canViewSite,
        canAccessAdmin: userGroups.canAccessAdmin,
        canManageArticles: userGroups.canManageArticles,
        canDeleteArticles: userGroups.canDeleteArticles,
        canManageUsers: userGroups.canManageUsers,
        canManageCategories: userGroups.canManageCategories,
        canDeleteCategories: userGroups.canDeleteCategories,
        canManageSettings: userGroups.canManageSettings,
        canManageUtilities: userGroups.canManageUtilities,
        canManageThemes: userGroups.canManageThemes,
        canManageModules: userGroups.canManageModules,
        canSearch: userGroups.canSearch,
      })
      .from(userGroups)
      .orderBy(asc(userGroups.groupId))
      .all()

    // Attach member counts
    const data = groups.map((group) => {
      const result = db
        .select({ value: count() })
        .from(users)
        .where(eq(users.userGroup, group.groupId))
        .get()
      return {
        ...group,
        memberCount: result?.value ?? 0,
      }
    })

    return c.json({ data })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/usergroups/:id
  // Single group with member count
  // -------------------------------------------------------------------------
  router.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid group ID' }, 400)
    }

    const group = db
      .select()
      .from(userGroups)
      .where(eq(userGroups.groupId, id))
      .get()

    if (!group) {
      return c.json({ error: 'Group not found' }, 404)
    }

    const result = db
      .select({ value: count() })
      .from(users)
      .where(eq(users.userGroup, id))
      .get()

    return c.json({
      data: {
        ...group,
        memberCount: result?.value ?? 0,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/usergroups
  // Create a new group (name + description required, 11 permissions)
  // Requires can_manage_users
  // -------------------------------------------------------------------------
  router.post('/', requireManageUsers, async (c) => {
    const body = await c.req.json() as {
      groupName?: string
      groupDescription?: string
      canViewSite?: string
      canAccessAdmin?: string
      canManageArticles?: string
      canDeleteArticles?: string
      canManageUsers?: string
      canManageCategories?: string
      canDeleteCategories?: string
      canManageSettings?: string
      canManageUtilities?: string
      canManageThemes?: string
      canManageModules?: string
    }

    const name = (body.groupName ?? '').trim()
    const description = (body.groupDescription ?? '').trim()

    if (!name) {
      return c.json({ error: 'Group name is required' }, 400)
    }
    if (!description) {
      return c.json({ error: 'Group description is required' }, 400)
    }

    const [inserted] = db
      .insert(userGroups)
      .values({
        groupName: name,
        groupDescription: description,
        canViewSite: toYN(body.canViewSite),
        canAccessAdmin: toYN(body.canAccessAdmin),
        canManageArticles: toYN(body.canManageArticles),
        canDeleteArticles: toYN(body.canDeleteArticles),
        canManageUsers: toYN(body.canManageUsers),
        canManageCategories: toYN(body.canManageCategories),
        canDeleteCategories: toYN(body.canDeleteCategories),
        canManageSettings: toYN(body.canManageSettings),
        canManageUtilities: toYN(body.canManageUtilities),
        canManageThemes: toYN(body.canManageThemes),
        canManageModules: toYN(body.canManageModules),
      })
      .returning()
      .all()

    return c.json({ data: { ...inserted, memberCount: 0 } }, 201)
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/usergroups/:id
  // Update a group.
  // For group 1 (Site Admins): only name and description can be changed.
  // For all other groups: name, description, and all 11 permissions.
  // Requires can_manage_users
  // -------------------------------------------------------------------------
  router.put('/:id', requireManageUsers, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid group ID' }, 400)
    }

    const existing = db
      .select()
      .from(userGroups)
      .where(eq(userGroups.groupId, id))
      .get()

    if (!existing) {
      return c.json({ error: 'Group not found' }, 404)
    }

    const body = await c.req.json() as {
      groupName?: string
      groupDescription?: string
      canViewSite?: string
      canAccessAdmin?: string
      canManageArticles?: string
      canDeleteArticles?: string
      canManageUsers?: string
      canManageCategories?: string
      canDeleteCategories?: string
      canManageSettings?: string
      canManageUtilities?: string
      canManageThemes?: string
      canManageModules?: string
    }

    const name = (body.groupName ?? '').trim()
    const description = (body.groupDescription ?? '').trim()

    if (!name) {
      return c.json({ error: 'Group name is required' }, 400)
    }
    if (!description) {
      return c.json({ error: 'Group description is required' }, 400)
    }

    // For group 1 (Site Admins), only allow updating name and description
    const updateData: Partial<typeof userGroups.$inferInsert> =
      id === 1
        ? { groupName: name, groupDescription: description }
        : {
            groupName: name,
            groupDescription: description,
            canViewSite: toYN(body.canViewSite),
            canAccessAdmin: toYN(body.canAccessAdmin),
            canManageArticles: toYN(body.canManageArticles),
            canDeleteArticles: toYN(body.canDeleteArticles),
            canManageUsers: toYN(body.canManageUsers),
            canManageCategories: toYN(body.canManageCategories),
            canDeleteCategories: toYN(body.canDeleteCategories),
            canManageSettings: toYN(body.canManageSettings),
            canManageUtilities: toYN(body.canManageUtilities),
            canManageThemes: toYN(body.canManageThemes),
            canManageModules: toYN(body.canManageModules),
          }

    const [updated] = db
      .update(userGroups)
      .set(updateData)
      .where(eq(userGroups.groupId, id))
      .returning()
      .all()

    const result = db
      .select({ value: count() })
      .from(users)
      .where(eq(users.userGroup, id))
      .get()

    return c.json({
      data: {
        ...updated,
        memberCount: result?.value ?? 0,
      },
    })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/usergroups/:id
  // Delete a group.
  // Blocked for system groups 1-5.
  // Blocked if the group has members.
  // Requires can_manage_users
  // -------------------------------------------------------------------------
  router.delete('/:id', requireManageUsers, async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid group ID' }, 400)
    }

    // Block system groups 1-5
    if (id >= 1 && id <= 5) {
      return c.json({ error: 'System groups cannot be deleted' }, 400)
    }

    const existing = db
      .select()
      .from(userGroups)
      .where(eq(userGroups.groupId, id))
      .get()

    if (!existing) {
      return c.json({ error: 'Group not found' }, 404)
    }

    // Block if group has members
    const memberResult = db
      .select({ value: count() })
      .from(users)
      .where(eq(users.userGroup, id))
      .get()

    if ((memberResult?.value ?? 0) > 0) {
      return c.json(
        { error: 'Cannot delete a group that has members. Reassign members first.' },
        400,
      )
    }

    db.delete(userGroups).where(eq(userGroups.groupId, id)).run()

    return c.json({ data: { success: true } })
  })

  return router
}
