import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { settings } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

const SITE_SETTING_KEYS = [
  'site_name',
  'site_email',
  'site_keywords',
  'site_description',
  'site_max_search',
  'site_cache_time',
  'site_bad_words',
] as const

type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number]

type SiteSettingsPayload = {
  siteName: string
  siteEmail: string
  siteKeywords: string
  siteDescription: string
  siteMaxSearch: number
  siteCacheTime: number
  siteBadWords: string
}

const DEFAULT_SITE_SETTINGS: SiteSettingsPayload = {
  siteName: 'Your Site',
  siteEmail: 'demo@demo.com',
  siteKeywords: '',
  siteDescription: '',
  siteMaxSearch: 20,
  siteCacheTime: 0,
  siteBadWords: '',
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function sanitizeBadWords(value: string): string {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .join(',')
}

function parseNumber(raw: unknown): number | null {
  const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toApiPayload(rowMap: Map<SiteSettingKey, string>): SiteSettingsPayload {
  const siteMaxSearch = parseNumber(rowMap.get('site_max_search'))
  const siteCacheTime = parseNumber(rowMap.get('site_cache_time'))

  return {
    siteName: rowMap.get('site_name') ?? DEFAULT_SITE_SETTINGS.siteName,
    siteEmail: rowMap.get('site_email') ?? DEFAULT_SITE_SETTINGS.siteEmail,
    siteKeywords: rowMap.get('site_keywords') ?? DEFAULT_SITE_SETTINGS.siteKeywords,
    siteDescription: rowMap.get('site_description') ?? DEFAULT_SITE_SETTINGS.siteDescription,
    siteMaxSearch: siteMaxSearch !== null ? siteMaxSearch : DEFAULT_SITE_SETTINGS.siteMaxSearch,
    siteCacheTime: siteCacheTime !== null ? siteCacheTime : DEFAULT_SITE_SETTINGS.siteCacheTime,
    siteBadWords: rowMap.get('site_bad_words') ?? DEFAULT_SITE_SETTINGS.siteBadWords,
  }
}

function loadSiteSettings(db: DrizzleDB): SiteSettingsPayload {
  const rows = db
    .select({
      optionName: settings.optionName,
      optionValue: settings.optionValue,
    })
    .from(settings)
    .where(
      and(
        eq(settings.optionGroup, 'site'),
        inArray(settings.optionName, SITE_SETTING_KEYS as unknown as string[]),
      ),
    )
    .all()

  const rowMap = new Map<SiteSettingKey, string>()
  for (const row of rows) {
    if ((SITE_SETTING_KEYS as readonly string[]).includes(row.optionName)) {
      rowMap.set(row.optionName as SiteSettingKey, row.optionValue)
    }
  }

  return toApiPayload(rowMap)
}

function buildValidatedPayload(body: Record<string, unknown>): { data?: SiteSettingsPayload; error?: string } {
  const siteName = String(body.siteName ?? '').trim()
  const siteEmail = String(body.siteEmail ?? '').trim()
  const siteKeywords = String(body.siteKeywords ?? '').trim()
  const siteDescription = String(body.siteDescription ?? '').trim()
  const siteBadWords = sanitizeBadWords(String(body.siteBadWords ?? ''))
  const siteMaxSearch = parseNumber(body.siteMaxSearch)
  const siteCacheTime = parseNumber(body.siteCacheTime)

  if (!siteName) {
    return { error: 'Site name is required' }
  }
  if (!siteEmail) {
    return { error: 'Site email is required' }
  }
  if (!isValidEmail(siteEmail)) {
    return { error: 'Please enter a valid site email address' }
  }
  if (siteMaxSearch === null || siteMaxSearch < 1) {
    return { error: 'Search results per page must be a positive number' }
  }
  if (siteCacheTime === null || siteCacheTime < 0) {
    return { error: 'Cache time must be a non-negative number' }
  }

  return {
    data: {
      siteName,
      siteEmail,
      siteKeywords,
      siteDescription,
      siteMaxSearch,
      siteCacheTime,
      siteBadWords,
    },
  }
}

export function createSettingsRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  const requireManageSettings = createRequireRole(db)('canManageSettings')
  router.use('*', requireManageSettings)

  // -------------------------------------------------------------------------
  // GET /api/admin/settings
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    return c.json({ data: loadSiteSettings(db) })
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/settings
  // -------------------------------------------------------------------------
  router.put('/', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const validated = buildValidatedPayload(body)
    if (!validated.data) {
      return c.json({ error: validated.error ?? 'Validation failed' }, 400)
    }

    const updates: Record<SiteSettingKey, string> = {
      site_name: validated.data.siteName,
      site_email: validated.data.siteEmail,
      site_keywords: validated.data.siteKeywords,
      site_description: validated.data.siteDescription,
      site_max_search: String(validated.data.siteMaxSearch),
      site_cache_time: String(validated.data.siteCacheTime),
      site_bad_words: validated.data.siteBadWords,
    }

    for (const [optionName, optionValue] of Object.entries(updates) as Array<[SiteSettingKey, string]>) {
      const existing = db
        .select({ optionId: settings.optionId })
        .from(settings)
        .where(eq(settings.optionName, optionName))
        .get()

      if (existing) {
        db
          .update(settings)
          .set({ optionValue, optionGroup: 'site' })
          .where(eq(settings.optionId, existing.optionId))
          .run()
      } else {
        const autoLoad = optionName === 'site_bad_words' ? 'no' : 'yes'
        db
          .insert(settings)
          .values({ optionName, optionValue, optionGroup: 'site', autoLoad })
          .run()
      }
    }

    return c.json({ data: loadSiteSettings(db) })
  })

  return router
}
