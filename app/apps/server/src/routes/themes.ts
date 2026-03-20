import { Hono } from 'hono'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import { createRequireRole } from '../middleware/auth'
import type { AppVariables, DrizzleDB } from '../types'

type ThemeInfo = {
  directory: string
  hasLayout: boolean
  isActive: boolean
}

function getThemesRoot(): string {
  if (process.env.THEMES_DIR) {
    return resolve(process.env.THEMES_DIR)
  }

  const candidates = [
    resolve(process.cwd(), '../upload/themes'),
    resolve(process.cwd(), '../../upload/themes'),
    resolve(process.cwd(), '../../../upload/themes'),
    resolve(process.cwd(), 'upload/themes'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback path used in local workspace layout.
  return resolve(process.cwd(), '../../../upload/themes')
}

function readActiveTheme(db: DrizzleDB): string {
  const siteTheme = db
    .select({ optionValue: settings.optionValue })
    .from(settings)
    .where(eq(settings.optionName, 'site_theme'))
    .get()

  return siteTheme?.optionValue || 'default'
}

function upsertSiteTheme(db: DrizzleDB, value: string): void {
  const existing = db
    .select({ optionId: settings.optionId })
    .from(settings)
    .where(eq(settings.optionName, 'site_theme'))
    .get()

  if (existing) {
    db
      .update(settings)
      .set({ optionValue: value, optionGroup: 'site' })
      .where(eq(settings.optionId, existing.optionId))
      .run()
    return
  }

  db
    .insert(settings)
    .values({
      optionName: 'site_theme',
      optionValue: value,
      optionGroup: 'site',
      autoLoad: 'yes',
    })
    .run()
}

function listThemes(db: DrizzleDB): { themesRoot: string; activeTheme: string; themes: ThemeInfo[] } {
  const themesRoot = getThemesRoot()
  const activeTheme = readActiveTheme(db)

  let directories: string[] = []
  try {
    directories = readdirSync(themesRoot).filter((entry) => {
      try {
        return statSync(join(themesRoot, entry)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    directories = []
  }

  const themes = directories
    .map((directory) => {
      const hasLayout = existsSync(join(themesRoot, directory, 'layout.php'))
      return {
        directory,
        hasLayout,
        isActive: directory === activeTheme,
      }
    })
    .sort((a, b) => a.directory.localeCompare(b.directory))

  return { themesRoot, activeTheme, themes }
}

function isSafeThemeDirectory(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

export function createThemeRoutes(db: DrizzleDB) {
  const router = new Hono<{ Variables: AppVariables }>()

  const requireManageThemes = createRequireRole(db)('canManageThemes')
  router.use('*', requireManageThemes)

  // -------------------------------------------------------------------------
  // GET /api/admin/themes
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    const { activeTheme, themes } = listThemes(db)
    return c.json({
      data: {
        activeTheme,
        themes,
      },
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/admin/themes/activate
  // -------------------------------------------------------------------------
  router.post('/activate', async (c) => {
    let body: { theme?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const requestedTheme = String(body.theme ?? '').trim()
    if (!requestedTheme) {
      return c.json({ error: 'Theme is required' }, 400)
    }
    if (!isSafeThemeDirectory(requestedTheme)) {
      return c.json({ error: 'Invalid theme directory name' }, 400)
    }

    const { themesRoot } = listThemes(db)
    const layoutPath = join(themesRoot, requestedTheme, 'layout.php')

    if (!existsSync(layoutPath)) {
      return c.json({ error: 'Theme is invalid: missing layout.php' }, 400)
    }

    upsertSiteTheme(db, requestedTheme)

    return c.json({
      data: {
        activeTheme: requestedTheme,
      },
    })
  })

  return router
}
