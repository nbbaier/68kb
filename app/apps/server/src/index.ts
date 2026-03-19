import app from './app'

const port = Number(process.env.PORT) || 3100

export default {
  port,
  fetch: app.fetch,
}
