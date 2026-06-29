# Aplica migrations e cria admin no Supabase.
# Antes: edite backend/.env e defina DATABASE_URL com a senha do Postgres.
# Supabase > Project Settings > Database > Connection string (URI)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$Backend = Join-Path $PSScriptRoot "..\backend"
Set-Location $Backend

if (-not (Test-Path ".env")) {
  Write-Host "Copie backend/.env.example para backend/.env e configure DATABASE_URL" -ForegroundColor Red
  exit 1
}

Write-Host "Gerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate

Write-Host "Aplicando migrations no Supabase..." -ForegroundColor Cyan
npx prisma migrate deploy

Write-Host "Criando admin (ADMIN_EMAIL / ADMIN_PASSWORD do .env)..." -ForegroundColor Cyan
npm run seed

Write-Host "Pronto!" -ForegroundColor Green
