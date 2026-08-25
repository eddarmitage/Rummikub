#!/usr/bin/env bash
# Idempotently provisions the Cloudflare D1 database this app needs, and
# (re)generates the gitignored wrangler.toml from wrangler.toml.example.
#
# Requires `wrangler login` to already be authenticated against the target
# Cloudflare account (this script will prompt interactively if not).
#
# Safe to re-run any time — including after deleting the real D1 database
# (`wrangler d1 delete rummikub-scores-db`) to start completely from scratch.
#
# Prerequisites: jq, envsubst (part of `gettext`)
#   macOS: brew install jq gettext && brew link --force gettext
#   Debian/Ubuntu: apt-get install -y jq gettext-base

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

DB_NAME="rummikub-scores-db"
TEMPLATE="wrangler.toml.example"
OUTPUT="wrangler.toml"

for cmd in jq envsubst npx; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' is required but was not found on PATH." >&2
    exit 1
  fi
done

echo "==> Checking for existing D1 database '$DB_NAME'..."
EXISTING_ID="$(npx wrangler d1 list --json \
  | jq -r --arg name "$DB_NAME" '.[] | select(.name == $name) | .uuid' \
  | head -n1)"

if [ -n "$EXISTING_ID" ]; then
  echo "==> Found existing database '$DB_NAME' (id: $EXISTING_ID)"
  DB_ID="$EXISTING_ID"
else
  echo "==> Creating D1 database '$DB_NAME'..."
  CREATE_OUTPUT="$(npx wrangler d1 create "$DB_NAME")"
  echo "$CREATE_OUTPUT"
  DB_ID="$(echo "$CREATE_OUTPUT" | grep -o 'database_id = "[^"]*"' | sed 's/database_id = "\(.*\)"/\1/')"
  if [ -z "$DB_ID" ]; then
    echo "error: could not parse database_id from 'wrangler d1 create' output above." >&2
    exit 1
  fi
  echo "==> Created database '$DB_NAME' (id: $DB_ID)"
fi

echo "==> Generating $OUTPUT from $TEMPLATE..."
# ACCESS_TEAM_DOMAIN / ACCESS_AUD aren't provisionable via the wrangler CLI like the D1 id
# is — export them yourself before running this script if you already have them (Zero Trust
# dashboard: team domain from Settings, AUD tag from the self-hosted Access Application's
# Overview tab), otherwise they're left blank here and requireAuth() falls back to rejecting
# every request until you fill them in on the generated wrangler.toml (see README "Auth
# setup").
D1_DATABASE_ID="$DB_ID" \
ACCESS_TEAM_DOMAIN="${ACCESS_TEAM_DOMAIN:-}" \
ACCESS_AUD="${ACCESS_AUD:-}" \
envsubst < "$TEMPLATE" > "$OUTPUT"

if [ -z "${ACCESS_TEAM_DOMAIN:-}" ] || [ -z "${ACCESS_AUD:-}" ]; then
  echo "==> Note: ACCESS_TEAM_DOMAIN and/or ACCESS_AUD weren't set — '$OUTPUT' has blank"
  echo "    placeholders for them. Fill those in once you've set up the self-hosted Access"
  echo "    Application (README 'Auth setup'); writes will 401 until you do."
fi

echo "==> Applying migrations (local, for 'wrangler dev' / Miniflare)..."
npx wrangler d1 migrations apply "$DB_NAME" --local

echo "==> Applying migrations (remote, for the real Cloudflare D1 database)..."
npx wrangler d1 migrations apply "$DB_NAME" --remote

echo "==> Regenerating worker-configuration.d.ts..."
npm run cf-typegen

echo "==> Done. '$OUTPUT' is gitignored — re-run this script any time to regenerate it."
