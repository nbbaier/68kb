import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Minimal schema for initial scaffolding.
// Full schema (17+ tables) will be added by the database-schema-migrations-seed feature.

export const healthCheck = sqliteTable('health_check', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  status: text('status').notNull().default('ok'),
})

export type HealthCheck = typeof healthCheck.$inferSelect
export type NewHealthCheck = typeof healthCheck.$inferInsert
