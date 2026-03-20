import { Hono } from 'hono'
import { eq, like, or, and, ne, count, asc, desc, gte } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { users, userGroups, userNotes, failedLogins } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a Gravatar MD5 hash from an email address.
 */
function gravatarHash(email: string): string {
  return createHash('md5').update(email.trim().toLowerCase()).digest('hex')
}

/**
 * Generate a random 32-character hexadecimal API key.
 */
function generateApiKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Simple email format validation.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate username is alphanumeric only (letters and digits).
 */
function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value)
}

// Sort field map
type SortField = 'username' | 'email' | 'joinDate' | 'lastLogin' | 'group'
const SORT_COLUMNS: Record<SortField, typeof users.userUsername | typeof users.userEmail | typeof users.userJoinDate | typeof users.userLastLogin | typeof users.userGroup> = {
  username: users.userUsername,
  email: users.userEmail,
  joinDate: users.userJoinDate,
  lastLogin: users.userLastLogin,
  group: users.userGroup,
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createUserRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  const requireManageUsers = createRequireRole(db)('canManageUsers')

  // All user admin routes require user-management permission
  router.use('*', requireManageUsers)

  // -------------------------------------------------------------------------
  // GET /api/admin/users/failed-logins
  // Aggregated failed login activity by IP (24h window by default)
  // -------------------------------------------------------------------------
  router.get('/failed-logins', async (c) => {
    const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') ?? '100', 10)))
    const windowHours = Math.min(168, Math.max(1, parseInt(c.req.query('windowHours') ?? '24', 10)))
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - (windowHours * 3600)

    const rows = db
      .select({
        failedId: failedLogins.failedId,
        failedUsername: failedLogins.failedUsername,
        failedIp: failedLogins.failedIp,
        failedDate: failedLogins.failedDate,
      })
      .from(failedLogins)
      .where(gte(failedLogins.failedDate, cutoff))
      .orderBy(desc(failedLogins.failedDate))
      .limit(limit)
      .all()

    const byIp = new Map<string, {
      failedIp: string
      attempts: number
      lastFailedDate: number
      usernames: Set<string>
    }>()

    for (const row of rows) {
      const existing = byIp.get(row.failedIp)
      if (existing) {
        existing.attempts += 1
        existing.lastFailedDate = Math.max(existing.lastFailedDate, row.failedDate)
        if (row.failedUsername) {
          existing.usernames.add(row.failedUsername)
        }
      } else {
        byIp.set(row.failedIp, {
          failedIp: row.failedIp,
          attempts: 1,
          lastFailedDate: row.failedDate,
          usernames: new Set(row.failedUsername ? [row.failedUsername] : []),
        })
      }
    }

    const data = Array.from(byIp.values())
      .map((entry) => {
        const secondsSinceLast = Math.max(0, now - entry.lastFailedDate)
        let status: 'none' | 'delay30' | 'delay60' | 'lockout' = 'none'
        let retryAfterSeconds = 0

        if (entry.attempts >= 10) {
          status = 'lockout'
          retryAfterSeconds = Math.max(0, (24 * 3600) - secondsSinceLast)
        } else if (entry.attempts >= 5) {
          status = 'delay60'
          retryAfterSeconds = Math.max(0, 60 - secondsSinceLast)
        } else if (entry.attempts >= 3) {
          status = 'delay30'
          retryAfterSeconds = Math.max(0, 30 - secondsSinceLast)
        }

        return {
          failedIp: entry.failedIp,
          attempts: entry.attempts,
          lastFailedDate: entry.lastFailedDate,
          usernames: Array.from(entry.usernames).sort(),
          status,
          retryAfterSeconds,
        }
      })
      .sort((a, b) => b.attempts - a.attempts || b.lastFailedDate - a.lastFailedDate)

    return c.json({
      data,
      windowHours,
      totalIps: data.length,
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/users/search?q=term
  // Search users by username or email (for author field AJAX lookup)
  // This must come before /:id to avoid routing conflicts
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

  // -------------------------------------------------------------------------
  // GET /api/admin/users
  // Paginated, searchable, sortable list of users with group info
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)))
    const sortParam = (c.req.query('sort') ?? 'username') as SortField
    const orderParam = c.req.query('order') === 'desc' ? 'desc' : 'asc'
    const search = (c.req.query('search') ?? '').trim()
    const offset = (page - 1) * limit

    const sortCol = SORT_COLUMNS[sortParam] ?? users.userUsername
    const orderFn = orderParam === 'asc' ? asc : desc

    const whereClause = search
      ? or(
          like(users.userUsername, `%${search}%`),
          like(users.userEmail, `%${search}%`),
        )
      : undefined

    // Get total count
    const totalResult = db
      .select({ value: count() })
      .from(users)
      .where(whereClause)
      .get()
    const total = totalResult?.value ?? 0

    // Get paginated rows with group join
    const rows = db
      .select({
        userId: users.userId,
        userUsername: users.userUsername,
        userEmail: users.userEmail,
        userGroup: users.userGroup,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userApiKey: users.userApiKey,
        groupName: userGroups.groupName,
      })
      .from(users)
      .leftJoin(userGroups, eq(users.userGroup, userGroups.groupId))
      .where(whereClause)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset)
      .all()

    const data = rows.map((row) => ({
      ...row,
      gravatarHash: gravatarHash(row.userEmail),
    }))

    return c.json({ data, total, page })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/users/:id
  // Single user with group info
  // -------------------------------------------------------------------------
  router.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const row = db
      .select({
        userId: users.userId,
        userUsername: users.userUsername,
        userEmail: users.userEmail,
        userGroup: users.userGroup,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userApiKey: users.userApiKey,
        groupName: userGroups.groupName,
      })
      .from(users)
      .leftJoin(userGroups, eq(users.userGroup, userGroups.groupId))
      .where(eq(users.userId, id))
      .get()

    if (!row) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({
      data: {
        ...row,
        gravatarHash: gravatarHash(row.userEmail),
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/users
  // Create a new user
  // -------------------------------------------------------------------------
  router.post('/', async (c) => {
    const body = await c.req.json() as {
      userUsername?: string
      userEmail?: string
      userGroup?: number
      userPassword?: string
      confirmPassword?: string
    }

    const username = (body.userUsername ?? '').trim()
    const email = (body.userEmail ?? '').trim()
    const group = body.userGroup
    const password = body.userPassword ?? ''
    const confirm = body.confirmPassword ?? ''

    // Validate username
    if (!username) {
      return c.json({ error: 'Username is required' }, 400)
    }
    if (!isAlphanumeric(username)) {
      return c.json({ error: 'Username must be alphanumeric (letters and digits only)' }, 400)
    }

    // Validate email
    if (!email) {
      return c.json({ error: 'Email address is required' }, 400)
    }
    if (!isValidEmail(email)) {
      return c.json({ error: 'Please enter a valid email address' }, 400)
    }

    // Validate group
    if (group === undefined || group === null || isNaN(Number(group))) {
      return c.json({ error: 'User group is required' }, 400)
    }
    const groupId = Number(group)
    const groupRow = db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(eq(userGroups.groupId, groupId))
      .get()
    if (!groupRow) {
      return c.json({ error: 'User group does not exist' }, 400)
    }

    // Validate password
    if (!password) {
      return c.json({ error: 'Password is required' }, 400)
    }
    if (password !== confirm) {
      return c.json({ error: 'Passwords do not match' }, 400)
    }

    // Check username uniqueness
    const existingUsername = db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.userUsername, username))
      .get()
    if (existingUsername) {
      return c.json({ error: 'Username is already in use' }, 400)
    }

    // Check email uniqueness
    const existingEmail = db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.userEmail, email))
      .get()
    if (existingEmail) {
      return c.json({ error: 'Email address is already in use' }, 400)
    }

    // Hash password and generate API key
    const hashedPassword = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 })
    const apiKey = generateApiKey()
    const now = Math.floor(Date.now() / 1000)

    const [inserted] = db
      .insert(users)
      .values({
        userUsername: username,
        userEmail: email,
        userGroup: groupId,
        userPassword: hashedPassword,
        userApiKey: apiKey,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userIp: '',
        userCookie: '',
        userSession: '',
        userVerify: '',
      })
      .returning({
        userId: users.userId,
        userUsername: users.userUsername,
        userEmail: users.userEmail,
        userGroup: users.userGroup,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userApiKey: users.userApiKey,
      })
      .all()

    return c.json(
      {
        data: {
          ...inserted,
          gravatarHash: gravatarHash(inserted.userEmail),
        },
      },
      201,
    )
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/users/:id
  // Update user — uniqueness excludes self, password optional, prevent last admin demotion
  // -------------------------------------------------------------------------
  router.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    // Check user exists
    const existing = db.select().from(users).where(eq(users.userId, id)).get()
    if (!existing) {
      return c.json({ error: 'User not found' }, 404)
    }

    const body = await c.req.json() as {
      userUsername?: string
      userEmail?: string
      userGroup?: number
      userPassword?: string
      confirmPassword?: string
    }

    const username = (body.userUsername ?? '').trim()
    const email = (body.userEmail ?? '').trim()
    const group = body.userGroup
    const password = body.userPassword ?? ''
    const confirm = body.confirmPassword ?? ''

    // Validate username
    if (!username) {
      return c.json({ error: 'Username is required' }, 400)
    }
    if (!isAlphanumeric(username)) {
      return c.json({ error: 'Username must be alphanumeric (letters and digits only)' }, 400)
    }

    // Validate email
    if (!email) {
      return c.json({ error: 'Email address is required' }, 400)
    }
    if (!isValidEmail(email)) {
      return c.json({ error: 'Please enter a valid email address' }, 400)
    }

    // Validate group
    if (group === undefined || group === null || isNaN(Number(group))) {
      return c.json({ error: 'User group is required' }, 400)
    }
    const groupId = Number(group)
    const targetGroup = db
      .select({ groupId: userGroups.groupId })
      .from(userGroups)
      .where(eq(userGroups.groupId, groupId))
      .get()
    if (!targetGroup) {
      return c.json({ error: 'User group does not exist' }, 400)
    }

    // Validate password if provided
    if (password) {
      if (password !== confirm) {
        return c.json({ error: 'Passwords do not match' }, 400)
      }
    }

    // Username uniqueness (exclude self)
    const existingUsername = db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userUsername, username), ne(users.userId, id)))
      .get()
    if (existingUsername) {
      return c.json({ error: 'Username is already in use' }, 400)
    }

    // Email uniqueness (exclude self)
    const existingEmail = db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userEmail, email), ne(users.userId, id)))
      .get()
    if (existingEmail) {
      return c.json({ error: 'Email address is already in use' }, 400)
    }

    // Prevent demoting the last admin (group 1)
    if (existing.userGroup === 1 && groupId !== 1) {
      const adminCount = db
        .select({ value: count() })
        .from(users)
        .where(eq(users.userGroup, 1))
        .get()
      if ((adminCount?.value ?? 0) <= 1) {
        return c.json({ error: 'Cannot demote the last admin user' }, 400)
      }
    }

    // Build update object
    const updateData: Partial<typeof users.$inferInsert> = {
      userUsername: username,
      userEmail: email,
      userGroup: groupId,
    }

    // Only update password if provided
    if (password) {
      updateData.userPassword = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 })
    }

    const [updated] = db
      .update(users)
      .set(updateData)
      .where(eq(users.userId, id))
      .returning({
        userId: users.userId,
        userUsername: users.userUsername,
        userEmail: users.userEmail,
        userGroup: users.userGroup,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userApiKey: users.userApiKey,
      })
      .all()

    const groupRow = db
      .select({ groupName: userGroups.groupName })
      .from(userGroups)
      .where(eq(userGroups.groupId, updated.userGroup))
      .get()

    return c.json({
      data: {
        ...updated,
        groupName: groupRow?.groupName ?? '',
        gravatarHash: gravatarHash(updated.userEmail),
      },
    })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/users/:id
  // Delete a user
  // -------------------------------------------------------------------------
  router.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const existing = db
      .select({ userId: users.userId, userGroup: users.userGroup })
      .from(users)
      .where(eq(users.userId, id))
      .get()
    if (!existing) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Prevent deleting the last remaining admin account.
    if (existing.userGroup === 1) {
      const adminCount = db
        .select({ value: count() })
        .from(users)
        .where(eq(users.userGroup, 1))
        .get()
      if ((adminCount?.value ?? 0) <= 1) {
        return c.json({ error: 'Cannot delete the last admin user' }, 400)
      }
    }

    db.delete(users).where(eq(users.userId, id)).run()

    return c.json({ data: { success: true } })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/users/:id/reset-api-key
  // Generate and save a new API key for the user
  // -------------------------------------------------------------------------
  router.post('/:id/reset-api-key', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const existing = db.select({ userId: users.userId }).from(users).where(eq(users.userId, id)).get()
    if (!existing) {
      return c.json({ error: 'User not found' }, 404)
    }

    const newKey = generateApiKey()
    db.update(users).set({ userApiKey: newKey }).where(eq(users.userId, id)).run()

    return c.json({ data: { userApiKey: newKey } })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/users/:id/notes
  // List all notes for a user (important notes first, then by date desc)
  // -------------------------------------------------------------------------
  router.get('/:id/notes', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const user = db.select({ userId: users.userId }).from(users).where(eq(users.userId, id)).get()
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const notes = db
      .select()
      .from(userNotes)
      .where(eq(userNotes.noteUserId, id))
      .orderBy(desc(userNotes.noteImportant), desc(userNotes.noteDate))
      .all()

    return c.json({ data: notes })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/users/:id/notes
  // Create a new note for a user
  // Body: { note: string (required), noteImportant?: 'y' | 'n' }
  // Sets noteAddedBy from the current session user
  // -------------------------------------------------------------------------
  router.post('/:id/notes', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }

    const user = db.select({ userId: users.userId }).from(users).where(eq(users.userId, id)).get()
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const body = await c.req.json() as {
      note?: string
      noteImportant?: string
    }

    const noteText = (body.note ?? '').trim()
    if (!noteText) {
      return c.json({ error: 'Note text is required' }, 400)
    }

    const noteImportant: 'y' | 'n' = body.noteImportant === 'y' ? 'y' : 'n'
    const addedBy = c.get('session').get('userId') ?? 0
    const now = Math.floor(Date.now() / 1000)

    const [inserted] = db
      .insert(userNotes)
      .values({
        noteUserId: id,
        noteAddedBy: addedBy,
        noteDate: now,
        note: noteText,
        noteImportant,
        noteShowUser: 'n',
      })
      .returning()
      .all()

    return c.json({ data: inserted }, 201)
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/users/:id/notes/:noteId
  // Update a note
  // Body: { note: string (required), noteImportant?: 'y' | 'n' }
  // -------------------------------------------------------------------------
  router.put('/:id/notes/:noteId', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const noteId = parseInt(c.req.param('noteId'), 10)
    if (isNaN(id) || isNaN(noteId)) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    const existing = db
      .select()
      .from(userNotes)
      .where(and(eq(userNotes.noteId, noteId), eq(userNotes.noteUserId, id)))
      .get()
    if (!existing) {
      return c.json({ error: 'Note not found' }, 404)
    }

    const body = await c.req.json() as {
      note?: string
      noteImportant?: string
    }

    const noteText = (body.note ?? '').trim()
    if (!noteText) {
      return c.json({ error: 'Note text is required' }, 400)
    }

    const noteImportant: 'y' | 'n' = body.noteImportant === 'y' ? 'y' : 'n'

    const [updated] = db
      .update(userNotes)
      .set({ note: noteText, noteImportant })
      .where(eq(userNotes.noteId, noteId))
      .returning()
      .all()

    return c.json({ data: updated })
  })

  // -------------------------------------------------------------------------
  // DELETE /api/admin/users/:id/notes/:noteId
  // Delete a note
  // -------------------------------------------------------------------------
  router.delete('/:id/notes/:noteId', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    const noteId = parseInt(c.req.param('noteId'), 10)
    if (isNaN(id) || isNaN(noteId)) {
      return c.json({ error: 'Invalid ID' }, 400)
    }

    const existing = db
      .select()
      .from(userNotes)
      .where(and(eq(userNotes.noteId, noteId), eq(userNotes.noteUserId, id)))
      .get()
    if (!existing) {
      return c.json({ error: 'Note not found' }, 404)
    }

    db.delete(userNotes).where(eq(userNotes.noteId, noteId)).run()

    return c.json({ data: { success: true } })
  })

  return router
}
