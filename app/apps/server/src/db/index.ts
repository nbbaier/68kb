import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from './schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Default to absolute path relative to this file's location so tests can find it regardless of CWD
const defaultDbPath = resolve(__dirname, '../../../../data/68kb.db')
const dbPath = process.env.DB_FILE_NAME ?? defaultDbPath

const sqlite = new Database(dbPath)
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle({ client: sqlite, schema })
