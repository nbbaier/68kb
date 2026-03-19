# Hono + Drizzle ORM + SQLite + Session Auth — Reference Guide

> Compiled March 2026. Package versions reflect latest stable releases at time of writing.

---

## Table of Contents

1. [Package Versions & Installation](#1-package-versions--installation)
2. [Project Structure (Monorepo)](#2-project-structure-monorepo)
3. [Hono — Node.js Setup](#3-hono--nodejs-setup)
4. [Hono — CORS Middleware](#4-hono--cors-middleware)
5. [Hono — Static File Serving](#5-hono--static-file-serving)
6. [Hono — File Upload Handling](#6-hono--file-upload-handling)
7. [Hono — Session Middleware (Cookie-Based)](#7-hono--session-middleware-cookie-based)
8. [Drizzle ORM — better-sqlite3 Setup](#8-drizzle-orm--better-sqlite3-setup)
9. [Drizzle ORM — SQLite Schema Definition](#9-drizzle-orm--sqlite-schema-definition)
10. [Drizzle ORM — Migration Workflow (drizzle-kit)](#10-drizzle-orm--migration-workflow-drizzle-kit)
11. [Drizzle ORM — Query Patterns](#11-drizzle-orm--query-patterns)
12. [Password Hashing (bcryptjs)](#12-password-hashing-bcryptjs)
13. [Hono + React SPA Pattern](#13-hono--react-spa-pattern)
14. [Development Setup with Hot Reload](#14-development-setup-with-hot-reload)
15. [Common Pitfalls & Anti-Patterns](#15-common-pitfalls--anti-patterns)

---

## 1. Package Versions & Installation

### Core Server Dependencies

```bash
npm i hono@^4.12                    # Web framework (latest 4.12.x)
npm i @hono/node-server@^1.19       # Node.js adapter for Hono
npm i drizzle-orm@^0.44             # Drizzle ORM (latest 0.x, v1.0 in beta)
npm i better-sqlite3@^11            # SQLite driver (native addon)
npm i hono-sessions@^0.8            # Cookie-based session middleware
npm i bcryptjs@^3.0                 # Password hashing (pure JS, no native deps)
```

### Dev Dependencies

```bash
npm i -D drizzle-kit@^0.30          # Migration CLI tool
npm i -D @types/better-sqlite3@^7
npm i -D @types/bcryptjs@^2
npm i -D tsx@^4.19                  # TypeScript execution with watch mode
npm i -D typescript@^5.7
npm i -D concurrently@^9            # Run multiple dev servers
```

### Frontend Dependencies (React SPA)

```bash
npm i react@^19 react-dom@^19
npm i -D @vitejs/plugin-react@^5
npm i -D vite@^7
npm i -D @types/react@^19 @types/react-dom@^19
```

---

## 2. Project Structure (Monorepo)

Recommended npm-workspaces monorepo layout:

```
project-root/
├── package.json                 # Root: workspaces config
├── tsconfig.base.json           # Shared TS options
├── apps/
│   ├── server/                  # Hono API backend
│   │   ├── package.json
│   │   ├── tsconfig.json        # Extends ../../tsconfig.base.json
│   │   ├── drizzle.config.ts    # Drizzle Kit config
│   │   ├── drizzle/             # Generated SQL migrations
│   │   └── src/
│   │       ├── index.ts         # Entry point (serve)
│   │       ├── app.ts           # Hono app definition
│   │       ├── db/
│   │       │   ├── index.ts     # DB connection (drizzle instance)
│   │       │   ├── schema.ts    # All Drizzle table definitions
│   │       │   └── migrate.ts   # Migration runner script
│   │       ├── routes/
│   │       │   ├── auth.ts      # Login/register/logout routes
│   │       │   ├── articles.ts  # CRUD routes
│   │       │   └── uploads.ts   # File upload routes
│   │       ├── middleware/
│   │       │   └── auth.ts      # Session auth guard middleware
│   │       └── lib/
│   │           └── password.ts  # bcryptjs hash/verify helpers
│   └── client/                  # React SPA (Vite)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           └── App.tsx
├── data/                        # SQLite database file location
│   └── app.db
└── uploads/                     # Uploaded files directory
```

### Root package.json (key fields)

```json
{
  "private": true,
  "type": "module",
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm run dev -w @project/server",
    "dev:client": "npm run dev -w @project/client",
    "build": "npm run build -w @project/client && npm run build -w @project/server",
    "start": "npm run start -w @project/server",
    "db:generate": "npm run db:generate -w @project/server",
    "db:migrate": "npm run db:migrate -w @project/server",
    "db:push": "npm run db:push -w @project/server",
    "db:studio": "npm run db:studio -w @project/server"
  }
}
```

### Server package.json

```json
{
  "name": "@project/server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## 3. Hono — Node.js Setup

### Basic Server (src/index.ts)

```typescript
import { serve } from '@hono/node-server';
import { app } from './app';

const port = Number(process.env.PORT) || 3000;

console.log(`Server running on http://localhost:${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
```

### App Definition (src/app.ts)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from '@hono/node-server/serve-static';
// ... import routes and session middleware

const app = new Hono();

// Built-in middleware
app.use('*', logger());

// Export for both serve() and testing
export { app };
```

### Typed Hono App (with session variables)

```typescript
import { Hono } from 'hono';
import type { Session } from 'hono-sessions';

// Define session data types
type SessionDataTypes = {
  userId: number;
  username: string;
};

// Define app-wide variable types
type AppEnv = {
  Variables: {
    session: Session<SessionDataTypes>;
    session_key_rotation: boolean;
  };
};

const app = new Hono<AppEnv>();
```

### Accessing Raw Node.js APIs

```typescript
import { serve, type HttpBindings } from '@hono/node-server';

type Bindings = HttpBindings;
const app = new Hono<{ Bindings: Bindings }>();

app.get('/info', (c) => {
  return c.json({
    remoteAddress: c.env.incoming.socket.remoteAddress,
  });
});
```

**Key points:**
- Hono requires Node.js 18.14.1+ (use 20+ for best compatibility)
- Always use `@hono/node-server` for the Node.js adapter
- `serve()` returns an `http.Server` instance for graceful shutdown
- Port can be configured via the `port` option

---

## 4. Hono — CORS Middleware

```typescript
import { cors } from 'hono/cors';

// Simple: allow all origins (development)
app.use('/api/*', cors());

// Production: restrict to your frontend origin
app.use('/api/*', cors({
  origin: 'http://localhost:5173',         // Vite dev server
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,                        // Required for cookies/sessions
  maxAge: 600,
}));

// Multiple origins
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'https://myapp.com'],
}));

// Dynamic origin (function)
app.use('/api/*', cors({
  origin: (origin, c) => {
    if (origin.endsWith('.myapp.com') || origin === 'http://localhost:5173') {
      return origin;
    }
    return 'https://myapp.com';
  },
}));

// Environment-dependent
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });
  return corsMiddleware(c, next);
});
```

**Key points:**
- CORS middleware must be registered **before** the route handlers it applies to
- `credentials: true` is **required** when using cookie-based sessions across origins
- When using with Vite, set `server.cors: false` in `vite.config.ts` to avoid conflicts

---

## 5. Hono — Static File Serving

```typescript
import { serveStatic } from '@hono/node-server/serve-static';

// Serve files from ./static at /static/*
// e.g., GET /static/image.png → ./static/image.png
app.use('/static/*', serveStatic({ root: './' }));

// Serve files from ./public at root level
// e.g., GET /image.png → ./public/image.png
app.use('*', serveStatic({ root: './public' }));

// Serve a specific file
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// Rewrite request paths
app.use('/assets/*', serveStatic({
  root: './',
  rewriteRequestPath: (path) => path.replace(/^\/assets/, '/dist/assets'),
}));

// Serve the React SPA's built output
app.use('*', serveStatic({ root: './client-dist' }));

// SPA fallback: serve index.html for all unmatched routes (after API routes)
app.get('*', serveStatic({ root: './client-dist', path: 'index.html' }));
```

**Key points:**
- Import `serveStatic` from `@hono/node-server/serve-static` (Node.js specific)
- The `root` is relative to the process working directory
- For SPA routing, you need both a wildcard `serveStatic` and a fallback that serves `index.html`

---

## 6. Hono — File Upload Handling

```typescript
import { Hono } from 'hono';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const uploads = new Hono();

// Single file upload
uploads.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];          // File | string

  if (!(file instanceof File)) {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Invalid file type' }, 400);
  }

  // Validate file size (e.g., 5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return c.json({ error: 'File too large' }, 400);
  }

  // Save file
  const uploadDir = join(process.cwd(), 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name}`;
  const filepath = join(uploadDir, filename);
  await writeFile(filepath, buffer);

  return c.json({ url: `/uploads/${filename}` });
});

// Multiple file upload
uploads.post('/upload-multiple', async (c) => {
  const body = await c.req.parseBody({ all: true }); // { all: true } for arrays
  const files = body['files'];  // (File | string)[]

  if (!Array.isArray(files)) {
    return c.json({ error: 'No files' }, 400);
  }

  const urls: string[] = [];
  for (const file of files) {
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name}`;
      await writeFile(join(process.cwd(), 'uploads', filename), buffer);
      urls.push(`/uploads/${filename}`);
    }
  }

  return c.json({ urls });
});

// With additional form fields
uploads.post('/upload-with-data', async (c) => {
  const body = await c.req.parseBody();
  const title = body['title'] as string;
  const file = body['file'];

  // ... process both the file and the text data
});
```

**Key points:**
- Use `c.req.parseBody()` for `multipart/form-data`
- Pass `{ all: true }` to `parseBody()` when expecting multiple files with the same field name
- The parsed file is a standard Web API `File` object
- Convert to `Buffer` via `file.arrayBuffer()` before writing to disk

---

## 7. Hono — Session Middleware (Cookie-Based)

### Installation

```bash
npm i hono-sessions
```

### Setup with CookieStore (simplest — no server-side state)

```typescript
import { Hono } from 'hono';
import {
  Session,
  sessionMiddleware,
  CookieStore,
} from 'hono-sessions';

// 1. Define session data types
type SessionDataTypes = {
  userId: number;
  username: string;
  role: string;
};

// 2. Define app env with session variables
type AppEnv = {
  Variables: {
    session: Session<SessionDataTypes>;
    session_key_rotation: boolean;
  };
};

const app = new Hono<AppEnv>();

// 3. Create cookie store
const store = new CookieStore();

// 4. Apply session middleware
app.use('*', sessionMiddleware({
  store,
  encryptionKey: process.env.SESSION_SECRET!, // Must be ≥ 32 characters
  expireAfterSeconds: 900,          // 15 min inactivity timeout
  autoExtendExpiration: true,        // Reset timer on each request
  cookieOptions: {
    sameSite: 'Lax',                 // CSRF protection
    path: '/',                       // Required
    httpOnly: true,                  // Prevent XSS access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  },
}));

// 5. Use sessions in routes
app.post('/api/auth/login', async (c) => {
  const session = c.get('session');
  // ... validate credentials ...
  session.set('userId', user.id);
  session.set('username', user.username);
  session.set('role', user.role);
  return c.json({ success: true });
});

app.post('/api/auth/logout', async (c) => {
  const session = c.get('session');
  session.forget('userId');
  session.forget('username');
  session.forget('role');
  return c.json({ success: true });
});

app.get('/api/auth/me', async (c) => {
  const session = c.get('session');
  const userId = session.get('userId');
  if (!userId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  return c.json({ userId, username: session.get('username') });
});
```

### Session API Methods

```typescript
const session = c.get('session');

session.get('key');           // Get a value
session.set('key', value);    // Set a value (must be JSON-serializable)
session.forget('key');        // Remove a value
session.flash('key', value);  // Set a one-time-read value (read once, then deleted)
session.touch();              // Update expiration without changing data
```

### Auth Guard Middleware

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import type { Session } from 'hono-sessions';

type SessionDataTypes = {
  userId: number;
  username: string;
  role: string;
};

type Env = {
  Variables: {
    session: Session<SessionDataTypes>;
    session_key_rotation: boolean;
  };
};

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const session = c.get('session');
  const userId = session.get('userId');

  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  await next();
});

// Usage in routes:
app.use('/api/admin/*', requireAuth);
// or per-route:
app.get('/api/profile', requireAuth, async (c) => { ... });
```

**Key points:**
- `hono-sessions` v0.8.1 supports Node.js v20+
- CookieStore encrypts all session data using `iron-webcrypto`
- The `encryptionKey` must be ≥ 32 characters; store it in an environment variable
- `credentials: true` must be set in CORS middleware for cookies to be sent cross-origin
- MemoryStore is also available for server-side session storage (not recommended for production without a persistent backing store)

---

## 8. Drizzle ORM — better-sqlite3 Setup

### Database Connection (src/db/index.ts)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Option 1: Simple string path
export const db = drizzle({
  connection: { source: './data/app.db' },
  schema,
});

// Option 2: Provide your own Database instance (more control)
const sqlite = new Database('./data/app.db');
sqlite.pragma('journal_mode = WAL');       // Better concurrent read performance
sqlite.pragma('foreign_keys = ON');         // Enforce FK constraints

export const db = drizzle({ client: sqlite, schema });
```

### Enable WAL Mode & Foreign Keys

SQLite defaults to rollback journal mode. WAL (Write-Ahead Logging) provides:
- Better concurrent read performance
- Readers don't block writers

```typescript
const sqlite = new Database('./data/app.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
```

**Key points:**
- `better-sqlite3` is **synchronous** by design — all operations block the event loop briefly
- For a typical web app with moderate traffic, this is perfectly fine
- Pass `schema` to `drizzle()` to enable the relational query API (`db.query.*`)
- Always enable `foreign_keys` pragma — SQLite disables them by default!

---

## 9. Drizzle ORM — SQLite Schema Definition

### Complete Schema Example (src/db/schema.ts)

```typescript
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

// ─── Reusable Timestamp Columns ─────────────────────────────
const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

// ─── Users Table ────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'admin' | 'editor' | 'viewer'>().default('viewer'),
  ...timestamps,
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
  uniqueIndex('users_username_idx').on(table.username),
]);

// ─── Categories Table ───────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  parentId: integer('parent_id').references((): AnySQLiteColumn => categories.id),
  ...timestamps,
}, (table) => [
  uniqueIndex('categories_slug_idx').on(table.slug),
]);

// ─── Articles Table ─────────────────────────────────────────
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  content: text('content').notNull().default(''),
  status: text('status').$type<'draft' | 'published' | 'archived'>().default('draft'),
  authorId: integer('author_id').notNull().references(() => users.id),
  categoryId: integer('category_id').references(() => categories.id),
  ...timestamps,
}, (table) => [
  uniqueIndex('articles_slug_idx').on(table.slug),
  index('articles_author_idx').on(table.authorId),
  index('articles_status_idx').on(table.status),
]);

