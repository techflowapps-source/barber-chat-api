# Inicia a API NestJS em http://localhost:3000
# Requer: Node.js, Redis acessível e DATABASE_URL válido no backend/.env

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$Backend = Join-Path $PSScriptRoot "..\backend"
Set-Location $Backend

if (-not (Test-Path ".env")) {
  Write-Host "Crie backend/.env a partir de backend/.env.example" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "API: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host "Docs: http://localhost:3000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Requisitos no .env:" -ForegroundColor Yellow
Write-Host "  - DATABASE_URL (Supabase Session pooler se direct falhar)" -ForegroundColor DarkGray
Write-Host "  - REDIS_HOST / REDIS_PORT (Upstash ou Redis local)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host ""

npm run start:dev
