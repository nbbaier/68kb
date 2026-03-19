import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'

const dbPath = process.env.DB_FILE_NAME ?? './data/68kb.db'

const sqlite = new Database(dbPath)
const db = drizzle(sqlite)

console.log('Running migrations...')
migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations complete.')

sqlite.close()
