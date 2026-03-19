# Bun + Hono + shadcn/ui — Reference Guide

> Compiled March 2026. Covers Bun runtime, Hono on Bun, Drizzle ORM with `bun:sqlite`, Bun workspaces, and shadcn/ui with Vite + React + TypeScript.

---

## Table of Contents

1. [Bun + Hono Server Setup](#1-bun--hono-server-setup)
2. [Bun + Drizzle ORM + SQLite Setup](#2-bun--drizzle-orm--sqlite-setup)
3. [Bun Workspaces Configuration](#3-bun-workspaces-configuration)
4. [Bun Dev Workflow (Watch/Hot Reload)](#4-bun-dev-workflow-watchhot-reload)
5. [shadcn/ui Initialization with Vite](#5-shadcnui-initialization-with-vite)
6. [Recommended shadcn/ui Components for KB Admin Panel](#6-recommended-shadcnui-components-for-kb-admin-panel)
7. [Key Differences from Node.js / npm](#7-key-differences-from-nodejs--npm)
8. [Compatibility Warnings & Gotchas](#8-compatibility-warnings--gotchas)

---

## 1. Bun + Hono Server Setup

### No Adapter Needed

Unlike Node.js (which requires `@hono/node-server`), **Hono works natively on Bun with zero adapter packages**. Bun's built-in HTTP server is based on Web Standards (`Request`/`Response`), which is exactly what Hono expects.

### Installation

```bash
bun add hono
```

That's it — no `@hono/node-server`, no `@hono/bun-adapter`. Just `hono`.

### Basic Server (src/index.ts)

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Bun!'))

export default app
```

When you `export default` a Hono app (or any object with a `fetch` method), Bun automatically calls `Bun.serve()` with it. This is the **idiomatic Bun pattern**.

### Explicit Bun.serve() with Port Configuration

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Bun!'))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default {
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
}
```

### Serving Static Files (Bun-specific import)

```typescript
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'  // NOT @hono/node-server/serve-static

const app = new Hono()

// Serve files from ./static at /static/*
app.use('/static/*', serveStatic({ root: './' }))

// Serve favicon
app.use('/favicon.ico', serveStatic({ path: './favicon.ico' }))

// SPA fallback for client-side routing
app.get('*', serveStatic({ root: './client-dist' }))
app.get('*', serveStatic({ root: './client-dist', path: 'index.html' }))

export default app
```

**Key point:** Import `serveStatic` from `'hono/bun'`, **not** `'@hono/node-server/serve-static'`.

### Hot Reload Dev Script

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts"
  }
}
```

`--hot` preserves the running `Bun.serve()` instance and swaps the `fetch` handler in-place without restarting the process. This is faster than `--watch` (which does a full process restart).

### Testing with bun:test

```typescript
import { describe, expect, it } from 'bun:test'
import app from './index'

describe('API', () => {
  it('should return 200', async () => {
    const req = new Request('http://localhost/')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })
})
```

Run with: `bun test`

### All Hono Middleware Works Unchanged

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
```

---

## 2. Bun + Drizzle ORM + SQLite Setup

### bun:sqlite vs better-sqlite3

| Feature | `bun:sqlite` | `better-sqlite3` |
|---------|-------------|-------------------|
| Install | Built-in (zero deps) | Requires native C++ compilation |
| Performance | Extremely fast (native Bun integration) | Fast (native addon) |
| Drizzle support | ✅ `drizzle-orm/bun-sqlite` | ✅ `drizzle-orm/better-sqlite3` |
| Bun compatibility | Perfect (it IS Bun) | Works, but requires build tools |
| Sync + Async API | Both supported by Drizzle | Both supported by Drizzle |

**Recommendation:** Use `bun:sqlite` — it's built-in, faster, and zero-dependency.

### Installation

```bash
bun add drizzle-orm
bun add -D drizzle-kit @types/bun
```

No SQLite driver package needed — `bun:sqlite` is built into Bun.

### Database Connection (src/db/index.ts)

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

// Option 1: Simple — Drizzle creates the Database instance
export const db = drizzle(process.env.DB_FILE_NAME || './data/app.db')

// Option 2: Full control — provide your own Database instance
const sqlite = new Database(process.env.DB_FILE_NAME || './data/app.db')
sqlite.exec('PRAGMA journal_mode = WAL')     // Better concurrent read perf
sqlite.exec('PRAGMA foreign_keys = ON')       // Enforce FK constraints

export const db = drizzle({ client: sqlite, schema })
```

### Schema Definition (src/db/schema.ts)

Identical to any Drizzle SQLite schema — no Bun-specific differences:

```typescript
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}

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
])

export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  content: text('content').notNull().default(''),
  status: text('status').$type<'draft' | 'published' | 'archived'>().default('draft'),
  authorId: integer('author_id').notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  uniqueIndex('articles_slug_idx').on(table.slug),
  index('articles_status_idx').on(table.status),
])

// Type helpers
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert
```

### Drizzle Config (drizzle.config.ts)

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_FILE_NAME || './data/app.db',
  },
})
```

### Migration Commands (using bunx instead of npx)

```bash
# Generate SQL migration files from schema changes
bunx drizzle-kit generate

# Apply migrations programmatically
bun run src/db/migrate.ts

# Push schema directly (prototyping only)
bunx drizzle-kit push

# Open Drizzle Studio (web-based DB viewer)
bunx drizzle-kit studio
```

### Programmatic Migration Runner (src/db/migrate.ts)

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'

const sqlite = new Database(process.env.DB_FILE_NAME || './data/app.db')
const db = drizzle(sqlite)

console.log('Running migrations...')
migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations complete.')

sqlite.close()
```

### Sync API (bun:sqlite exclusive feature)

`bun:sqlite` is synchronous under the hood. Drizzle exposes sync query methods:

```typescript
// Async (standard — works everywhere)
const users = await db.select().from(usersTable)

// Sync (bun:sqlite only — slightly faster, no await needed)
const users = db.select().from(usersTable).all()    // Returns array
const user = db.select().from(usersTable).get()      // Returns first row or undefined
const raw = db.select().from(usersTable).values()    // Returns raw value arrays
db.insert(usersTable).values({ ... }).run()           // Execute without return
```

---

## 3. Bun Workspaces Configuration

Bun supports npm-compatible `workspaces` in `package.json`. The setup is nearly identical to npm workspaces.

### Root package.json

```json
{
  "name": "68kb",
  "private": true,
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "dev": "concurrently \"bun run dev:server\" \"bun run dev:client\"",
    "dev:server": "bun run --filter @68kb/server dev",
    "dev:client": "bun run --filter @68kb/client dev",
    "build": "bun run --filter @68kb/client build && bun run --filter @68kb/server build",
    "db:generate": "bun run --filter @68kb/server db:generate",
    "db:migrate": "bun run --filter @68kb/server db:migrate",
    "db:push": "bun run --filter @68kb/server db:push",
    "db:studio": "bun run --filter @68kb/server db:studio"
  },
  "devDependencies": {
    "concurrently": "^9",
    "typescript": "^5.7"
  }
}
```

### Workspace Package References

Use `workspace:*` protocol to reference sibling packages:

```json
// apps/server/package.json
{
  "name": "@68kb/server",
  "dependencies": {
    "@68kb/shared": "workspace:*"
  }
}
```

### Monorepo Directory Structure

```
project-root/
├── package.json            # Root with workspaces config
├── bun.lock                # Single lockfile for all workspaces
├── tsconfig.base.json
├── apps/
│   ├── server/             # Hono API (Bun runtime)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       └── db/
│   └── client/             # React SPA (Vite)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
├── data/                   # SQLite database file
└── uploads/                # Uploaded files
```

### Bun Workspace Commands

```bash
# Install all workspace dependencies
bun install

