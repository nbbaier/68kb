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

const testSqlite = new Database(':memory:')
testSqlite.exec('PRAGMA foreign_keys = ON')
const testDb = drizzle({ client: testSqlite, schema })
migrate(testDb, { migrationsFolder: MIGRATIONS_FOLDER })

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'
const app = createApp(testDb as typeof testDb)

beforeAll(async () => {
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
        groupId: 6,
        groupName: 'Limited Admin',
        groupDescription: 'Can access admin only',
        canViewSite: 'y',
        canAccessAdmin: 'y',
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

  testDb
    .insert(schema.settings)
    .values({ optionName: 'script_version', optionValue: '1.0.0', optionGroup: 'script' })
    .run()

  const adminHash = await Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
  const limitedHash = await Bun.password.hash('limited123', { algorithm: 'bcrypt', cost: 12 })
  const now = Math.floor(Date.now() / 1000)

  testDb
    .insert(schema.users)
    .values([
      {
        userIp: '127.0.0.1',
        userEmail: 'admin@example.com',
        userUsername: 'admin',
        userPassword: adminHash,
        userGroup: 1,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'adminapikey123456789012345678901234',
        userVerify: '',
      },
      {
        userIp: '127.0.0.1',
        userEmail: 'limited@example.com',
        userUsername: 'limitedadmin',
        userPassword: limitedHash,
        userGroup: 6,
        userJoinDate: now,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: 'limitedapikey1234567890123456789012',
        userVerify: '',
      },
    ])
    .run()

  const article = testDb
    .insert(schema.articles)
    .values({
      articleUri: 'comments-test-article',
      articleTitle: 'Comments Test Article',
      articleDescription: '<p>Comments enabled</p>',
      articleShortDesc: 'Test',
      articleKeywords: 'comments',
      articleDisplay: 'y',
      articleDate: now,
      articleModified: now,
      articleAuthor: 1,
    })
    .returning({ articleId: schema.articles.articleId })
    .get()

  if (!article) throw new Error('Failed to seed article')
})

afterEach(() => {
  testDb.delete(schema.comments).run()
})

