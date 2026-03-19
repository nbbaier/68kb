import { createApp } from './app'
import { db } from './db'

const port = Number(process.env.PORT) || 3100
const app = createApp(db)

export default {
  port,
  fetch: app.fetch,
}
