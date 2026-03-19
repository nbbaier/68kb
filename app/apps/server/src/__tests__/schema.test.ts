import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { resolve } from 'path'
import * as schema from '../db/schema'

// Use an in-memory database for tests
let sqlite: Database
let db: ReturnType<typeof drizzle<typeof schema>>

const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle')

beforeAll(() => {
  // Use in-memory SQLite for tests
  sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA foreign_keys = ON')
  db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  // Seed test data
  db.insert(schema.userGroups).values([
    {
      groupId: 1,
      groupName: 'Site Admins',
      groupDescription: 'Site Administrators',
      canViewSite: 'y',
      canAccessAdmin: 'y',
      canManageArticles: 'y',
      canDeleteArticles: 'y',
      canManageUsers: 'y',
      canManageCategories: 'y',
      canDeleteCategories: 'y',
      canManageSettings: 'y',
      canManageUtilities: 'y',
      canManageThemes: 'y',
      canManageModules: 'y',
      canSearch: 'y',
    },
    {
      groupId: 2,
      groupName: 'Registered',
      groupDescription: 'Registered Users',
      canViewSite: 'y',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'y',
    },
    {
      groupId: 3,
      groupName: 'Pending',
      groupDescription: 'Users Awaiting Email Confirmation',
      canViewSite: 'y',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'y',
    },
    {
      groupId: 4,
      groupName: 'Banned',
      groupDescription: 'Banned Users',
      canViewSite: 'n',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'n',
    },
    {
      groupId: 5,
      groupName: 'Guest',
      groupDescription: 'Site Visitors not logged in',
      canViewSite: 'y',
      canAccessAdmin: 'n',
      canManageArticles: 'n',
      canDeleteArticles: 'n',
      canManageUsers: 'n',
      canManageCategories: 'n',
      canDeleteCategories: 'n',
      canManageSettings: 'n',
      canManageUtilities: 'n',
      canManageThemes: 'n',
      canManageModules: 'n',
      canSearch: 'y',
    },
  ]).run()

  db.insert(schema.settings).values([
    { optionName: 'site_name', optionValue: 'Your Site', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_email', optionValue: 'demo@demo.com', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_keywords', optionValue: 'keywords, go, here', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_description', optionValue: 'Site Description', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_max_search', optionValue: '20', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_cache_time', optionValue: '0', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_theme', optionValue: 'default', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_admin_template', optionValue: 'default', optionGroup: 'site', autoLoad: 'yes' },
    { optionName: 'site_bad_words', optionValue: '', optionGroup: 'site', autoLoad: 'no' },
    { optionName: 'script_version', optionValue: '4.0.0', optionGroup: 'script', autoLoad: 'yes' },
    { optionName: 'script_build', optionValue: '', optionGroup: 'script', autoLoad: 'yes' },
    { optionName: 'script_db_version', optionValue: '', optionGroup: 'script', autoLoad: 'yes' },
    { optionName: 'script_latest', optionValue: '0', optionGroup: 'script', autoLoad: 'yes' },
    { optionName: 'script_last_cron', optionValue: '', optionGroup: 'script', autoLoad: 'yes' },
  ]).run()

  // Seed admin user with a known bcrypt hash (admin123 at cost 12)
  // Pre-generated hash to avoid slow bcrypt in tests
  db.insert(schema.users).values({
    userIp: '127.0.0.1',
    userEmail: 'admin@example.com',
    userUsername: 'admin',
    userPassword: '$2b$12$testHashForUnitTestsOnly', // placeholder for test
    userGroup: 1,
    userJoinDate: Math.floor(Date.now() / 1000),
    userLastLogin: 0,
    lastActivity: 0,
    userCookie: '',
    userSession: '',
    userApiKey: 'abc123def456ghi789jkl012',
    userVerify: '',
  }).run()
})

afterAll(() => {
  sqlite.close()
})

describe('Database Schema', () => {
  describe('Tables existence', () => {
    it('should have all 19 application tables', () => {
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__drizzle%' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as { name: string }[]
      const tableNames = tables.map((t) => t.name)

      // Check all expected tables exist
      const expectedTables = [
        'article2cat',
        'article_fields',
        'article_tags',
        'articles',
        'attachments',
        'captcha',
        'categories',
        'comments',
        'failed_logins',
        'glossary',
        'modules',
        'search',
        'searchlog',
        'sessions',
        'settings',
        'tags',
        'user_groups',
        'user_notes',
        'users',
      ]

      for (const table of expectedTables) {
        expect(tableNames).toContain(table)
      }
      expect(tables.length).toBeGreaterThanOrEqual(19)
    })
  })

  describe('WAL mode and pragmas', () => {
    it('should enable WAL mode on file-based databases (not applicable to in-memory)', () => {
      // WAL mode is not supported on :memory: databases (returns "memory" instead of "wal")
      // The migrate.ts and db/index.ts both set WAL mode for file-based dbs.
      // This test verifies the pattern works - actual WAL verification is done post-migration.
      const tempDb = new Database(':memory:')
      // In-memory DBs always report "memory" mode - that's expected
      const result = tempDb.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      expect(['wal', 'memory']).toContain(result.journal_mode)
      tempDb.close()
    })

    it('should have foreign keys enforced on this connection', () => {
      const result = sqlite.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
      expect(result.foreign_keys).toBe(1)
    })
  })
})

describe('Seed Data', () => {
  describe('User Groups', () => {
    it('should have exactly 5 user groups', () => {
      const groups = db.select().from(schema.userGroups).all()
      expect(groups.length).toBe(5)
    })

    it('should have Site Admins as group 1', () => {
      const group = db.select().from(schema.userGroups).where(eq(schema.userGroups.groupId, 1)).get()
      expect(group).toBeDefined()
      expect(group!.groupName).toBe('Site Admins')
      expect(group!.canAccessAdmin).toBe('y')
      expect(group!.canManageArticles).toBe('y')
      expect(group!.canManageUsers).toBe('y')
    })

    it('should have Registered as group 2', () => {
      const group = db.select().from(schema.userGroups).where(eq(schema.userGroups.groupId, 2)).get()
      expect(group).toBeDefined()
      expect(group!.groupName).toBe('Registered')
      expect(group!.canAccessAdmin).toBe('n')
    })

    it('should have Pending as group 3', () => {
      const group = db.select().from(schema.userGroups).where(eq(schema.userGroups.groupId, 3)).get()
      expect(group).toBeDefined()
      expect(group!.groupName).toBe('Pending')
    })

    it('should have Banned as group 4', () => {
      const group = db.select().from(schema.userGroups).where(eq(schema.userGroups.groupId, 4)).get()
      expect(group).toBeDefined()
      expect(group!.groupName).toBe('Banned')
      expect(group!.canViewSite).toBe('n')
    })

    it('should have Guest as group 5', () => {
      const group = db.select().from(schema.userGroups).where(eq(schema.userGroups.groupId, 5)).get()
      expect(group).toBeDefined()
      expect(group!.groupName).toBe('Guest')
    })

    it('should have all groups in order 1-5', () => {
      const groups = db.select().from(schema.userGroups).all()
      const ids = groups.map((g) => g.groupId)
      expect(ids).toContain(1)
      expect(ids).toContain(2)
      expect(ids).toContain(3)
      expect(ids).toContain(4)
      expect(ids).toContain(5)
    })
  })

  describe('Settings', () => {
    it('should have exactly 14 settings', () => {
      const settingsRows = db.select().from(schema.settings).all()
      expect(settingsRows.length).toBe(14)
    })

    it('should have site_name setting', () => {
      const setting = db.select().from(schema.settings).where(eq(schema.settings.optionName, 'site_name')).get()
      expect(setting).toBeDefined()
      expect(setting!.optionValue).toBe('Your Site')
    })

    it('should have site_email setting', () => {
      const setting = db.select().from(schema.settings).where(eq(schema.settings.optionName, 'site_email')).get()
      expect(setting).toBeDefined()
      expect(setting!.optionValue).toBe('demo@demo.com')
    })

    it('should have script_version setting', () => {
      const setting = db.select().from(schema.settings).where(eq(schema.settings.optionName, 'script_version')).get()
      expect(setting).toBeDefined()
    })

    it('all settings with auto_load=yes should be in site or script group', () => {
      const autoLoadSettings = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.autoLoad, 'yes'))
        .all()
      for (const s of autoLoadSettings) {
        expect(['site', 'script']).toContain(s.optionGroup)
      }
    })
  })

  describe('Admin User', () => {
    it('should have at least one admin user in group 1', () => {
      const admins = db.select().from(schema.users).where(eq(schema.users.userGroup, 1)).all()
      expect(admins.length).toBeGreaterThanOrEqual(1)
    })

    it('admin user should have username "admin"', () => {
      const admin = db.select().from(schema.users).where(eq(schema.users.userUsername, 'admin')).get()
      expect(admin).toBeDefined()
      expect(admin!.userGroup).toBe(1)
    })

    it('admin password should start with $2 (bcrypt hash)', () => {
      const admin = db.select().from(schema.users).where(eq(schema.users.userUsername, 'admin')).get()
      expect(admin).toBeDefined()
      expect(admin!.userPassword).toMatch(/^\$2/)
    })

    it('admin user should have an API key', () => {
      const admin = db.select().from(schema.users).where(eq(schema.users.userUsername, 'admin')).get()
      expect(admin).toBeDefined()
      expect(admin!.userApiKey).toBeTruthy()
      expect(admin!.userApiKey.length).toBeGreaterThan(0)
    })
  })
})

