# 68kb TypeScript Port

68kb has been ported from PHP/CodeIgniter to a TypeScript stack:

- API: Hono + Drizzle ORM + SQLite (`bun:sqlite`)
- Web: React + Vite + TypeScript
- Runtime/package manager: Bun

Current mission status: `341/341` validation assertions passed, `5/5` milestones sealed.

## Active App

The active application is under [`app/`](app):

- [`app/apps/server`](app/apps/server): Hono API (default `http://localhost:3100`)
- [`app/apps/client`](app/apps/client): React app (default `http://localhost:3101`)
- SQLite DB default: `app/data/68kb.db`

## Quick Start

Requirements:

- Bun `1.3+`

Install and run:

```bash
cd app
bun install

# Required (32+ chars)
export SESSION_SECRET='replace-with-at-least-32-characters'

bun run db:migrate
bun run db:seed
bun run dev
```

Open:

- Web UI: `http://localhost:3101`
- API health: `http://localhost:3100/api/health`

Default seeded admin credentials:

- Username: `admin`
- Password: `admin123`

## Useful Commands

From `app/`:

- `bun run dev`: start server + client
- `bun run test`: run server and client tests
- `bun run typecheck`: typecheck server and client
- `bun run build`: build client + server type build
- `bun run db:migrate`: run Drizzle migrations
- `bun run db:seed`: seed baseline data

## Environment Variables

Common server env vars:

- `SESSION_SECRET` (required, minimum 32 chars)
- `PORT` (default `3100`)
- `CLIENT_ORIGIN` (default `http://localhost:3101`)
- `DB_FILE_NAME` (default `app/data/68kb.db`)
- `UPLOADS_DIR` (default `app/uploads`)

Additional feature-specific overrides are documented in [`PORT_STATUS.md`](PORT_STATUS.md) and `.factory/library/environment.md`.

## Repository Notes

- [`upload/`](upload) and [`do_not_upload/`](do_not_upload) contain legacy PHP-era material/reference assets.
- Port progress, validation model, and mission tracking details are in [`PORT_STATUS.md`](PORT_STATUS.md).