# Install dep for a specific workspace
bun add hono --filter @68kb/server

# Run script in specific workspace
bun run --filter @68kb/server dev

# Run script in all workspaces matching pattern
bun run --filter "pkg-*" build

# Install only specific workspaces' dependencies
bun install --filter @68kb/server
```

### Key Differences from npm Workspaces

| npm | Bun |
|-----|-----|
| `npm run dev -w @pkg/server` | `bun run --filter @pkg/server dev` |
| `npm install -w @pkg/server hono` | `bun add hono --filter @pkg/server` |
| `package-lock.json` | `bun.lock` (binary format, much faster) |
| `npx drizzle-kit generate` | `bunx drizzle-kit generate` |

---

## 4. Bun Dev Workflow (Watch/Hot Reload)

### Two Modes: `--watch` vs `--hot`

| Mode | Behavior | Best For |
|------|----------|----------|
| `--watch` | Hard restart (kills & respawns process) | General scripts, tests |
| `--hot` | Soft reload (swaps modules, preserves global state) | HTTP servers (Hono) |

### Server Dev Script (recommended)

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts"
  }
}
```

With `--hot`, when you save a file:
1. Bun detects the `Bun.serve()` / `export default { fetch }` pattern
2. Re-evaluates all changed modules
3. Swaps the `fetch` handler **without restarting the server**
4. Existing connections are not dropped

