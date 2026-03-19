# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Required Environment Variables

- `SESSION_SECRET` — Session encryption key (min 32 characters). For development, init.sh sets a default.
- `PORT` — API server port (default: 3100)
- `UPLOADS_DIR` — Optional override for article attachment storage directory. Defaults to `app/uploads` when unset.

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