async function login(username: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`)
  }

  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
  if (!cookies || cookies.length === 0) {
    throw new Error('No session cookie set after login')
  }

  return cookies[cookies.length - 1].split(';')[0]
}

async function postComment(payload: { author: string; email: string; content: string }) {
  return app.request('/api/comments/article/1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': '10.0.0.42',
    },
    body: JSON.stringify(payload),
  })
}

describe('Comments system API', () => {
  it('creates a pending comment for first-time email', async () => {
    const res = await postComment({
      author: 'New User',
      email: 'new@example.com',
      content: 'Great article',
    })

    expect(res.status).toBe(201)
    const json = await res.json() as { data: { status: string } }
    expect(json.data.status).toBe('0')
  })

  it('auto-approves comments from an email with prior approved comment', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb
      .insert(schema.comments)
      .values({
        commentArticleId: 1,
        commentAuthor: 'Returning User',
        commentAuthorEmail: 'returning@example.com',
        commentAuthorIp: '127.0.0.1',
        commentDate: now - 30,
        commentContent: 'Earlier approved comment',
        commentApproved: '1',
      })
      .run()

    const res = await postComment({
      author: 'Returning User',
      email: 'returning@example.com',
      content: 'I am back with another comment',
    })

    expect(res.status).toBe(201)
    const json = await res.json() as { data: { status: string } }
    expect(json.data.status).toBe('1')
  })

  it('marks comments with multiple links as spam', async () => {
    const res = await postComment({
      author: 'Spammer',
      email: 'spam@example.com',
      content: 'Check https://example.com and http://spam.test now',
    })

    expect(res.status).toBe(201)
    const json = await res.json() as { data: { status: string } }
    expect(json.data.status).toBe('spam')
  })

  it('returns only approved comments in public listing', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb
      .insert(schema.comments)
      .values([
        {
          commentArticleId: 1,
          commentAuthor: 'Approved',
          commentAuthorEmail: 'approved@example.com',
          commentAuthorIp: '127.0.0.1',
          commentDate: now - 20,
          commentContent: 'Visible comment',
          commentApproved: '1',
        },
        {
          commentArticleId: 1,
          commentAuthor: 'Pending',
          commentAuthorEmail: 'pending@example.com',
          commentAuthorIp: '127.0.0.1',
          commentDate: now - 10,
          commentContent: 'Hidden until moderation',
          commentApproved: '0',
        },
      ])
      .run()

    const res = await app.request('/api/comments/article/1')
    expect(res.status).toBe(200)

    const json = await res.json() as { data: Array<{ commentAuthor: string }>; total: number }
    expect(json.total).toBe(1)
    expect(json.data[0]?.commentAuthor).toBe('Approved')
  })

  it('requires can_manage_users for admin comments list', async () => {
    const noSession = await app.request('/api/admin/comments')
    expect(noSession.status).toBe(401)

    const limitedCookie = await login('limitedadmin', 'limited123')
    const forbidden = await app.request('/api/admin/comments', {
      headers: { Cookie: limitedCookie },
    })
    expect(forbidden.status).toBe(403)
  })

  it('lists and filters comments for authorized admins', async () => {
    const now = Math.floor(Date.now() / 1000)
    testDb
      .insert(schema.comments)
      .values([
        {
          commentArticleId: 1,
          commentAuthor: 'Approved',
          commentAuthorEmail: 'approved@example.com',
          commentAuthorIp: '127.0.0.1',
          commentDate: now - 20,
          commentContent: 'Visible',
          commentApproved: '1',
        },
        {
          commentArticleId: 1,
          commentAuthor: 'Pending',
          commentAuthorEmail: 'pending@example.com',
          commentAuthorIp: '127.0.0.1',
          commentDate: now - 10,
          commentContent: 'Needs review',
          commentApproved: '0',
        },
      ])
      .run()

    const cookie = await login('admin', 'admin123')
    const res = await app.request('/api/admin/comments?status=0', {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as {
      total: number
      data: Array<{ commentAuthor: string; commentApproved: string }>
    }
    expect(json.total).toBe(1)
    expect(json.data[0]?.commentAuthor).toBe('Pending')
    expect(json.data[0]?.commentApproved).toBe('0')
  })

  it('updates comment status via moderation endpoint', async () => {
    const now = Math.floor(Date.now() / 1000)
    const inserted = testDb
      .insert(schema.comments)
      .values({
        commentArticleId: 1,
        commentAuthor: 'Pending',
        commentAuthorEmail: 'pending@example.com',
        commentAuthorIp: '127.0.0.1',
        commentDate: now,
        commentContent: 'Please approve me',
        commentApproved: '0',
      })
      .returning({ commentId: schema.comments.commentId })
      .get()

    const cookie = await login('admin', 'admin123')
    const res = await app.request(`/api/admin/comments/${inserted!.commentId}/status`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: '1' }),
    })

    expect(res.status).toBe(200)
    const updated = testDb
      .select({ commentApproved: schema.comments.commentApproved })
      .from(schema.comments)
      .where(eq(schema.comments.commentId, inserted!.commentId))
      .get()
    expect(updated?.commentApproved).toBe('1')
  })

  it('supports editing and deleting comments in admin', async () => {
    const now = Math.floor(Date.now() / 1000)
    const inserted = testDb
      .insert(schema.comments)
      .values({
        commentArticleId: 1,
        commentAuthor: 'Original',
        commentAuthorEmail: 'original@example.com',
        commentAuthorIp: '127.0.0.1',
        commentDate: now,
        commentContent: 'Original text',
        commentApproved: '0',
      })
      .returning({ commentId: schema.comments.commentId })
      .get()

    const cookie = await login('admin', 'admin123')

    const editRes = await app.request(`/api/admin/comments/${inserted!.commentId}`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: 'Edited',
        content: 'Edited text',
        status: '1',
      }),
    })
    expect(editRes.status).toBe(200)

    const edited = testDb
      .select({
        commentAuthor: schema.comments.commentAuthor,
        commentContent: schema.comments.commentContent,
        commentApproved: schema.comments.commentApproved,
      })
      .from(schema.comments)
      .where(eq(schema.comments.commentId, inserted!.commentId))
      .get()
    expect(edited?.commentAuthor).toBe('Edited')
    expect(edited?.commentContent).toBe('Edited text')
    expect(edited?.commentApproved).toBe('1')

    const deleteRes = await app.request(`/api/admin/comments/${inserted!.commentId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    })
    expect(deleteRes.status).toBe(200)

    const afterDelete = testDb
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.commentId, inserted!.commentId))
      .get()
    expect(afterDelete).toBeUndefined()
  })
})