// ─── Tags Table ─────────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
}, (table) => [
  uniqueIndex('tags_slug_idx').on(table.slug),
]);

// ─── Articles-to-Tags (Many-to-Many) ───────────────────────
export const articlesTags = sqliteTable('articles_tags', {
  articleId: integer('article_id').notNull().references(() => articles.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
}, (table) => [
  uniqueIndex('articles_tags_pk').on(table.articleId, table.tagId),
]);

// ─── Type Helpers ───────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
```

### SQLite Column Types Reference

```typescript
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

const example = sqliteTable('example', {
  // Integer types
  id: integer('id').primaryKey({ autoIncrement: true }),
  count: integer('count').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }),         // 0/1 → boolean
  createdAt: integer('created_at', { mode: 'timestamp' }),     // unix epoch → Date
  createdAtMs: integer('created_at_ms', { mode: 'timestamp_ms' }),

  // Text types
  name: text('name').notNull(),
  role: text('role').$type<'admin' | 'user'>(),                // TypeScript enum
  data: text('data', { mode: 'json' }).$type<{ key: string }>(), // JSON in text

  // Real (floating point)
  price: real('price'),

  // Blob
  binary: blob('binary', { mode: 'buffer' }),
});
```

---

## 10. Drizzle ORM — Migration Workflow (drizzle-kit)

### drizzle.config.ts (in server app root)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',                   // Migration output folder
  dbCredentials: {
    url: './data/app.db',             // Path to SQLite file
  },
  verbose: true,
  strict: true,
});
```

