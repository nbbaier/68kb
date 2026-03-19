import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_FILE_NAME ?? resolve(__dirname, '../../../../data/68kb.db')

const sqlite = new Database(dbPath)
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = ON')

const db = drizzle({ client: sqlite, schema })

async function seed() {
  console.log('Seeding database...')
  console.log(`Database: ${dbPath}`)

  // -------------------------------------------------------------------------
  // 1. User Groups (5 default groups)
  // -------------------------------------------------------------------------
  const existingGroups = db.select().from(schema.userGroups).all()
  if (existingGroups.length === 0) {
    console.log('Seeding user groups...')
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
    console.log('  ✓ Seeded 5 user groups')
  } else {
    console.log(`  → User groups already exist (${existingGroups.length} found), skipping`)
  }

  // -------------------------------------------------------------------------
  // 2. Default Settings (14 settings)
  // -------------------------------------------------------------------------
  const existingSettings = db.select().from(schema.settings).all()
  if (existingSettings.length === 0) {
    console.log('Seeding settings...')
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
    console.log('  ✓ Seeded 14 settings')
  } else {
    console.log(`  → Settings already exist (${existingSettings.length} found), skipping`)
  }

  // -------------------------------------------------------------------------
  // 3. Admin User (username: admin, password: admin123, group: 1)
  // -------------------------------------------------------------------------
  const existingAdmins = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.userGroup, 1))
    .all()

  if (existingAdmins.length === 0) {
    console.log('Seeding admin user...')
    const hashedPassword = await Bun.password.hash('admin123', {
      algorithm: 'bcrypt',
      cost: 12,
    })

    const now = Math.floor(Date.now() / 1000)

    db.insert(schema.users).values({
      userIp: '127.0.0.1',
      userEmail: 'admin@example.com',
      userUsername: 'admin',
      userPassword: hashedPassword,
      userGroup: 1,
      userJoinDate: now,
      userLastLogin: 0,
      lastActivity: 0,
      userCookie: '',
      userSession: '',
      userApiKey: crypto.randomUUID().replace(/-/g, ''),
      userVerify: '',
    }).run()
    console.log('  ✓ Seeded admin user (username: admin, password: admin123)')
  } else {
    console.log(`  → Admin user already exists (${existingAdmins.length} found), skipping`)
  }

  console.log('Seed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
