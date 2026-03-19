import { describe, it, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '../db/schema'
import { createApp } from '../app'

// Set session secret before creating the app (required since fallback was removed)
process.env.SESSION_SECRET = 'test-session-secret-key-minimum-32-chars!!'

const testSqlite = new Database(':memory:')
const testDb = drizzle({ client: testSqlite, schema })
const app = createApp(testDb as typeof testDb)

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ status: 'ok' })
  })

  it('returns JSON content-type', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