### Commands

```bash
# Generate SQL migration files from schema changes
npx drizzle-kit generate
# Output: ./drizzle/0001_xxxx.sql

# Apply migrations to the database
npx drizzle-kit migrate
# Or use a custom migrate script (see below)

# Push schema directly (no migration files — good for prototyping)
npx drizzle-kit push

# Open Drizzle Studio (web-based DB viewer)
npx drizzle-kit studio

# Introspect existing DB and generate schema
npx drizzle-kit pull
```

### Programmatic Migration Runner (src/db/migrate.ts)

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';

const sqlite = new Database('./data/app.db');
const db = drizzle({ client: sqlite });

console.log('Running migrations...');
migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete.');

sqlite.close();
```

### Recommended Workflow

1. **Development (rapid iteration):** Use `drizzle-kit push` — directly syncs schema to DB, no SQL files.
2. **Pre-production/production:** Use `drizzle-kit generate` → review SQL → `drizzle-kit migrate` or programmatic migrate.
3. **Schema introspection:** Use `drizzle-kit pull` to reverse-engineer an existing database.

---

## 11. Drizzle ORM — Query Patterns

### Select

```typescript
import { eq, lt, gte, ne, like, and, or, desc, asc, sql, count } from 'drizzle-orm';
import { db } from './db';
import { users, articles, categories, articlesTags, tags } from './db/schema';

