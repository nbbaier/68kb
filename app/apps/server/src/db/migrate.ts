import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_FILE_NAME ?? resolve(__dirname, '../../../../data/68kb.db')
const migrationsFolder = resolve(__dirname, '../../drizzle')

const sqlite = new Database(dbPath)

// Enable WAL mode for concurrent read performance
sqlite.exec('PRAGMA journal_mode = WAL')
// Enforce foreign key constraints
sqlite.exec('PRAGMA foreign_keys = ON')

const db = drizzle(sqlite)

console.log('Running migrations...')
console.log(`Database: ${dbPath}`)
console.log(`Migrations folder: ${migrationsFolder}`)

migrate(db, { migrationsFolder })
console.log('Migrations complete.')

sqlite.close()
