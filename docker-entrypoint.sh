#!/bin/sh
# Sway entrypoint: apply pending Prisma migrations, then (idempotently)
# seed the demo workspace + users, then start the Next.js server.
# Migrations are fast when already applied (~1s); the seed is idempotent
# and only inserts what is missing. If the database is briefly
# unavailable at container start, migrate is retried a few times.
set -e

echo "[sway] applying database migrations..."
attempt=1
while [ "$attempt" -le 6 ]; do
  if npx prisma migrate deploy; then
    break
  fi
  if [ "$attempt" -eq 6 ]; then
    echo "[sway] migrations failed after 6 attempts; exiting."
    exit 1
  fi
  echo "[sway] migrate failed (attempt $attempt/6) — retrying in 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "[sway] seeding workspace (idempotent)..."
npx prisma db seed

echo "[sway] starting server..."
exec "$@"
