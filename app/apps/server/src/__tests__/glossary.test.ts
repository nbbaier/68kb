import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
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
  ])
  .run()

process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const app = createApp(testDb as typeof testDb)

// ---------------------------------------------------------------------------
// Seed glossary terms
// ---------------------------------------------------------------------------
beforeAll(() => {
  testDb.insert(schema.glossary).values([
    { gId: 1, gTerm: 'Apple', gDefinition: 'A fruit that grows on trees.' },
    { gId: 2, gTerm: 'Banana', gDefinition: 'A yellow tropical fruit.' },
    { gId: 3, gTerm: 'apricot', gDefinition: 'An orange-colored fruit.' },
    { gId: 4, gTerm: 'Cherry', gDefinition: 'A small red fruit.' },
    { gId: 5, gTerm: '123term', gDefinition: 'A term starting with a number.' },
    { gId: 6, gTerm: '.dotterm', gDefinition: 'A term starting with a dot.' },
  ]).run()
})

// ---------------------------------------------------------------------------
// Login helper
// ---------------------------------------------------------------------------
async function loginAsAdmin(): Promise<string> {
  // Seed admin user
  const hashedPassword = await Bun.password.hash('password123', { algorithm: 'bcrypt', cost: 4 })
  try {
    testDb
      .insert(schema.users)
      .values({
        userUsername: 'admin',
        userEmail: 'admin@example.com',
        userPassword: hashedPassword,
        userGroup: 1,
        userJoinDate: Math.floor(Date.now() / 1000),
        userLastLogin: Math.floor(Date.now() / 1000),
        lastActivity: Math.floor(Date.now() / 1000),
      })
      .run()
  } catch {
    // admin user already seeded
  }

  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' }),
  })

  const cookies = res.headers.getSetCookie()
  const sessionCookie = cookies[cookies.length - 1]
  return sessionCookie?.split(';')[0] ?? ''
}

// ---------------------------------------------------------------------------
// Public glossary routes
// ---------------------------------------------------------------------------
describe('GET /api/glossary', () => {
  it('returns all glossary terms ordered by term alphabetically', async () => {
    const res = await app.request('/api/glossary')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gId: number; gTerm: string; gDefinition: string }> }
    expect(json.data).toBeArray()
    expect(json.data.length).toBe(6)
    // Check alphabetical ordering (case-insensitive)
    const terms = json.data.map((t) => t.gTerm.toLowerCase())
    const sorted = [...terms].sort((a, b) => a.localeCompare(b))
    expect(terms).toEqual(sorted)
  })

  it('returns term and definition fields', async () => {
    const res = await app.request('/api/glossary')
    const json = await res.json() as { data: Array<{ gId: number; gTerm: string; gDefinition: string }> }
    const apple = json.data.find((t) => t.gTerm === 'Apple')
    expect(apple).toBeDefined()
    expect(apple!.gDefinition).toBe('A fruit that grows on trees.')
  })
})

describe('GET /api/glossary/term/:letter', () => {
  it('returns terms starting with the given letter (case-insensitive)', async () => {
    const res = await app.request('/api/glossary/term/a')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gTerm: string }> }
    expect(json.data.length).toBe(2) // Apple and apricot
    for (const term of json.data) {
      expect(term.gTerm.toLowerCase()).toStartWith('a')
    }
  })

  it('returns terms starting with b', async () => {
    const res = await app.request('/api/glossary/term/b')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gTerm: string }> }
    expect(json.data.length).toBe(1)
    expect(json.data[0]!.gTerm).toBe('Banana')
  })

  it('returns empty array for a letter with no terms', async () => {
    const res = await app.request('/api/glossary/term/z')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gTerm: string }> }
    expect(json.data).toBeArray()
    expect(json.data.length).toBe(0)
  })

  it('returns sym terms (starting with digits/symbols)', async () => {
    const res = await app.request('/api/glossary/term/sym')
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gTerm: string }> }
    expect(json.data.length).toBe(2) // 123term and .dotterm
  })

  it('returns 400 for invalid letter (not a-z or sym)', async () => {
    const res = await app.request('/api/glossary/term/invalid')
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Admin glossary routes
// ---------------------------------------------------------------------------
describe('GET /api/admin/glossary', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/glossary')
    expect(res.status).toBe(401)
  })

  it('returns paginated glossary list with session', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gId: number; gTerm: string; gDefinition: string }>; total: number }
    expect(json.data).toBeArray()
    expect(json.total).toBeNumber()
    expect(json.total).toBe(6)
  })

  it('supports search parameter', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary?search=apple', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<{ gTerm: string }>; total: number }
    expect(json.data.length).toBe(1)
    expect(json.data[0]!.gTerm.toLowerCase()).toBe('apple')
  })

  it('supports pagination', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary?page=1&limit=3', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: Array<unknown>; total: number; page: number }
    expect(json.data.length).toBeLessThanOrEqual(3)
    expect(json.page).toBe(1)
  })
})

