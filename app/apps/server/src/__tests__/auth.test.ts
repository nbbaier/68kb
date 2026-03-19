import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from '../db/schema'
import { createApp } from '../app'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle')

// ---------------------------------------------------------------------------
// Test database setup
// ---------------------------------------------------------------------------
const testSqlite = new Database(':memory:')
testSqlite.exec('PRAGMA journal_mode = WAL')
testSqlite.exec('PRAGMA foreign_keys = ON')
const testDb = drizzle({ client: testSqlite, schema })
migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER })

// Seed user groups
testDb
  .insert(schema.userGroups)
  .values([
    {
      groupId: 1,
      groupName: 'Site Admins',
      groupDescription: 'Site Administrators',
      canViewSite: 'y',
      canAccessAdmin: 'y',
      canManageArticles: 'y',
      canDeleteArticles: 'y',
      canManageUsers: 'y',
      canManageCategories: 'y',
      canDeleteCategories: 'y',
      canManageSettings: 'y',
      canManageUtilities: 'y',
      canManageThemes: 'y',
      canManageModules: 'y',
      canSearch: 'y',
    },
    {
      groupId: 2,
      groupName: 'Registered',
      groupDescription: 'Registered Users',
      canViewSite: 'y',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'y',
    },
  ])
  .run()

// Seed admin user
let adminPasswordHash: string
beforeAll(async () => {
  adminPasswordHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)
  testDb
    .insert(schema.users)
    .values({
      userIp: '127.0.0.1',
      userEmail: 'admin@example.com',
      userUsername: 'admin',
      userPassword: adminPasswordHash,
      userGroup: 1,
      userJoinDate: now,
      userLastLogin: 0,
      lastActivity: 0,
      userCookie: '',
      userSession: '',
      userApiKey: 'testadminapikey123456789012345678',
      userVerify: '',
    })
    .run()
})

// Set session secret for tests
process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

// Build test app with in-memory db
const app = createApp(testDb as typeof testDb)

// ---------------------------------------------------------------------------
// Helper: extract Set-Cookie header from login response
// hono-sessions sets the cookie TWICE per request (initial empty + persisted data)
// We need the LAST Set-Cookie value which contains the actual session data
// ---------------------------------------------------------------------------
async function loginAsAdmin(): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  // getSetCookie() returns an array of all Set-Cookie headers; take the last one
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) throw new Error('No session cookie set after login')
  // The last cookie has the actual session data (first is the initial empty session)
  const lastCookie = cookies[cookies.length - 1]
  return lastCookie.split(';')[0]
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  it('returns 200 and sets session cookie with valid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toBeDefined()
    expect(json.data.username).toBe('admin')
    expect(json.data.userGroup).toBe(1)
    // Must set a session cookie
    const setCookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    expect(setCookies.length).toBeGreaterThan(0)
    // The last cookie (actual session) should be HttpOnly
    expect(setCookies[setCookies.length - 1]).toContain('HttpOnly')
  })

  it('returns 401 with generic message for invalid password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Invalid username or password')
  })

  it('returns 401 with same generic message for non-existent username', async () => {
    const resBadUser = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'anything' }),
    })
    const resBadPass = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })
    // Both should return identical error messages
    const jsonBadUser = await resBadUser.json()
    const jsonBadPass = await resBadPass.json()
    expect(resBadUser.status).toBe(401)
    expect(resBadPass.status).toBe(401)
    expect(jsonBadUser.error).toBe(jsonBadPass.error)
  })

  it('records failed login attempts in the database', async () => {
    const countBefore = testDb.select().from(schema.failedLogins).all().length

    await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'bad' }),
    })
    await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'bad' }),
    })

    const countAfter = testDb.select().from(schema.failedLogins).all().length
    expect(countAfter).toBe(countBefore + 2)
  })

  it('returns 400 when username or password is missing', async () => {
    const resNoPass = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }),
    })
    expect(resNoPass.status).toBe(400)

    const resNoUser = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    })
    expect(resNoUser.status).toBe(400)
  })

  it('returns NO Set-Cookie header on failed login — wrong password (VAL-AUTH-003)', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)
    // The 401 response must NOT set a session cookie
    const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    expect(cookies).toHaveLength(0)
  })

  it('returns NO Set-Cookie header on failed login — non-existent user (VAL-AUTH-004)', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ghostuser', password: 'anything' }),
    })
    expect(res.status).toBe(401)
    // The 401 response must NOT set a session cookie
    const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    expect(cookies).toHaveLength(0)
  })

  it('failed login does not create an authenticated session (VAL-AUTH-003/004)', async () => {
    // Attempt login with wrong password — no prior session
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)

    // Extract any cookies from the 401 response
    const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()

    // Using cookies from the 401 response should NOT give authenticated access
    const cookieHeader = cookies.length > 0 ? cookies[cookies.length - 1].split(';')[0] : ''
    const meRes = await app.request('/api/auth/me', {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    })
    expect(meRes.status).toBe(401)
  })

  it('failed login with existing session: no Set-Cookie emitted, original session preserved (VAL-AUTH-003/004)', async () => {
    // First login successfully
    const sessionCookie = await loginAsAdmin()

    // Verify authenticated
    const meBeforeRes = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    })
    expect(meBeforeRes.status).toBe(200)

    // Attempt login with wrong password while carrying an existing valid session
    const failRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    expect(failRes.status).toBe(401)

    // The 401 response must emit NO Set-Cookie header — the strip middleware guarantees this
    const failCookies = (failRes.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    expect(failCookies).toHaveLength(0)

    // The original session cookie is NOT affected by the failed login attempt.
    // Since the 401 response carries no new cookie, the client retains the original session.
    // This is correct: a failed login should not destroy a pre-existing authenticated session.
    const meAfterRes = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    })
    expect(meAfterRes.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout', () => {
  it('returns 200 and clears session', async () => {
    // First login to get a session cookie
    const sessionCookie = await loginAsAdmin()

    const res = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.message).toContain('Logged out')
  })

  it('is idempotent — logout without session returns 200', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
describe('POST /api/auth/register', () => {
  afterEach(() => {
    // Clean up test users created during registration tests
    testDb
      .delete(schema.users)
      .where(eq(schema.users.userUsername, 'newuser'))
      .run()
    testDb
      .delete(schema.users)
      .where(eq(schema.users.userUsername, 'anotheruser'))
      .run()
  })

  it('creates user in group 2, auto-logs in, returns 201', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.username).toBe('newuser')
    expect(json.data.userGroup).toBe(2)
    // Should set a session cookie (auto-login)
    const regCookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    expect(regCookies.length).toBeGreaterThan(0)

    // Verify user in DB with hashed password and group 2
    const dbUser = testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.userUsername, 'newuser'))
      .get()
    expect(dbUser).toBeDefined()
    expect(dbUser?.userGroup).toBe(2)
    expect(dbUser?.userPassword).toMatch(/^\$2/)
  })

  it('returns 400 for duplicate username', async () => {
    // Register once
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })
    // Register again with same username
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'different@example.com',
        password: 'password123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors?.username).toContain('already in use')
  })

  it('returns 400 for duplicate email', async () => {
    // Register once
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })
    // Register again with same email
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'anotheruser',
        email: 'newuser@example.com',
        password: 'password123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors?.email).toContain('already in use')
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors?.username).toBeDefined()
    expect(json.errors?.email).toBeDefined()
    expect(json.errors?.password).toBeDefined()
  })

  it('returns 400 for invalid email format', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'not-an-email',
        password: 'password123',
      }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors?.email).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