// Select all
const allUsers = await db.select().from(users);

// Select with filter
const user = await db.select().from(users).where(eq(users.id, 1));

// Partial select (specific columns)
const names = await db.select({
  id: users.id,
  username: users.username,
}).from(users);

// Complex filters
const results = await db.select().from(articles).where(
  and(
    eq(articles.status, 'published'),
    eq(articles.authorId, 1),
    like(articles.title, '%tutorial%'),
  )
);

// Pagination
const page = 1;
const pageSize = 20;
const paged = await db.select().from(articles)
  .where(eq(articles.status, 'published'))
  .orderBy(desc(articles.createdAt))
  .limit(pageSize)
  .offset((page - 1) * pageSize);

// Count
const total = await db.$count(articles, eq(articles.status, 'published'));
```

### Insert

```typescript
// Single insert
await db.insert(users).values({
  username: 'johndoe',
  email: 'john@example.com',
  passwordHash: hashedPassword,
  role: 'editor',
});

// Insert and return the row (SQLite supports .returning())
const [newUser] = await db.insert(users).values({
  username: 'janedoe',
  email: 'jane@example.com',
  passwordHash: hashedPassword,
}).returning();

// Bulk insert
await db.insert(tags).values([
  { name: 'TypeScript', slug: 'typescript' },
  { name: 'Hono', slug: 'hono' },
  { name: 'Drizzle', slug: 'drizzle' },
]);

