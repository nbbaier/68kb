import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sessionMiddleware, CookieStore } from 'hono-sessions'
import type { db } from './db'
import { createAuthRoutes } from './routes/auth'
import { createAdminRoutes } from './routes/admin'
import type { AppVariables } from './types'

export function createApp(database: typeof db) {
  const app = new Hono<{ Variables: AppVariables }>()

  app.use('*', logger())

  app.use(
    '/api/*',
    cors({
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3101',
      credentials: true,
    }),
  )

  // Session middleware — requires SESSION_SECRET from environment (min 32 chars)
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long')
  }

  const store = new CookieStore()
  app.use(
    '*',
    sessionMiddleware({
      store,
      encryptionKey: sessionSecret,
      expireAfterSeconds: 86400, // 24 hours
      cookieOptions: {
        sameSite: 'Lax',
        path: '/',
        httpOnly: true,
      },
    }),
  )

  // Health endpoint
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok' })
  })

  // Auth routes
  app.route('/api/auth', createAuthRoutes(database))

  // Admin routes
  app.route('/api/admin', createAdminRoutes(database))

  // Catch-all for unknown /api/* routes — return 404 JSON
  // Must come AFTER all real API routes
  app.all('/api/*', (c) => {
    return c.json({ error: 'Not found' }, 404)
  })

  return app
}

// Note: The default app instance is created in index.ts, not here.
// This keeps app.ts free of side effects so test files can import createApp
// without triggering real database or environment variable access.
