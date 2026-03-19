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

  // -------------------------------------------------------------------------
  // 4. Glossary Terms
  // -------------------------------------------------------------------------
  const existingGlossary = db.select().from(schema.glossary).all()
  if (existingGlossary.length === 0) {
    console.log('Seeding glossary terms...')
    db.insert(schema.glossary).values([
      { gTerm: 'algorithm', gDefinition: 'A step-by-step procedure for solving a problem or accomplishing a task.' },
      { gTerm: 'API', gDefinition: 'Application Programming Interface — a set of rules that allow programs to talk to each other.' },
      { gTerm: 'cache', gDefinition: 'Temporary storage that makes future requests for that data faster.' },
      { gTerm: 'database', gDefinition: 'An organized collection of structured information or data.' },
      { gTerm: 'function', gDefinition: 'A reusable block of code that performs a specific task.' },
      { gTerm: 'variable', gDefinition: 'A storage location paired with a name used to store data.' },
      { gTerm: 'loop', gDefinition: 'A programming construct that repeats a block of code while a condition is true.' },
      { gTerm: 'array', gDefinition: 'A data structure that stores a collection of elements in a single variable.' },
      { gTerm: 'object', gDefinition: 'An instance of a class that bundles data and functions together.' },
      { gTerm: 'class', gDefinition: 'A blueprint for creating objects that defines properties and methods.' },
    ]).run()
    console.log('  ✓ Seeded 10 glossary terms')
  } else {
    console.log(`  → Glossary terms already exist (${existingGlossary.length} found), skipping`)
  }

  // -------------------------------------------------------------------------
  // 5. Categories (3-level hierarchy for search dropdown validation)
  // -------------------------------------------------------------------------
  const existingCategories = db.select().from(schema.categories).all()
  if (existingCategories.length === 0) {
    console.log('Seeding categories...')
    const now = Math.floor(Date.now() / 1000)

    // Root categories
    const phpCat = db.insert(schema.categories).values({
      catName: 'PHP',
      catUri: 'php',
      catDescription: 'PHP programming language tutorials and guides.',
      catDisplay: 'yes',
      catOrder: 1,
    }).returning({ catId: schema.categories.catId }).get()!

    const jsCat = db.insert(schema.categories).values({
      catName: 'JavaScript',
      catUri: 'javascript',
      catDescription: 'JavaScript tutorials for web development.',
      catDisplay: 'yes',
      catOrder: 2,
    }).returning({ catId: schema.categories.catId }).get()!

    const pythonCat = db.insert(schema.categories).values({
      catName: 'Python',
      catUri: 'python',
      catDescription: 'Python programming guides and tutorials.',
      catDisplay: 'yes',
      catOrder: 3,
    }).returning({ catId: schema.categories.catId }).get()!

    // Child categories (level 2)
    const phpOopCat = db.insert(schema.categories).values({
      catName: 'PHP OOP',
      catUri: 'php/oop',
      catDescription: 'Object-oriented PHP programming.',
      catDisplay: 'yes',
      catParent: phpCat.catId,
      catOrder: 1,
    }).returning({ catId: schema.categories.catId }).get()!

    const phpBasicsCat = db.insert(schema.categories).values({
      catName: 'PHP Basics',
      catUri: 'php/basics',
      catDescription: 'Introduction to PHP programming.',
      catDisplay: 'yes',
      catParent: phpCat.catId,
      catOrder: 2,
    }).returning({ catId: schema.categories.catId }).get()!

    const jsFrameworksCat = db.insert(schema.categories).values({
      catName: 'JS Frameworks',
      catUri: 'javascript/frameworks',
      catDescription: 'Popular JavaScript frameworks and libraries.',
      catDisplay: 'yes',
      catParent: jsCat.catId,
      catOrder: 1,
    }).returning({ catId: schema.categories.catId }).get()!

    // Grandchild category (level 3) — needed for VAL-SEARCH-001 dropdown validation
    const phpOopPatternsCat = db.insert(schema.categories).values({
      catName: 'Design Patterns',
      catUri: 'php/oop/patterns',
      catDescription: 'Common OOP design patterns in PHP.',
      catDisplay: 'yes',
      catParent: phpOopCat.catId,
      catOrder: 1,
    }).returning({ catId: schema.categories.catId }).get()!

    const reactCat = db.insert(schema.categories).values({
      catName: 'React',
      catUri: 'javascript/frameworks/react',
      catDescription: 'React.js component library and ecosystem.',
      catDisplay: 'yes',
      catParent: jsFrameworksCat.catId,
      catOrder: 1,
    }).returning({ catId: schema.categories.catId }).get()!

    console.log('  ✓ Seeded 8 categories (3 root, 3 child, 2 grandchild)')

    // -------------------------------------------------------------------------
    // 6. Articles (25+ for search pagination, with glossary terms in body)
    // -------------------------------------------------------------------------
    const existingArticles = db.select().from(schema.articles).all()
    if (existingArticles.length === 0) {
      console.log('Seeding articles...')

      // Article containing glossary terms in body (for VAL-DETAIL-008)
      const glossaryArticle = db.insert(schema.articles).values({
        articleUri: 'introduction-to-algorithms',
        articleTitle: 'Introduction to Algorithms and Data Structures',
        articleKeywords: 'algorithm, array, function',
        articleDescription: `<p>In this guide, we explore the fundamentals of computer science.</p>
<p>An <strong>algorithm</strong> is a step-by-step procedure for solving a problem. Every program you write relies on algorithms to process data efficiently.</p>
<p>A <strong>variable</strong> is used to store data that your algorithm works with. Variables can hold numbers, strings, objects, and arrays.</p>
<p>An <strong>array</strong> is one of the most useful data structures — it stores a collection of elements that can be accessed by index.</p>
<p>Understanding these concepts is essential for any developer.</p>`,
        articleShortDesc: '<p>Learn the fundamentals of algorithms, variables, and arrays in programming.</p>',
        articleDisplay: 'y',
        articleHits: 150,
        articleDate: now - 86400 * 30,
        articleModified: now - 86400 * 10,
      }).returning({ articleId: schema.articles.articleId }).get()!

      // Link glossary article to PHP category
      db.insert(schema.article2cat).values({
        articleIdRel: glossaryArticle.articleId,
        categoryIdRel: phpCat.catId,
      }).run()

      // Sync tags for glossary article
      const glossaryTagNames = ['algorithm', 'array', 'function']
      const glossaryTagIds: number[] = []
      for (const tagName of glossaryTagNames) {
        const tagId = db.insert(schema.tags).values({ tag: tagName })
          .returning({ id: schema.tags.id }).get()!.id
        glossaryTagIds.push(tagId)
        db.insert(schema.articleTags).values({
          tagsTagId: tagId,
          tagsArticleId: glossaryArticle.articleId,
        }).run()
      }

      // Generate 25 additional articles for search pagination (VAL-SEARCH-004)
      const articleTitles = [
        'Getting Started with PHP',
        'PHP Arrays Explained',
        'Understanding PHP Functions',
        'PHP OOP Basics',
        'PHP Design Patterns',
        'PHP Security Best Practices',
        'JavaScript Variables and Scope',
        'JavaScript Arrays and Objects',
        'JavaScript Functions and Closures',
        'JavaScript Promises and Async/Await',
        'React Components Fundamentals',
        'React State Management',
        'React Hooks Deep Dive',
        'Python Variables and Data Types',
        'Python Functions and Modules',
        'Python Classes and Objects',
        'Python List Comprehensions',
        'Understanding Databases',
        'Database Design Patterns',
        'Caching Strategies for Web Apps',
        'Working with APIs',
        'RESTful API Design',
        'Algorithm Complexity Analysis',
        'Common Sorting Algorithms',
        'Binary Search Algorithm',
      ]

      const articleCategories: number[] = [
        phpCat.catId,        // Getting Started with PHP
        phpBasicsCat.catId,  // PHP Arrays Explained
        phpBasicsCat.catId,  // Understanding PHP Functions
        phpOopCat.catId,     // PHP OOP Basics
        phpOopPatternsCat.catId, // PHP Design Patterns
        phpCat.catId,        // PHP Security Best Practices
        jsCat.catId,         // JavaScript Variables and Scope
        jsCat.catId,         // JavaScript Arrays and Objects
        jsCat.catId,         // JavaScript Functions and Closures
        jsCat.catId,         // JavaScript Promises and Async/Await
        reactCat.catId,      // React Components Fundamentals
        reactCat.catId,      // React State Management
        reactCat.catId,      // React Hooks Deep Dive
        pythonCat.catId,     // Python Variables and Data Types
        pythonCat.catId,     // Python Functions and Modules
        pythonCat.catId,     // Python Classes and Objects
        pythonCat.catId,     // Python List Comprehensions
        phpCat.catId,        // Understanding Databases
        phpCat.catId,        // Database Design Patterns
        jsCat.catId,         // Caching Strategies for Web Apps
        jsFrameworksCat.catId, // Working with APIs
        jsFrameworksCat.catId, // RESTful API Design
        phpCat.catId,        // Algorithm Complexity Analysis
        phpCat.catId,        // Common Sorting Algorithms
        phpCat.catId,        // Binary Search Algorithm
      ]

      // Tags shared across articles for related articles feature (VAL-TAG-003)
      const sharedTag = db.insert(schema.tags).values({ tag: 'tutorial' })
        .returning({ id: schema.tags.id }).get()!
      const phpTag = db.insert(schema.tags).values({ tag: 'php' })
        .returning({ id: schema.tags.id }).get()!

      for (let i = 0; i < articleTitles.length; i++) {
        const title = articleTitles[i]
        const uri = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const catId = articleCategories[i]

        const newArticle = db.insert(schema.articles).values({
          articleUri: uri,
          articleTitle: title,
          articleKeywords: 'tutorial, programming',
          articleDescription: `<p>This article covers ${title.toLowerCase()}. It is a comprehensive guide for developers.</p><p>Understanding these concepts will help you write better code and build more robust applications.</p>`,
          articleShortDesc: `<p>A comprehensive guide to ${title.toLowerCase()}.</p>`,
          articleDisplay: 'y',
          articleHits: Math.floor(Math.random() * 100),
          articleDate: now - 86400 * (25 - i),
          articleModified: now - 86400 * (20 - i),
        }).returning({ articleId: schema.articles.articleId }).get()!

        db.insert(schema.article2cat).values({
          articleIdRel: newArticle.articleId,
          categoryIdRel: catId,
        }).run()

        // Add shared tags to create related articles links
        db.insert(schema.articleTags).values({
          tagsTagId: sharedTag.id,
          tagsArticleId: newArticle.articleId,
        }).run()

        // Add PHP tag to PHP-related articles
        if (catId === phpCat.catId || catId === phpBasicsCat.catId ||
            catId === phpOopCat.catId || catId === phpOopPatternsCat.catId) {
          db.insert(schema.articleTags).values({
            tagsTagId: phpTag.id,
            tagsArticleId: newArticle.articleId,
          }).run()
        }
      }

      console.log(`  ✓ Seeded ${articleTitles.length + 1} articles`)
    }
  } else {
    console.log(`  → Categories already exist (${existingCategories.length} found), skipping categories and articles`)
  }

  console.log('Seed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
