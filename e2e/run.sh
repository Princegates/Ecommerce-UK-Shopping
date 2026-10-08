#!/usr/bin/env bash
# Builds the shop, starts it on a throwaway database, runs the browser checks, and stops the server.
#   npm run e2e
# Needs a Chrome or Chromium. Set CHROMIUM_PATH to use one you already have, otherwise install Playwright's:
#   npx playwright-core install chromium
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-3100}"
WORK="$(mktemp -d)"
trap 'kill "${SERVER_PID:-}" "${SOCIAL_PID:-}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "Building…"
npm run build >/dev/null

echo "Starting the shop on port $PORT with a throwaway database…"
DATABASE_PATH="$WORK/e2e.db" \
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin}" \
ADMIN_SECRET="testsecret-testsecret-testsecret" \
APP_URL="http://localhost:$PORT" \
CRON_SECRET="${E2E_CRON_SECRET:-cron-secret-123456}" \
ALLOW_DEMO_PAYMENTS=true \
INGEST_AUTORUN=false \
SEED_SAMPLE_DATA=true \
PORT="$PORT" \
npx next start -p "$PORT" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

# A second shop whose APP_URL is https (the sign-in buttons only show on https). Nothing is ever sent to that address.
SOCIAL_PORT="$((PORT + 1))"
DATABASE_PATH="$WORK/social.db" \
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin}" \
ADMIN_SECRET="testsecret-testsecret-testsecret" \
APP_URL="https://shop.example.test" \
CRON_SECRET="${E2E_CRON_SECRET:-cron-secret-123456}" \
INGEST_AUTORUN=false \
SEED_SAMPLE_DATA=true \
PORT="$SOCIAL_PORT" \
npx next start -p "$SOCIAL_PORT" >"$WORK/social.log" 2>&1 &
SOCIAL_PID=$!
for _ in $(seq 1 40); do
  if curl -fs "http://localhost:$SOCIAL_PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

E2E_BASE="http://localhost:$PORT" E2E_SOCIAL_BASE="http://localhost:$SOCIAL_PORT" node e2e/e2e.mjs
