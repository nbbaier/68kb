# Architecture

Architectural decisions and patterns for the 68kb TypeScript port.

**What belongs here:** Tech stack decisions, directory structure, data flow patterns, naming conventions.

---

## Stack

- **Runtime**: Bun 1.3.10
- **Backend**: Hono (native Bun support, no adapter needed)
- **ORM**: Drizzle ORM with `bun:sqlite` driver
- **Database**: SQLite (file: `app/data/68kb.db`)
- **Frontend**: React 19 + Vite 7 + TypeScript
- **UI Library**: shadcn/ui + Tailwind CSS v4
- **Auth**: Cookie-based sessions via hono-sessions CookieStore
- **Password hashing**: Bun.password built-in (bcrypt, cost 12)

## Project Structure

```
app/
├── package.json              # Bun workspaces root
├── apps/
│   ├── server/               # Hono API
│   │   ├── src/
│   │   │   ├── index.ts      # Entry (export default { port, fetch })
│   │   │   ├── app.ts        # Hono app with middleware
│   │   │   ├── db/
│   │   │   │   ├── schema.ts # All Drizzle table definitions
│   │   │   │   ├── index.ts  # DB connection
│   │   │   │   ├── migrate.ts
│   │   │   │   └── seed.ts
│   │   │   ├── routes/       # API route files
│   │   │   └── middleware/   # Auth guard, etc.
│   │   └── drizzle/          # Generated migrations
│   └── client/               # React SPA
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx       # Router setup
│       │   ├── pages/        # Page components
│       │   ├── components/   # Shared components
│       │   │   └── ui/       # shadcn components
│       │   ├── hooks/
│       │   └── lib/          # Utilities
│       └── index.html
├── data/                     # SQLite database
└── uploads/                  # User uploads
```

## Testing Patterns

- **Session cookies in tests**: hono-sessions CookieStore sets the cookie TWICE per request (empty + persisted). Use `response.headers.getSetCookie()` (returns array) and take the last element. See `auth.test.ts` `loginAsAdmin()` helper.
- **Test isolation**: Auth tests use a factory pattern (`createApp`/`createAuthRoutes`) with in-memory SQLite DB for full isolation.

## API Patterns

- Public routes: `/api/auth/*`, `/api/articles/*`, `/api/categories/*`, `/api/search/*`
- Admin routes: `/api/admin/articles/*`, `/api/admin/categories/*`, `/api/admin/users/*`, etc.
- Admin routes use `requireAuth` middleware that checks session + `can_access_admin` permission
- Pagination: `?page=1&limit=20&sort=field&order=asc&search=term`
- Responses: `{ data: T }` or `{ data: T[], total: number, page: number }` for lists
