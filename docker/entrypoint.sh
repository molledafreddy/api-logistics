#!/bin/sh
set -e

echo "[Entrypoint] Starting application initialization..."

# Run migrations
echo "[Entrypoint] Running database migrations..."
node dist/database/migrate.js

# Start the main application with unbuffered output
echo "[Entrypoint] Starting NestJS application..."
exec node --no-warnings dist/main
