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
