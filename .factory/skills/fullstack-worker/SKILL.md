---
name: fullstack-worker
description: Implements full-stack features spanning Hono API endpoints, Drizzle queries, and React UI components with shadcn/ui.
---

# Full-Stack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that require both backend API work (Hono routes, Drizzle queries, middleware) and frontend UI work (React components, pages, forms with shadcn/ui). This covers the majority of features in the 68kb port.

## Work Procedure

1. **Read the feature description** carefully — every precondition, expected behavior, and verification step.

2. **Read reference materials:**
   - `.factory/library/` for architecture patterns, environment info, and conventions
   - `.factory/research/` for Hono, Drizzle, shadcn/ui reference docs (import paths, API patterns)
   - Existing code in `app/apps/server/src/` and `app/apps/client/src/` to understand patterns already established

3. **Plan your implementation** before writing code:
   - What API endpoints are needed? (method, path, request/response shapes)
   - What DB queries? (which tables, joins, filters)
   - What React components/pages? (which shadcn components to use)
   - What tests will you write?

4. **Write API tests first (red):**
   - Create test file(s) in `apps/server/src/__tests__/` or co-located
   - Test each endpoint: success cases, validation errors, auth requirements, edge cases
   - Use Hono's built-in test client: `app.request('/api/...', { method: 'POST', ... })`
   - Run tests — they should fail (red phase)

5. **Implement API endpoints (green):**
   - Create route file in `apps/server/src/routes/`
   - Implement Drizzle queries
   - Register routes in the app
   - Run tests — they should pass (green phase)
   - Use Zod for request body validation where applicable

6. **Write UI component tests (red):**
   - Use Vitest + React Testing Library
   - Test rendering, user interactions, form validation, API integration
   - Run tests — fail first

7. **Implement React UI (green):**
   - Use shadcn/ui components (Button, Input, Form, DataTable, Dialog, etc.)
   - Add shadcn components if not yet installed: `bunx shadcn@latest add <component>`
   - Create pages/components in `apps/client/src/`
   - Wire up to API endpoints using fetch
   - Run tests — pass

8. **Manual verification with agent-browser:**
   - Start both dev servers
   - Use agent-browser to navigate to the feature's pages
   - Test every user interaction described in the feature
   - Verify visual rendering, form submissions, error states
   - Each flow tested = one `interactiveChecks` entry

9. **Run full verification:**
   - `bun test` (all tests pass)
   - `bunx tsc --noEmit` in both workspaces (no type errors)
   - Check for console errors in the browser

10. **Quick sanity check adjacent features** — verify nothing broke in nearby functionality (e.g., if you added article CRUD, verify the dashboard still loads).

## Key Conventions

- **API routes**: `/api/{resource}` for public, `/api/admin/{resource}` for admin
- **Auth guard**: Use the `requireAuth` middleware on admin routes
- **Drizzle patterns**: Use relational queries (`db.query.*`) for reads with relations, standard queries for writes
- **shadcn/ui**: Use existing installed components first. Only `bunx shadcn@latest add` new ones when needed.
- **Forms**: Use react-hook-form + zod for validation
- **Data tables**: Use @tanstack/react-table with shadcn Table component
- **Rich text editor**: Use a React WYSIWYG library (e.g., tiptap or similar) — check what's already installed
- **File uploads**: Use Hono's `c.req.parseBody()` for multipart, store in `app/uploads/`
- **Error handling**: Return JSON `{ error: string }` with appropriate status codes
- **Flash messages**: Use a client-side toast system (shadcn Sonner)

## Example Handoff

```json
{
  "salientSummary": "Implemented articles CRUD API (GET/POST/PUT/DELETE /api/admin/articles) with Drizzle queries for articles, article2cat, article_tags, and attachments tables. Built admin articles grid page with shadcn DataTable (server-side search/sort/paginate) and article form with tiptap WYSIWYG editor, category checkboxes, and file attachment upload. 18 API tests pass, 8 component tests pass, typecheck clean.",
  "whatWasImplemented": "API: GET /api/admin/articles (list with pagination/search/sort), GET /api/admin/articles/:id, POST /api/admin/articles (create with categories/tags/attachment), PUT /api/admin/articles/:id (update), DELETE /api/admin/articles/:id (cascade delete associations + files). UI: ArticlesGrid page with DataTable, ArticleForm with WYSIWYG, category tree checkboxes, attachment upload/list/delete. Routes wired in React Router under /admin/articles/*.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd /Users/nbbaier/68kb/app && bun test", "exitCode": 0, "observation": "26 tests passed (18 API + 8 component)" },
      { "command": "cd /Users/nbbaier/68kb/app && bunx tsc --noEmit -p apps/server/tsconfig.json", "exitCode": 0, "observation": "No type errors" },
      { "command": "cd /Users/nbbaier/68kb/app && bunx tsc --noEmit -p apps/client/tsconfig.json", "exitCode": 0, "observation": "No type errors" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to /admin/articles as admin", "observed": "DataTable renders with 3 seeded articles, columns: Title, Categories, Date, Display" },
      { "action": "Clicked Add Article, filled all fields, submitted", "observed": "Article created, redirected to grid, flash message shown" },
      { "action": "Searched for 'test' in grid", "observed": "Grid filtered to matching articles" },
      { "action": "Clicked edit on article, changed title, saved", "observed": "Title updated, modified date changed" },
      { "action": "Uploaded file attachment on article", "observed": "File listed in attachments table with title, type, size" },
      { "action": "Deleted attachment", "observed": "Removed from list and filesystem" },
      { "action": "Deleted article", "observed": "Removed from grid, DB cascade cleaned associations" }
    ]
  },
  "tests": {
    "added": [
      { "file": "apps/server/src/__tests__/articles.test.ts", "cases": [
        { "name": "GET /api/admin/articles returns paginated list", "verifies": "List endpoint with pagination" },
        { "name": "POST /api/admin/articles creates article", "verifies": "Create with all fields" },
        { "name": "POST /api/admin/articles validates title required", "verifies": "Validation" },
        { "name": "PUT /api/admin/articles/:id updates article", "verifies": "Update" },
        { "name": "DELETE /api/admin/articles/:id cascades", "verifies": "Delete with cleanup" }
      ]},
      { "file": "apps/client/src/__tests__/ArticlesGrid.test.tsx", "cases": [
        { "name": "renders grid with article data", "verifies": "Grid rendering" },
        { "name": "search filters results", "verifies": "Search functionality" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on an API endpoint or schema that doesn't exist yet
- Requirements are ambiguous (e.g., unclear which fields are required)
- Existing bugs in other features affect this one
- A shadcn/ui component or library is not available/compatible
- Tests from other features start failing after your changes