// Upsert (insert or update on conflict)
await db.insert(users)
  .values({ id: 1, username: 'updated', email: 'updated@example.com', passwordHash: hash })
  .onConflictDoUpdate({
    target: users.id,
    set: { username: 'updated' },
  });

// Insert and ignore on conflict
await db.insert(tags)
  .values({ name: 'Existing', slug: 'existing' })
  .onConflictDoNothing({ target: tags.slug });
```

### Update

```typescript
// Update with filter
await db.update(articles)
  .set({ status: 'published', updatedAt: new Date() })
  .where(eq(articles.id, 1));

// Update and return
const [updated] = await db.update(articles)
  .set({ title: 'New Title' })
  .where(eq(articles.id, 1))
  .returning();
```

### Delete

```typescript
// Delete with filter
await db.delete(articles).where(eq(articles.id, 1));

// Delete and return
const [deleted] = await db.delete(articles)
  .where(eq(articles.id, 1))
  .returning();

// Delete all (be careful!)
await db.delete(tags);
```

### Joins

```typescript
// Left join: articles with their authors
const articlesWithAuthors = await db.select({
  article: articles,
  author: {
    id: users.id,
    username: users.username,
  },
}).from(articles)
  .leftJoin(users, eq(articles.authorId, users.id));
// Type: { article: Article; author: { id: number; username: string } | null }[]

// Inner join
const publishedWithAuthors = await db.select()
  .from(articles)
  .innerJoin(users, eq(articles.authorId, users.id))
  .where(eq(articles.status, 'published'));

// Many-to-many: articles with tags
const articlesWithTags = await db.select({
  articleId: articles.id,
  articleTitle: articles.title,
  tagName: tags.name,
}).from(articles)
  .leftJoin(articlesTags, eq(articles.id, articlesTags.articleId))
  .leftJoin(tags, eq(articlesTags.tagId, tags.id));

// Aggregate joined results into nested structure
type ArticleWithTags = Article & { tags: string[] };
const rows = await db.select({
  article: articles,
  tagName: tags.name,
}).from(articles)
  .leftJoin(articlesTags, eq(articles.id, articlesTags.articleId))
  .leftJoin(tags, eq(articlesTags.tagId, tags.id));

