import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())

app.use(
  '/api/*',
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3101',
    credentials: true,
  }),
)

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

export default app
