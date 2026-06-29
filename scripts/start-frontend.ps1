# Inicia o painel admin (frontend) em http://localhost:5173
# Requer Node.js instalado: https://nodejs.org

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path "node_modules")) {
  Write-Host "Instalando dependencias do frontend..." -ForegroundColor Yellow
  npm install
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Arquivo .env criado." -ForegroundColor Green
}

Write-Host ""
Write-Host "Frontend: http://localhost:5173/admin/login" -ForegroundColor Cyan
Write-Host "API (backend): http://localhost:3000 — precisa estar rodando para login funcionar" -ForegroundColor Yellow
Write-Host "  -> cd backend && docker compose up -d  (com Docker)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host ""

npm run dev -- --host 127.0.0.1 --port 5173
