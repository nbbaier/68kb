#!/bin/bash
set -e

APP_DIR="/Users/nbbaier/68kb/app"

if [ ! -d "$APP_DIR" ]; then
  echo "App directory does not exist yet — scaffolding feature has not run."
  exit 0
fi

cd "$APP_DIR"

# Install dependencies (idempotent)
if [ -f "package.json" ]; then
  bun install --frozen-lockfile 2>/dev/null || bun install
fi

# Create data directory if needed
mkdir -p data uploads

# NOTE: Workers should ensure a .env file exists with a session encryption key.
# The server app reads it from the environment at startup.

echo "Init complete. App dir: $APP_DIR"