This is the Bun equivalent of `tsx watch` but faster and without extra dependencies.

### Watch Mode (alternative — full restart)

```json
{
  "scripts": {
    "dev:watch": "bun run --watch src/index.ts"
  }
}
```

Use `--watch` when you need a clean restart (e.g., database connections, global state resets).

### Client Dev (Vite — unchanged)

```json
{
  "scripts": {
    "dev": "bunx vite"
  }
}
```

Vite's HMR works perfectly with Bun as the package manager. Vite still uses Node.js internally for its dev server.

### Running Both Concurrently

```json
{
  "scripts": {
    "dev": "concurrently \"bun run dev:server\" \"bun run dev:client\"",
    "dev:server": "bun run --hot apps/server/src/index.ts",
    "dev:client": "bunx --cwd apps/client vite"
  }
}
```

### Test Watch Mode

```bash
bun test --watch
```

---

## 5. shadcn/ui Initialization with Vite

### Quick Setup (New Project)

The simplest path — `shadcn` CLI handles everything:

```bash
bunx shadcn@latest init
```

This interactive command will:
1. Detect your Vite + React + TypeScript project
2. Install Tailwind CSS v4 (latest) and configure it
3. Create `components.json` configuration file
4. Set up path aliases (`@/components`, `@/lib`, etc.)
5. Install base dependencies (Radix primitives, class-variance-authority, clsx, tailwind-merge, etc.)

### Manual Step-by-Step Setup

If you prefer manual control:

#### Step 1: Create Vite + React + TypeScript project

```bash
bun create vite apps/client --template react-ts
cd apps/client
bun install
```

#### Step 2: Install and configure Tailwind CSS v4

```bash
bun add tailwindcss @tailwindcss/vite
```

In `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

In your main CSS file (`src/index.css`):
```css
@import "tailwindcss";
```

#### Step 3: Configure path aliases

In `tsconfig.json` (or `tsconfig.app.json`):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

In `vite.config.ts`:
```typescript
import path from 'path'

