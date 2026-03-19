# User Testing

Testing surface, tools, and resource cost classification for validators.

---

## Validation Surface

- **Primary surface**: Web browser (React SPA at http://localhost:3101)
- **Tool**: agent-browser (installed at `/Users/nbbaier/.factory/bin/agent-browser`)
- **API testing**: curl against http://localhost:3100/api/*
- **DB verification**: bun:sqlite CLI or Drizzle queries

## Setup Requirements

1. Start API server on port 3100 (see services.yaml)
2. Start Vite dev server on port 3101 (see services.yaml)
3. Run migrations and seed data
4. Ensure SESSION_SECRET is set

## Validation Concurrency

- **Max concurrent validators**: 3
- **Rationale**: 16GB RAM, 8 CPUs. Each agent-browser ~200MB. API server ~100MB, Vite ~200MB. At 3 concurrent: ~900MB total. Well within 70% of ~8GB available headroom.
- Load average baseline: ~3.9 on 8 cores

## Dry Run Results

- agent-browser functional (confirmed March 2026)
- Ports 3100/3101 available
- No blockers identified

## Flow Validator Guidance: web

- Use the shared running app at `http://localhost:3101` (API at `http://localhost:3100`).
- Do **not** restart/stop services from subagents; treat servers as shared infrastructure.
- Use unique test accounts per flow group (prefix usernames/emails with your group id) to avoid collisions.
- Do not delete/modify the seeded admin account (`admin`) in destructive ways.
- Prefer validating behavior through the browser UI; use API/DB checks only as supporting evidence for assertions that require it.
- Keep all screenshots/logs/notes under the assigned evidence directory only.

## Tooling Notes

- `agent-browser` network request exports may omit response status/body details for some fetch/XHR entries.
- For assertions that require explicit status codes, headers, or response payload verification, capture supplemental `curl` evidence.
- Sonner toasts can disappear quickly; for style-sensitive flash assertions, capture evidence immediately after trigger and record computed styles via in-page evaluation.
- Browser numeric inputs (`input[type=number]`) may reject non-numeric keystrokes before submit; for “non-numeric validation” assertions, use a boundary request or temporary DOM-type swap in automation to exercise server-side validation paths.

## Public-Site Fixture Learnings (2026-03-19)

- Do **not** run glossary public and glossary admin assertion groups concurrently; glossary admin CRUD mutates glossary rows and can race glossary list/count assertions.
- `VAL-DETAIL-008` needs a fixture article body containing at least one glossary term; the seed script now includes "Introduction to Algorithms and Data Structures" which contains the terms "algorithm", "variable", and "array" in its body. Use this article for glossary tooltip validation.
- `VAL-HOME-004` and `VAL-HOME-005` require specific DB state manipulation during testing (empty categories/articles states). These cannot be validated with the standard seeded database because the seed creates categories and articles. To test these: (1) use a fresh database snapshot before seeding, or (2) temporarily delete/hide all categories and articles for the test, then restore. A separate test DB instance is recommended.
- `VAL-SEARCH-004` pagination requires visible matches strictly greater than `site_max_search` (default: 20). The seed script now creates 26 articles with the keyword "tutorial" and "programming" — searching for "tutorial" should return >20 results and trigger pagination.
- `VAL-SEARCH-008` requires an expired search hash fixture (older than 1 hour). This cannot be reliably created during real-time testing. To test: (1) manually insert a `search` table row with `search_date` set to `(current_unix_timestamp - 3700)`, then access `/search/results/{that_hash}` to verify it redirects to no-results. This requires direct DB manipulation during the test session.

## Seed Data Summary (updated 2026-03-19)

The seed script now creates:
- **Categories**: 8 categories in a 3-level hierarchy (PHP → PHP OOP → Design Patterns; PHP → PHP Basics; JavaScript → JS Frameworks → React; Python). All visible — validates search dropdown includes grandchild categories (VAL-SEARCH-001).
- **Glossary**: 10 terms (algorithm, API, cache, database, function, variable, loop, array, object, class).
- **Articles**: 26 articles total. The "Introduction to Algorithms and Data Structures" article contains glossary terms in its body for VAL-DETAIL-008 tooltip testing. The remaining 25 articles all have "tutorial" keyword for search pagination testing (VAL-SEARCH-004).
- **Tags**: Articles share "tutorial" and category-specific tags, enabling related articles (VAL-TAG-003).
