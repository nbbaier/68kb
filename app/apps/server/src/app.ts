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

  // ---------------------------------------------------------------------------
  // Strip Set-Cookie headers from 401 responses.
  // hono-sessions CookieStore emits a Set-Cookie header on every response
  // regardless of deleteSession(). This middleware is registered BEFORE
  // sessionMiddleware so that, in Hono's onion model, it runs AFTER the
  // session middleware on the way out — thereby removing any cookie the session
  // middleware may have set on a failed-auth (401) response.
  //
  // IMPORTANT: We directly mutate c.res.headers (which is mutable in Bun's
  // runtime) rather than replacing c.res. Replacing c.res via the setter
  // triggers Hono's header-merging logic which would re-add the old Set-Cookie
  // headers we just stripped.
  // ---------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    await next()
    if (c.res.status === 401) {
      c.res.headers.delete('set-cookie')
    }
  })

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
