import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { users, failedLogins, userGroups } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

// Pre-computed bcrypt hash used for timing-safe user-not-found responses.
// Running Bun.password.verify() against this dummy hash when a user is not found
// equalizes response time with the valid-user-wrong-password path, preventing
// timing-based username enumeration attacks.
// Computed once at module load time using top-level await (Bun/ESM supports this).
const DUMMY_BCRYPT_HASH = await Bun.password.hash('__timing_safe_dummy_placeholder__', {
  algorithm: 'bcrypt',
  cost: 12,
})

// Permission keys returned in /api/auth/me
const PERMISSION_KEYS = [
  'canAccessAdmin',
  'canManageArticles',
  'canDeleteArticles',
  'canManageUsers',
  'canManageCategories',
  'canDeleteCategories',
  'canManageSettings',
  'canManageUtilities',
  'canManageThemes',
  'canManageModules',
  'canSearch',
] as const

const INVALID_CREDENTIALS_MSG = 'Invalid username or password'

export function createAuthRoutes(db: DrizzleDB) {
  const auth = new Hono<{ Variables: AppVariables }>()

  // ---------------------------------------------------------------------------
  // POST /api/auth/login
  // Validate credentials, create session, track failed logins
  // ---------------------------------------------------------------------------
  auth.post('/login', async (c) => {
    let body: { username?: string; password?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const { username, password } = body

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '127.0.0.1'
    const now = Math.floor(Date.now() / 1000)

    // Find user by username
    const user = db.select().from(users).where(eq(users.userUsername, username)).get()

    if (!user) {
      // Run dummy verify to equalize timing with the valid-user-wrong-password path,
      // preventing timing-based username enumeration attacks.
      await Bun.password.verify(password, DUMMY_BCRYPT_HASH)
      // Track failed login — same response as wrong password (anti-enumeration)
      db.insert(failedLogins).values({
        failedUsername: username,
        failedIp: ip,
        failedDate: now,
      }).run()
      return c.json({ error: INVALID_CREDENTIALS_MSG }, 401)
    }

    // Verify password
    const isValid = await Bun.password.verify(password, user.userPassword)

    if (!isValid) {
      // Track failed login
      db.insert(failedLogins).values({
        failedUsername: username,
        failedIp: ip,
        failedDate: now,
      }).run()
      return c.json({ error: INVALID_CREDENTIALS_MSG }, 401)
    }

    // Update last login timestamp
    db.update(users)
      .set({ userLastLogin: now, lastActivity: now })
      .where(eq(users.userId, user.userId))
      .run()

    // Set session data
    const session = c.get('session')
    session.set('userId', user.userId)
    session.set('username', user.userUsername)
    session.set('userGroup', user.userGroup)

    return c.json({
      data: {
        userId: user.userId,
        username: user.userUsername,
        userGroup: user.userGroup,
        userEmail: user.userEmail,
      },
    })
  })

  // ---------------------------------------------------------------------------
  // POST /api/auth/logout
  // Destroy session
  // ---------------------------------------------------------------------------
  auth.post('/logout', (c) => {
    const session = c.get('session')
    session.deleteSession()
    return c.json({ data: { message: 'Logged out successfully' } })
  })

  // ---------------------------------------------------------------------------
  // POST /api/auth/register
  // Create user in group 2 (Registered), auto-login
  // ---------------------------------------------------------------------------
  auth.post('/register', async (c) => {
    let body: { username?: string; email?: string; password?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const { username, email, password } = body
    const errors: Record<string, string> = {}

    if (!username) errors.username = 'Username is required'
    if (!email) errors.email = 'Email is required'
    if (!password) errors.password = 'Password is required'

    if (Object.keys(errors).length > 0) {
      return c.json({ error: 'Validation failed', errors }, 400)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email!)) {
      return c.json({ error: 'Validation failed', errors: { email: 'Invalid email format' } }, 400)
    }

    // Check username uniqueness
    const existingByUsername = db
      .select()
      .from(users)
      .where(eq(users.userUsername, username!))
      .get()
    if (existingByUsername) {
      return c.json(
        { error: 'Validation failed', errors: { username: 'Username already in use' } },
        400,
      )
    }

    // Check email uniqueness
    const existingByEmail = db
      .select()
      .from(users)
      .where(eq(users.userEmail, email!))
      .get()
    if (existingByEmail) {
      return c.json(
        { error: 'Validation failed', errors: { email: 'Email already in use' } },
        400,
      )
    }

    // Hash password with bcrypt cost 12
    const hashedPassword = await Bun.password.hash(password!, {
      algorithm: 'bcrypt',
      cost: 12,
    })

    const now = Math.floor(Date.now() / 1000)
    const apiKey = crypto.randomUUID().replace(/-/g, '')
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '127.0.0.1'

    // Create user in group 2 (Registered)
    const result = db
      .insert(users)
      .values({
        userIp: ip,
        userEmail: email!,
        userUsername: username!,
        userPassword: hashedPassword,
        userGroup: 2,
        userJoinDate: now,
        userLastLogin: now,
        lastActivity: now,
        userCookie: '',
        userSession: '',
        userApiKey: apiKey,
        userVerify: '',
      })
      .returning({ userId: users.userId })
      .get()

    if (!result?.userId) {
      return c.json({ error: 'Failed to create user' }, 500)
    }

    // Auto-login: set session
    const session = c.get('session')
    session.set('userId', result.userId)
    session.set('username', username!)
    session.set('userGroup', 2)

    return c.json(
      {
        data: {
          userId: result.userId,
          username: username!,
          userGroup: 2,
          userEmail: email!,
        },
      },
      201,
    )
  })

  // ---------------------------------------------------------------------------
  // POST /api/auth/forgot-password
  // Generate reset hash and store in user_verify (same response for unknown email)
  // ---------------------------------------------------------------------------
  auth.post('/forgot-password', async (c) => {
    let body: { email?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const { email } = body

    if (!email) {
      return c.json({ error: 'Validation failed', errors: { email: 'Email is required' } }, 400)
    }

    const successMessage =
      'If that email address is in our database, we will send you a password reset link.'

    // Find user by email
    const user = db.select().from(users).where(eq(users.userEmail, email)).get()

    if (!user) {
      // Return same success message — do not reveal whether email exists
      return c.json({ data: { message: successMessage } })
    }

    // Generate a 22-character verification hash
    const verifyHash = crypto.randomUUID().replace(/-/g, '').substring(0, 22)

    db.update(users)
      .set({ userVerify: verifyHash })
      .where(eq(users.userId, user.userId))
      .run()

    return c.json({ data: { message: successMessage } })
  })

  // ---------------------------------------------------------------------------
  // POST /api/auth/reset-password
  // Validate hash, generate new password, clear hash
  // ---------------------------------------------------------------------------
  auth.post('/reset-password', async (c) => {
    let body: { hash?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const { hash } = body

    if (!hash) {
      return c.json({ error: 'Reset hash is required' }, 400)
    }

    // Find user by verify hash
    const user = db
      .select()
      .from(users)
      .where(eq(users.userVerify, hash))
      .get()

    if (!user || !user.userVerify) {
      return c.json({ error: 'Invalid or expired reset hash' }, 400)
    }

    // Generate a new random password
    const newPassword = crypto.randomUUID().replace(/-/g, '').substring(0, 16)
    const hashedPassword = await Bun.password.hash(newPassword, {
      algorithm: 'bcrypt',
      cost: 12,
    })

    // Update user: set new hashed password, clear user_verify
    db.update(users)
      .set({
        userPassword: hashedPassword,
        userVerify: '',
      })
      .where(eq(users.userId, user.userId))
      .run()

    return c.json({
      data: {
        message: 'Password has been reset successfully',
        newPassword,
      },
    })
  })

  // ---------------------------------------------------------------------------
  // GET /api/auth/me
  // Return current user from session (with group permissions)
  // ---------------------------------------------------------------------------
  auth.get('/me', (c) => {
    const session = c.get('session')
    const userId = session.get('userId')

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const result = db
      .select({
        userId: users.userId,
        userEmail: users.userEmail,
        username: users.userUsername,
        userGroup: users.userGroup,
        userJoinDate: users.userJoinDate,
        userLastLogin: users.userLastLogin,
        userApiKey: users.userApiKey,
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
      .from(users)
      .innerJoin(userGroups, eq(users.userGroup, userGroups.groupId))
      .where(eq(users.userId, userId))
      .get()

    if (!result) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Flatten permissions into a nested object for clarity
    const { canAccessAdmin, canManageArticles, canDeleteArticles, canManageUsers,
            canManageCategories, canDeleteCategories, canManageSettings, canManageUtilities,
            canManageThemes, canManageModules, canSearch, ...user } = result

    return c.json({
      data: {
        ...user,
        permissions: {
          canAccessAdmin: canAccessAdmin === 'y',
          canManageArticles: canManageArticles === 'y',
          canDeleteArticles: canDeleteArticles === 'y',
          canManageUsers: canManageUsers === 'y',
          canManageCategories: canManageCategories === 'y',
          canDeleteCategories: canDeleteCategories === 'y',
          canManageSettings: canManageSettings === 'y',
          canManageUtilities: canManageUtilities === 'y',
          canManageThemes: canManageThemes === 'y',
          canManageModules: canManageModules === 'y',
          canSearch: canSearch === 'y',
        },
      },
    })
  })

  return auth
}

// Export group permission type for use in middleware
export type UserGroupPermission = keyof typeof userGroups.$inferSelect extends infer K
  ? K extends `can${string}`
    ? K
    : never
  : never
