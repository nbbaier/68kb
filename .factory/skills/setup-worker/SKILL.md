---
name: setup-worker
description: Scaffolds the project monorepo, installs dependencies, and creates foundational configuration files.
---

# Setup Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for project scaffolding features: creating directory structures, package.json files, TypeScript configs, Vite configs, Drizzle configs, initial database schema/migrations, seed scripts, and base application entry points.

## Work Procedure

1. **Read the feature description** carefully. Understand every precondition and expected behavior.

2. **Read reference materials** in `.factory/library/` and `.factory/research/` — especially `HONO_DRIZZLE_REFERENCE.md` and `BUN_SHADCN_REFERENCE.md` for correct package versions, import paths, and configuration patterns.

3. **Plan the directory structure** before creating any files. List every file you will create.

4. **Create the project structure:**
   - Root package.json with bun workspaces
   - Server app (apps/server): package.json, tsconfig.json, drizzle.config.ts, src/ structure
   - Client app (apps/client): package.json, tsconfig.json, vite.config.ts, index.html, src/ structure
   - Shared configs (tsconfig.base.json)
   - Data directory, uploads directory

5. **Install dependencies** using `bun install` from the project root.

6. **Write tests first** for any logic (e.g., migration runner, seed script, DB connection). Run them to verify they fail, then implement.

7. **Initialize shadcn/ui** in the client app using `bunx shadcn@latest init` (non-interactive flags if available) or by manually creating the required config files.

8. **Verify the setup:**
   - `bun run --filter @68kb/server dev` starts without errors
   - `bun run --filter @68kb/client dev` starts Vite without errors
   - TypeScript compiles: `bunx tsc --noEmit` in both workspaces
   - Tests pass: `bun test` in both workspaces
   - Database file is created and migrations run successfully

9. **Run all verification steps** from the feature description.

## Example Handoff

```json
{
  "salientSummary": "Scaffolded Bun workspaces monorepo with Hono server (port 3100) and Vite React client (port 3101). Installed all deps, configured Drizzle with bun:sqlite, created 17-table schema with migrations, seeded 5 user groups + default settings + admin user. Both dev servers start, typecheck passes, 12 tests pass.",
  "whatWasImplemented": "Complete monorepo structure at /app with apps/server (Hono + Drizzle + bun:sqlite + hono-sessions) and apps/client (Vite + React + shadcn/ui + Tailwind v4). Database schema covers all 17+ tables from the original PHP app. Seed script creates admin user (group 1), 5 default groups, and 14 site settings. Health endpoint at GET /api/health.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd /Users/nbbaier/68kb/app && bun install", "exitCode": 0, "observation": "All dependencies installed, bun.lock created" },
      { "command": "cd /Users/nbbaier/68kb/app && bun run --filter @68kb/server db:migrate", "exitCode": 0, "observation": "17 tables created in data/68kb.db" },
      { "command": "cd /Users/nbbaier/68kb/app && bun run --filter @68kb/server db:seed", "exitCode": 0, "observation": "5 groups, 14 settings, 1 admin user seeded" },
      { "command": "cd /Users/nbbaier/68kb/app && bun test", "exitCode": 0, "observation": "12 tests passed across both workspaces" },
      { "command": "cd /Users/nbbaier/68kb/app && bunx tsc --noEmit -p apps/server/tsconfig.json", "exitCode": 0, "observation": "No type errors" },
      { "command": "curl http://localhost:3100/api/health", "exitCode": 0, "observation": "200 {\"status\":\"ok\"}" }
    ],
    "interactiveChecks": [
      { "action": "Started both dev servers with bun run dev", "observed": "Server on 3100, Vite on 3101, both running" },
      { "action": "Opened http://localhost:3101 in browser", "observed": "React app shell renders with shadcn styling" }
    ]
  },
  "tests": {
    "added": [
      { "file": "apps/server/src/db/__tests__/schema.test.ts", "cases": [
        { "name": "creates all tables", "verifies": "Migration creates 17+ tables" },
        { "name": "seeds default data", "verifies": "5 groups, settings, admin user exist" }
      ]},
      { "file": "apps/server/src/__tests__/health.test.ts", "cases": [
        { "name": "GET /api/health returns 200", "verifies": "Health endpoint works" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A required dependency fails to install (native compilation issues with bun)
- shadcn/ui init fails and cannot be resolved
- Port 3100 or 3101 is already in use and cannot be freed
- The feature description is missing critical information about the expected schema or configuration