const grouped = rows.reduce<Record<number, ArticleWithTags>>((acc, row) => {
  const { article, tagName } = row;
  if (!acc[article.id]) {
    acc[article.id] = { ...article, tags: [] };
  }
  if (tagName) {
    acc[article.id].tags.push(tagName);
  }
  return acc;
}, {});
```

### Relational Queries (db.query API)

Requires passing `schema` to the `drizzle()` constructor.

```typescript
// Define relations in schema (separate from table definitions)
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  articlesTags: many(articlesTags),
}));

export const articlesTagsRelations = relations(articlesTags, ({ one }) => ({
  article: one(articles, {
    fields: [articlesTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articlesTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  articlesTags: many(articlesTags),
}));

// Usage:
const articlesWithRelations = await db.query.articles.findMany({
  with: {
    author: true,
    category: true,
    articlesTags: {
      with: {
        tag: true,
      },
    },
  },
  where: eq(articles.status, 'published'),
  orderBy: [desc(articles.createdAt)],
  limit: 10,
});

const singleArticle = await db.query.articles.findFirst({
  where: eq(articles.slug, 'my-article'),
  with: {
    author: {
      columns: { id: true, username: true },
    },
  },
});
```

### Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const [article] = await tx.insert(articles).values({
    title: 'New Article',
    slug: 'new-article',
    content: 'Content here',
    authorId: 1,
  }).returning();

  await tx.insert(articlesTags).values([
    { articleId: article.id, tagId: 1 },
    { articleId: article.id, tagId: 2 },
  ]);

  return article;
});
```

---

## 12. Password Hashing (bcryptjs)

### Why bcryptjs over bcrypt?

| Package    | Pros                              | Cons                          |
|------------|-----------------------------------|-------------------------------|
| `bcrypt`   | Faster (native C++ addon)         | Requires build tools, platform-specific |
| `bcryptjs` | Pure JS, zero native deps, TS support | Slightly slower (~3x)        |

For a knowledge base app, `bcryptjs` is the better choice — no build issues, works everywhere.

### Implementation (src/lib/password.ts)

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // Good balance of security and performance

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

### Usage in Auth Routes

```typescript
import { hashPassword, verifyPassword } from '../lib/password';

// Registration
app.post('/api/auth/register', async (c) => {
  const { username, email, password } = await c.req.json();

  // Check if user exists
  const existing = await db.select().from(users)
    .where(eq(users.email, email)).get();
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    username,
    email,
    passwordHash,
  }).returning();

  const session = c.get('session');
  session.set('userId', user.id);
  session.set('username', user.username);

  return c.json({ id: user.id, username: user.username }, 201);
});

// Login
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();

  const user = await db.select().from(users)
    .where(eq(users.email, email)).get();
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const session = c.get('session');
  session.set('userId', user.id);
  session.set('username', user.username);
  session.set('role', user.role);

  return c.json({ id: user.id, username: user.username });
});
```

---

## 13. Hono + React SPA Pattern

### Strategy: Serve the Built SPA from Hono

In production, the Hono server serves both the API **and** the pre-built React SPA static files.

### Server Configuration

```typescript
// src/app.ts
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// 1. API routes first (highest priority)
app.route('/api/auth', authRoutes);
app.route('/api/articles', articleRoutes);
app.route('/api/uploads', uploadRoutes);

// 2. Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }));

// 3. Serve SPA static assets (JS, CSS, images from Vite build)
app.use('*', serveStatic({ root: './client-dist' }));

// 4. SPA fallback — serve index.html for all unmatched routes
//    This enables client-side routing (React Router, etc.)
app.get('*', serveStatic({ root: './client-dist', path: 'index.html' }));

export { app };
```

### Vite Config for Building to Server

```typescript
// apps/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output to the server's serving directory
    outDir: path.resolve(__dirname, '../server/client-dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Development Proxy (avoid CORS in dev)

```typescript
// apps/client/vite.config.ts (dev only)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

With the proxy, the frontend can use relative URLs (`/api/auth/login`) in both dev and prod.

---

## 14. Development Setup with Hot Reload

### Server: tsx watch

```json
// apps/server/package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

`tsx watch` re-runs the server on every `.ts` file change. It uses esbuild for fast compilation.

### Client: Vite dev server

```json
// apps/client/package.json
{
  "scripts": {
    "dev": "vite"
  }
}
```

Vite provides HMR (Hot Module Replacement) for instant React updates.

### Run Both Concurrently

```json
// Root package.json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm run dev -w @project/server",
    "dev:client": "npm run dev -w @project/client"
  },
  "devDependencies": {
    "concurrently": "^9"
  }
}
```

```bash
# From project root
npm run dev
# → Server on http://localhost:3000 (API + sessions)
# → Client on http://localhost:5173 (React SPA with HMR, proxying /api to 3000)
```

---

## 15. Common Pitfalls & Anti-Patterns

### Hono

| Pitfall | Solution |
|---------|----------|
| CORS middleware registered after routes | Always register CORS middleware **before** route handlers |
| `credentials: true` missing in CORS | Required for cookies/sessions to be sent cross-origin |
| `serveStatic` from wrong import | Use `@hono/node-server/serve-static` for Node.js, not `hono/serve-static` |
| SPA routing 404s on refresh | Add `app.get('*', serveStatic({ path: 'index.html' }))` as the **last** route |
| File upload: not checking `instanceof File` | `parseBody()` returns `File | string` — always type-check |

### Drizzle ORM

| Pitfall | Solution |
|---------|----------|
| Foreign keys silently ignored | Enable `sqlite.pragma('foreign_keys = ON')` — SQLite disables them by default |
| `db.query.*` not available | You must pass `schema` to the `drizzle()` constructor |
| Relational queries return `undefined` | Relations must be defined with `relations()` AND schema must be passed to `drizzle()` |
| Migration files out of sync | Never manually edit migration SQL files; regenerate instead |
| `$type<>()` doesn't validate at runtime | It's only a TypeScript type hint — add runtime validation (e.g., Zod) separately |
| Using `drizzle-kit push` in production | Use `generate` + `migrate` for production; `push` is for prototyping only |

### Sessions

| Pitfall | Solution |
|---------|----------|
| `encryptionKey` too short | Must be ≥ 32 characters or session encryption will fail silently |
| Session data not persisting | Ensure `cookieOptions.path` is set to `'/'` |
| Session lost after deploy | CookieStore sessions survive restarts (data is in the cookie). MemoryStore does not. |
| XSS exposure | Always set `httpOnly: true` in cookie options |
| CSRF vulnerability | Use `sameSite: 'Lax'` (or `'Strict'`) in cookie options |

### General

| Pitfall | Solution |
|---------|----------|
| `better-sqlite3` build failures | Requires Python and C++ build tools; use `npm rebuild` if switching Node versions |
| SQLite WAL file growing large | Run `PRAGMA wal_checkpoint(TRUNCATE)` periodically or on startup |
| Storing secrets in code | Use environment variables; never commit `.env` files |
| Not validating request bodies | Use Zod + `@hono/zod-validator` middleware for request validation |

---

## Quick Reference: Key Imports

```typescript
// Hono
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createMiddleware } from 'hono/factory';