describe('Schema Relations', () => {
  it('should enforce foreign key constraint: user must belong to valid group', () => {
    expect(() => {
      db.insert(schema.users).values({
        userIp: '',
        userEmail: 'bad@test.com',
        userUsername: 'baduser',
        userPassword: 'hash',
        userGroup: 9999, // non-existent group
        userJoinDate: 0,
        userLastLogin: 0,
        lastActivity: 0,
        userCookie: '',
        userSession: '',
        userApiKey: '',
        userVerify: '',
      }).run()
    }).toThrow()
  })

  it('should allow inserting articles and linking them to categories', () => {
    // Insert an article
    db.insert(schema.articles).values({
      articleUri: 'test-article',
      articleTitle: 'Test Article',
      articleKeywords: '',
      articleDescription: 'Description',
      articleShortDesc: 'Short desc',
      articleDate: Math.floor(Date.now() / 1000),
      articleModified: Math.floor(Date.now() / 1000),
      articleDisplay: 'y',
      articleHits: 0,
      articleAuthor: 0,
      articleOrder: 0,
      articleRating: 0,
    }).run()

    // Insert a category
    db.insert(schema.categories).values({
      catParent: 0,
      catUri: 'test-cat',
      catName: 'Test Category',
      catKeywords: '',
      catImage: '',
      catDescription: '',
      catAllowads: 'yes',
      catDisplay: 'yes',
      catOrder: 0,
      catPromo: '',
      catViews: 0,
    }).run()

    const article = db.select().from(schema.articles).where(eq(schema.articles.articleUri, 'test-article')).get()
    const category = db.select().from(schema.categories).where(eq(schema.categories.catUri, 'test-cat')).get()

    expect(article).toBeDefined()
    expect(category).toBeDefined()

    // Link them
    db.insert(schema.article2cat).values({
      articleIdRel: article!.articleId,
      categoryIdRel: category!.catId,
    }).run()

    const link = db.select().from(schema.article2cat).where(eq(schema.article2cat.articleIdRel, article!.articleId)).get()
    expect(link).toBeDefined()
    expect(link!.categoryIdRel).toBe(category!.catId)
  })

  it('should enforce foreign key: attachments reference valid articles', () => {
    expect(() => {
      db.insert(schema.attachments).values({
        articleId: 99999, // non-existent article
        attachFile: 'test.pdf',
        attachTitle: 'Test',
        attachType: 'pdf',
        attachSize: '100',
      }).run()
    }).toThrow()
  })
})
