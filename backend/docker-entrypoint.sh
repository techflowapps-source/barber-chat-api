#!/bin/sh
set -e

echo "Aplicando migrations..."
npx prisma migrate deploy

echo "Iniciando API..."
exec node dist/main.js
