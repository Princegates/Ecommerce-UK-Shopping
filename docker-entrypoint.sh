#!/bin/sh
# Hosts such as Render mount the persistent disk owned by root. Make it writable for the app user, then drop root.
set -e
mkdir -p "$(dirname "${DATABASE_PATH:-/data/shop.db}")"
chown -R 10001:10001 "$(dirname "${DATABASE_PATH:-/data/shop.db}")" 2>/dev/null || true
exec setpriv --reuid=10001 --regid=10001 --clear-groups "$@"