export default defineConfig({
  // ...plugins
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

#### Step 4: Initialize shadcn

```bash
bunx shadcn@latest init
```

This creates a `components.json` file:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Adding Components

```bash
# Add individual components
bunx shadcn@latest add button
bunx shadcn@latest add dialog
bunx shadcn@latest add table
bunx shadcn@latest add form

# Add multiple at once
bunx shadcn@latest add button dialog table form input select textarea

# List available components
bunx shadcn@latest add
```

Components are **copied into your project** (not installed as a dependency). They land in `src/components/ui/`.

### Usage

```tsx
import { Button } from '@/components/ui/button'

export function MyComponent() {
  return <Button variant="outline">Click me</Button>
}
```

### Core Dependencies Installed by shadcn

These are installed automatically when you init + add components:

```bash
# Base utilities (installed by init)
tailwindcss
@tailwindcss/vite
class-variance-authority    # Component variant management
clsx                         # Conditional class names
tailwind-merge               # Merge conflicting tailwind classes
lucide-react                 # Icon library

# Per-component (installed when you add them)
@radix-ui/react-dialog       # Dialog/Modal primitives
@radix-ui/react-select       # Select primitives
@radix-ui/react-dropdown-menu
@radix-ui/react-tabs
# ... etc (each component installs its Radix primitive)

# For Data Table
@tanstack/react-table        # Headless table library

# For Forms
react-hook-form              # Form state management
@hookform/resolvers          # Zod resolver for react-hook-form
zod                          # Schema validation
```

---

## 6. Recommended shadcn/ui Components for KB Admin Panel

### Essential Components

| Component | Use Case | Install Command |
|-----------|----------|-----------------|
| **Button** | Actions, submit, navigation | `bunx shadcn@latest add button` |
| **Input** | Text fields, search | `bunx shadcn@latest add input` |
| **Textarea** | Content editing | `bunx shadcn@latest add textarea` |
| **Select** | Category/status dropdowns | `bunx shadcn@latest add select` |
| **Dialog** | Confirm delete, quick edit | `bunx shadcn@latest add dialog` |
| **Sheet** | Side panels (mobile nav, filters) | `bunx shadcn@latest add sheet` |
| **Table** | Base table display | `bunx shadcn@latest add table` |
| **Data Table** | Full-featured article list (sort, filter, paginate) | `bunx shadcn@latest add data-table` |
| **Form** | Article editor, settings, login | `bunx shadcn@latest add form` |
| **Card** | Dashboard stats, article previews | `bunx shadcn@latest add card` |
| **Badge** | Article status (draft/published/archived) | `bunx shadcn@latest add badge` |
| **Tabs** | Content/Settings/Preview tabs | `bunx shadcn@latest add tabs` |
| **Dropdown Menu** | Row actions (edit/delete/publish) | `bunx shadcn@latest add dropdown-menu` |
| **Breadcrumb** | Navigation hierarchy | `bunx shadcn@latest add breadcrumb` |
| **Sidebar** | Admin navigation | `bunx shadcn@latest add sidebar` |
| **Sonner** | Toast notifications (save success, errors) | `bunx shadcn@latest add sonner` |
| **Skeleton** | Loading states | `bunx shadcn@latest add skeleton` |
| **Label** | Form field labels | `bunx shadcn@latest add label` |
| **Separator** | Visual dividers | `bunx shadcn@latest add separator` |
| **Alert Dialog** | Destructive action confirmation | `bunx shadcn@latest add alert-dialog` |
| **Command** | Command palette / search (Ctrl+K) | `bunx shadcn@latest add command` |
| **Pagination** | Article list pagination | `bunx shadcn@latest add pagination` |

### Bulk Install (all recommended for KB admin)

```bash
bunx shadcn@latest add button input textarea select dialog sheet table \
  form card badge tabs dropdown-menu breadcrumb sidebar sonner skeleton \
  label separator alert-dialog command pagination
```

### Data Table Setup (Key Component)

The Data Table is not a single component — it's a pattern using `@tanstack/react-table` with shadcn's Table component. After running `bunx shadcn@latest add data-table`, you also need:

```bash
bun add @tanstack/react-table
```

Example columns definition for articles:

```tsx
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

type Article = {
  id: number
  title: string
  status: 'draft' | 'published' | 'archived'
  author: string
  createdAt: Date
}

export const columns: ColumnDef<Article>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge variant={status === 'published' ? 'default' : 'secondary'}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'author',
    header: 'Author',
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Publish</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
```

### React Router Integration

shadcn/ui has first-class React Router support. For a Vite + React SPA:

```bash
bun add react-router
```

```tsx
// src/main.tsx
import { BrowserRouter } from 'react-router'
import { Routes, Route } from 'react-router'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="articles" element={<ArticleList />} />
          <Route path="articles/new" element={<ArticleEditor />} />
          <Route path="articles/:id" element={<ArticleEditor />} />
          <Route path="categories" element={<CategoryList />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## 7. Key Differences from Node.js / npm

### Package Manager Commands

| Action | npm | Bun |
|--------|-----|-----|
| Install all deps | `npm install` | `bun install` |
| Add dependency | `npm install hono` | `bun add hono` |
| Add dev dependency | `npm install -D tsx` | `bun add -D drizzle-kit` |
| Run script | `npm run dev` | `bun run dev` |
| Execute binary | `npx drizzle-kit generate` | `bunx drizzle-kit generate` |
| Workspace install | `npm install -w @pkg/server hono` | `bun add hono --filter @pkg/server` |
| Run workspace script | `npm run dev -w @pkg/server` | `bun run --filter @pkg/server dev` |
| Lockfile | `package-lock.json` | `bun.lock` |

### Hono Imports

| Node.js | Bun |
|---------|-----|
| `import { serve } from '@hono/node-server'` | Not needed (use `export default`) |
| `import { serveStatic } from '@hono/node-server/serve-static'` | `import { serveStatic } from 'hono/bun'` |

### Drizzle Imports

| Node.js (better-sqlite3) | Bun (bun:sqlite) |
|--------------------------|-------------------|
| `import { drizzle } from 'drizzle-orm/better-sqlite3'` | `import { drizzle } from 'drizzle-orm/bun-sqlite'` |
| `import { migrate } from 'drizzle-orm/better-sqlite3/migrator'` | `import { migrate } from 'drizzle-orm/bun-sqlite/migrator'` |
| `import Database from 'better-sqlite3'` | `import { Database } from 'bun:sqlite'` |

### Server Entry Pattern

```typescript
// Node.js pattern (requires @hono/node-server)
import { serve } from '@hono/node-server'
import { app } from './app'
serve({ fetch: app.fetch, port: 3000 })

// Bun pattern (zero deps)
import { Hono } from 'hono'
const app = new Hono()
// ... routes ...
export default { port: 3000, fetch: app.fetch }
```

---

## 8. Compatibility Warnings & Gotchas

### Bun-Specific

| Issue | Details |
|-------|---------|
| **`bun:sqlite` is Bun-only** | Code using `import { Database } from 'bun:sqlite'` will NOT work in Node.js. If you need Node.js fallback, use `better-sqlite3` instead. |
| **`--hot` preserves global state** | Variables on `globalThis` survive hot reloads. Database connections persist (good), but stale caches may not clear (be aware). |
| **`bun.lock` is binary** | Not human-readable. Use `bun install --yarn` to also generate a `yarn.lock` if needed for compatibility. |
| **Native addons** | Most work, but some may need recompilation. `bun:sqlite` eliminates the need for `better-sqlite3`'s native addon entirely. |
| **Vite dev server runs on Node.js** | Even when using `bun` as package manager, `vite dev` still uses Node.js internally. This is fine — only the server app uses Bun runtime. |

### shadcn/ui Specific

| Issue | Details |
|-------|---------|
| **Not a package — it's copied code** | Components are added to your `src/components/ui/` directory. You own them. Update by re-running `bunx shadcn@latest add <component>`. |
| **Tailwind CSS v4 required** | shadcn/ui latest requires Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`). Not v3. |
| **`rsc: false` for Vite** | When initializing, ensure `rsc` (React Server Components) is set to `false` — that's a Next.js feature. |
| **Data Table requires extra dep** | `@tanstack/react-table` must be installed separately: `bun add @tanstack/react-table` |
| **Form requires extra deps** | `react-hook-form`, `@hookform/resolvers`, and `zod` must be installed: `bun add react-hook-form @hookform/resolvers zod` |

### Drizzle ORM

| Issue | Details |
|-------|---------|
| **`foreign_keys` OFF by default** | SQLite disables foreign keys by default. Always run `sqlite.exec('PRAGMA foreign_keys = ON')`. |
| **`drizzle-kit push` is for prototyping only** | Use `generate` + `migrate` for production databases. |
| **Pass `schema` to `drizzle()` for relational queries** | `db.query.*` API only works when you pass `schema` to the constructor. |

---

## Quick Reference: Key Imports (Bun Edition)

```typescript
// Hono (Bun — no adapter needed)
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createMiddleware } from 'hono/factory'

// Sessions
import { sessionMiddleware, CookieStore, Session } from 'hono-sessions'

// Drizzle (bun:sqlite)
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import { eq, ne, lt, gt, like, and, or, desc, asc, sql, count } from 'drizzle-orm'
import { sqliteTable, text, integer, real, blob, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { defineConfig } from 'drizzle-kit'

// Password hashing
import bcrypt from 'bcryptjs'  // OR use Bun's built-in:
const hash = await Bun.password.hash('password', 'bcrypt')
const valid = await Bun.password.verify('password', hash)
```

### Bun Built-in Password Hashing (No Dependencies!)

Bun has built-in password hashing — no need for `bcryptjs`:

```typescript
// Hash
const hash = await Bun.password.hash('mypassword', {
  algorithm: 'bcrypt',
  cost: 12,
})

// Verify
const isValid = await Bun.password.verify('mypassword', hash)
```

Supports `bcrypt`, `argon2id`, and `argon2d` algorithms.

---

## Sources

- Hono + Bun: https://hono.dev/docs/getting-started/bun
- Bun + Hono guide: https://bun.com/docs/guides/ecosystem/hono
- Drizzle + bun:sqlite: https://orm.drizzle.team/docs/connect-bun-sqlite
- Drizzle + Bun getting started: https://orm.drizzle.team/docs/get-started/bun-sqlite-new
- Bun + Drizzle guide: https://bun.com/docs/guides/ecosystem/drizzle
- Drizzle config file: https://orm.drizzle.team/docs/drizzle-config-file
- Bun workspaces: https://bun.com/docs/pm/workspaces
- Bun watch/hot mode: https://bun.com/docs/runtime/watch-mode
- shadcn/ui Vite setup: https://ui.shadcn.com/docs/installation/vite
- shadcn/ui components: https://ui.shadcn.com/docs/components
- shadcn/ui React Router: https://ui.shadcn.com/docs/installation/react-router
- Bun password hashing: https://bun.sh/docs/api/hashing
