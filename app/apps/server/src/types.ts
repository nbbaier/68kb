import type { Session } from 'hono-sessions'
import type { drizzle } from 'drizzle-orm/bun-sqlite'
import type * as schema from './db/schema'

// Session data stored in the encrypted cookie
export type SessionDataTypes = {
  userId: number
  username: string
  userGroup: number
}

// Hono context variables
export type AppVariables = {
  session: Session<SessionDataTypes>
  session_key_rotation: boolean
}

// Database type alias
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>