describe('POST /api/auth/forgot-password', () => {
  afterEach(() => {
    // Reset user_verify for admin after tests
    testDb
      .update(schema.users)
      .set({ userVerify: '' })
      .where(eq(schema.users.userUsername, 'admin'))
      .run()
  })

  it('returns 200 and stores verify hash for known email', async () => {
    const res = await app.request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.message).toBeTruthy()

    // Verify hash was stored in DB
    const user = testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.userEmail, 'admin@example.com'))
      .get()
    expect(user?.userVerify).toBeTruthy()
    expect(user?.userVerify.length).toBe(22)
  })

  it('returns 200 with same message for unknown email (no enumeration)', async () => {
    const resKnown = await app.request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    })
    const resUnknown = await app.request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' }),
    })

    const jsonKnown = await resKnown.json()
    const jsonUnknown = await resUnknown.json()

    expect(resKnown.status).toBe(200)
    expect(resUnknown.status).toBe(200)
    expect(jsonKnown.data.message).toBe(jsonUnknown.data.message)
  })

  it('returns 400 when email is empty', async () => {
    const res = await app.request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.errors?.email).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------
describe('POST /api/auth/reset-password', () => {
  // Restore admin password after each test so subsequent tests still work
  afterEach(async () => {
    const restoredHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
    testDb
      .update(schema.users)
      .set({ userPassword: restoredHash, userVerify: '' })
      .where(eq(schema.users.userUsername, 'admin'))
      .run()
  })

  it('resets password and clears hash with valid hash', async () => {
    // First set up a verify hash
    const testHash = 'validtesthash1234567890'
    testDb
      .update(schema.users)
      .set({ userVerify: testHash })
      .where(eq(schema.users.userUsername, 'admin'))
      .run()

    const res = await app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: testHash }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.message).toContain('reset successfully')
    expect(json.data.newPassword).toBeTruthy()

    // Verify hash is cleared and password changed in DB
    const user = testDb
      .select()
      .from(schema.users)
      .where(eq(schema.users.userUsername, 'admin'))
      .get()
    expect(user?.userVerify).toBe('')
    expect(user?.userPassword).toMatch(/^\$2/)
  })

  it('returns 400 for invalid hash', async () => {
    const res = await app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: 'bogushash' }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Invalid')
  })

  it('returns 400 when hash is missing', async () => {
    const res = await app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/auth/me', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns current user data when authenticated', async () => {
    const sessionCookie = await loginAsAdmin()

    const res = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.username).toBe('admin')
    expect(json.data.userGroup).toBe(1)
    // Should NOT return the password
    expect(json.data.userPassword).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// requireAuth middleware
// ---------------------------------------------------------------------------
describe('requireAuth middleware', () => {
  it('returns 401 for protected routes without session', async () => {
    // The /api/auth/me endpoint uses the session check, which is equivalent
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
