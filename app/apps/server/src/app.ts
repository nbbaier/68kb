import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sessionMiddleware, CookieStore } from 'hono-sessions'
import { db } from './db'
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

  // Session middleware — requires SESSION_SECRET (min 32 chars)
  const sessionSecret = process.env.SESSION_SECRET ?? 'default-dev-secret-key-min-32-chars!!'
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

  return app
}

// Default app instance using the real database
const app = createApp(db)
export default app