describe('GET /api/admin/glossary/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/glossary/1')
    expect(res.status).toBe(401)
  })

  it('returns a single glossary term by id', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/1', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { gId: number; gTerm: string; gDefinition: string } }
    expect(json.data.gId).toBe(1)
    expect(json.data.gTerm).toBe('Apple')
  })

  it('returns 404 for non-existent id', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/99999', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-numeric id', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/abc', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/glossary', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gTerm: 'NewTerm', gDefinition: 'A new definition.' }),
    })
    expect(res.status).toBe(401)
  })

  it('creates a new glossary term', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: 'Elderberry', gDefinition: 'A dark berry.' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as { data: { gId: number; gTerm: string; gDefinition: string } }
    expect(json.data.gTerm).toBe('Elderberry')
    expect(json.data.gDefinition).toBe('A dark berry.')
    expect(json.data.gId).toBeNumber()
  })

  it('returns 422 when gTerm is missing', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gDefinition: 'Missing term.' }),
    })
    expect(res.status).toBe(422)
    const json = await res.json() as { error: string }
    expect(json.error).toBeString()
  })

  it('returns 422 when gTerm is empty string', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: '', gDefinition: 'Empty term.' }),
    })
    expect(res.status).toBe(422)
  })
})

describe('PUT /api/admin/glossary/:id', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/glossary/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gTerm: 'Updated', gDefinition: 'Updated def.' }),
    })
    expect(res.status).toBe(401)
  })

  it('updates an existing glossary term', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: 'Banana', gDefinition: 'A yellow curved fruit.' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { data: { gId: number; gTerm: string; gDefinition: string } }
    expect(json.data.gDefinition).toBe('A yellow curved fruit.')
  })

  it('returns 404 for non-existent id', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/99999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: 'Test', gDefinition: 'Test.' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 for non-numeric id', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/abc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: 'Test', gDefinition: 'Test.' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 422 when gTerm is empty', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ gTerm: '', gDefinition: 'Test.' }),
    })
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/admin/glossary', () => {
  it('returns 401 without session', async () => {
    const res = await app.request('/api/admin/glossary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [3] }),
    })
    expect(res.status).toBe(401)
  })

  it('bulk deletes selected terms', async () => {
    const cookie = await loginAsAdmin()
    // First, count current terms
    const beforeRes = await app.request('/api/admin/glossary', {
      headers: { Cookie: cookie },
    })
    const beforeJson = await beforeRes.json() as { total: number }
    const totalBefore = beforeJson.total

    // Delete term id=3 (apricot) and id=4 (Cherry)
    const res = await app.request('/api/admin/glossary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ ids: [3, 4] }),
    })
    expect(res.status).toBe(200)

    const afterRes = await app.request('/api/admin/glossary', {
      headers: { Cookie: cookie },
    })
    const afterJson = await afterRes.json() as { total: number }
    expect(afterJson.total).toBe(totalBefore - 2)
  })

  it('returns 422 when ids array is empty or missing', async () => {
    const cookie = await loginAsAdmin()
    const res = await app.request('/api/admin/glossary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ ids: [] }),
    })
    expect(res.status).toBe(422)
  })
})