// Sessions
import { sessionMiddleware, CookieStore, Session } from 'hono-sessions';

// Drizzle
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, ne, lt, gt, lte, gte, like, and, or, not, desc, asc, sql, count } from 'drizzle-orm';
import { sqliteTable, text, integer, real, blob, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { defineConfig } from 'drizzle-kit';

// better-sqlite3
import Database from 'better-sqlite3';

// bcryptjs
import bcrypt from 'bcryptjs';
```

---

## Sources

- Hono docs: https://hono.dev/docs
- Hono Node.js adapter: https://hono.dev/docs/getting-started/nodejs
- Hono CORS middleware: https://hono.dev/docs/middleware/builtin/cors
- Hono file uploads: https://hono.dev/examples/file-upload
- hono-sessions: https://www.npmjs.com/package/hono-sessions (v0.8.1)
- @hono/node-server: https://www.npmjs.com/package/@hono/node-server (v1.19.11)
- Drizzle ORM docs: https://orm.drizzle.team/docs
- Drizzle SQLite setup: https://orm.drizzle.team/docs/get-started-sqlite
- Drizzle schema: https://orm.drizzle.team/docs/sql-schema-declaration
- Drizzle config: https://orm.drizzle.team/docs/drizzle-config-file
- Drizzle select/insert/update/delete/joins: https://orm.drizzle.team/docs/select
- drizzle-kit push: https://orm.drizzle.team/docs/drizzle-kit-push
- bcryptjs: https://www.npmjs.com/package/bcryptjs (v3.0.3)
- Monorepo guide: https://blog.raulnq.com/building-a-full-stack-typescript-monorepo-with-react-and-hono
