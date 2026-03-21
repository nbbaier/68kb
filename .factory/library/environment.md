# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Required Environment Variables

- `SESSION_SECRET` — Session encryption key (min 32 characters).

## Optional Environment Variables

- `PORT` — API server port (default: `3100`)
- `CLIENT_ORIGIN` — CORS origin for `/api/*` (default: `http://localhost:3101`)
- `DB_FILE_NAME` — SQLite file path (default: `app/data/68kb.db`)
- `UPLOADS_DIR` — Article/category upload storage root (default: `app/uploads`)
- `CONTENT_IMAGE_DIR` — Image manager storage root (default: `upload/images/uploads`, resolved from workspace)
- `CONTENT_IMAGE_PUBLIC_BASE` — Public URL base for image manager files (default: `/uploads/images/uploads`)
- `THEMES_DIR` — Theme directory root (default: resolved `upload/themes`)
- `ADDONS_DIR` — Module/addon directory root (default: resolved `upload/system/68kb/third_party`)
- `CACHE_DIR` — Comma-separated cache directories for utility cache clearing (default: resolved `upload/system/68kb/cache` candidates)

## Bun-Specific Notes

- Bun 1.3.10 installed at `/Users/nbbaier/.bun/bin/bun`
- For TypeScript typings in Bun projects, use `bun-types` (not `@types/bun`)
- `bun:sqlite` is built-in — no need for `better-sqlite3`
- `Bun.password` is built-in — no need for `bcryptjs`
- `bun --hot` swaps fetch handler without restart (use for dev server)
- Vite dev server still uses Node.js internally even when bun is the package manager
- `bun test` uses `bun:test` runner (not vitest for server tests)

## Machine Specs

- macOS, 16GB RAM, 8 CPUs
- Node.js 25.8.1 (used by Vite internally)
