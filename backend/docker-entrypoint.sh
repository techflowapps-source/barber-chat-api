#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS}" = "true" ]; then
  echo "SKIP_MIGRATIONS=true — pulando migrations (schema já aplicado no Supabase)."
else
  echo "Aplicando migrations..."
  npx prisma migrate deploy
fi

echo "Iniciando API..."
exec node dist/main.js
