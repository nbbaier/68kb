import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { users, userGroups } from '../db/schema'
import type { AppVariables, DrizzleDB } from '../types'

type SqliteClientCarrier = {
  $client?: Database
}

type RawUserRow = Record<string, unknown>

type ExtraFieldDefinition = {
  fieldName: string
  fieldType: string
}

function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value)
}

function getSqliteClient(db: DrizzleDB): Database {
  const client = (db as unknown as SqliteClientCarrier).$client
  if (!client) {
    throw new Error('SQLite client is not available')
  }
  return client
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseUnixTimestamp(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  // Keep date formatting constrained to plausible Unix second timestamps.
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 4102444800) return null
  return parsed
}

function formatUnixDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getExtraFieldDefinitions(sqlite: Database): Map<string, ExtraFieldDefinition> {
  const definitionMap = new Map<string, ExtraFieldDefinition>()

  try {
    const columns = sqlite
      .query('PRAGMA table_info("article_fields")')
      .all() as Array<{ name: string }>

    const names = new Set(columns.map((col) => col.name))
    if (!names.has('field_internal') || !names.has('field_name') || !names.has('field_type')) {
      return definitionMap
    }

    const rows = sqlite.query(
      'SELECT field_internal, field_name, field_type FROM article_fields',
    ).all() as Array<{ field_internal: string | null; field_name: string | null; field_type: string | null }>

    for (const row of rows) {
      const internal = (row.field_internal ?? '').trim()
      if (!internal) continue

      definitionMap.set(internal, {
        fieldName: (row.field_name ?? '').trim() || toTitleCase(internal),
        fieldType: (row.field_type ?? '').trim().toLowerCase(),
      })
    }
  } catch {
    // Optional legacy fields metadata may not exist in all environments.
  }

  return definitionMap
}

function extractExtraFields(rawUser: RawUserRow, definitions: Map<string, ExtraFieldDefinition>) {
  const extraFields: Array<{
    key: string
    name: string
    fieldType: string
    value: string
    formattedValue: string
  }> = []

  for (const [column, rawValue] of Object.entries(rawUser)) {
    if (!column.startsWith('extra_field_')) continue

    const value = String(rawValue ?? '').trim()
    if (!value) continue

    const key = column.slice('extra_field_'.length)
    const definition = definitions.get(key)
    const lowerKey = key.toLowerCase()
    const timestamp = parseUnixTimestamp(value)
    const isDateLike = definition?.fieldType === 'date' || /(?:^|_)(date|dob|birthday)(?:_|$)/.test(lowerKey)
    const formattedValue = isDateLike && timestamp !== null ? formatUnixDate(timestamp) : value

    extraFields.push({
      key,
      name: definition?.fieldName ?? toTitleCase(key),
      fieldType: definition?.fieldType || (isDateLike ? 'date' : 'text'),
      value,
      formattedValue,
    })
  }

  extraFields.sort((a, b) => a.name.localeCompare(b.name))
  return extraFields
}

function getPublicProfile(db: DrizzleDB, username: string) {
  const user = db
    .select({
      userId: users.userId,
      userUsername: users.userUsername,
      userJoinDate: users.userJoinDate,
      userLastLogin: users.userLastLogin,
      userGroup: users.userGroup,
      groupName: userGroups.groupName,
    })
    .from(users)
    .innerJoin(
      userGroups,
      and(eq(users.userGroup, userGroups.groupId), eq(userGroups.canViewSite, 'y')),
    )
    .where(eq(users.userUsername, username))
    .get()

  if (!user) {
    return null
  }

  const sqlite = getSqliteClient(db)
  const rawUser = sqlite
    .query('SELECT * FROM users WHERE user_username = ? LIMIT 1')
    .get(username) as RawUserRow | null
  const extraFields = rawUser ? extractExtraFields(rawUser, getExtraFieldDefinitions(sqlite)) : []

  return {
    userId: user.userId,
    username: user.userUsername,
    userGroup: user.userGroup,
    groupName: user.groupName,
    userJoinDate: user.userJoinDate,
    userLastLogin: user.userLastLogin,
    extraFields,
  }
}

export function createPublicUserProfileRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  // -------------------------------------------------------------------------
  // GET /api/users/:username
  // Public-facing user profile details (short alias)
  // -------------------------------------------------------------------------
  router.get('/:username', (c) => {
    const username = (c.req.param('username') ?? '').trim()
    if (!username || !isAlphanumeric(username)) {
      return c.json({ error: 'Invalid username' }, 400)
    }

    const user = getPublicProfile(db, username)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({ data: user })
  })

  // -------------------------------------------------------------------------
  // GET /api/users/profile/:username
  // Public-facing user profile details
  // -------------------------------------------------------------------------
  router.get('/profile/:username', (c) => {
    const username = (c.req.param('username') ?? '').trim()
    if (!username || !isAlphanumeric(username)) {
      return c.json({ error: 'Invalid username' }, 400)
    }

    const user = getPublicProfile(db, username)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({ data: user })
  })

  return router
}
