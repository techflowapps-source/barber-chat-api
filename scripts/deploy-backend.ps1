# Deploy do backend NestJS (WhatsApp + filas Redis)
# Requer: conta Render (https://render.com) ou Railway (https://railway.app)
#         Redis Upstash grátis (https://console.upstash.com)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "=== Deploy Backend Barbearia WhatsApp ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1) Crie Redis gratuito no Upstash:" -ForegroundColor Yellow
Write-Host "   https://console.upstash.com/redis -> Create Database -> regiao us-east-1"
Write-Host "   Copie a URL: rediss://default:...@....upstash.io:6379"
Write-Host ""

Write-Host "2) Deploy no Render (recomendado):" -ForegroundColor Yellow
Write-Host "   a) Suba o projeto no GitHub"
Write-Host "   b) Render Dashboard -> New -> Blueprint"
Write-Host "   c) Selecione o repo e use render.yaml na raiz"
Write-Host "   d) Preencha variaveis secretas:"
Write-Host "      DATABASE_URL = (copie do Supabase Dashboard)"
Write-Host "      REDIS_URL    = (URL Upstash rediss://...)"
Write-Host "      JWT_SECRET   = dev-access-secret-change-in-production"
Write-Host "      JWT_REFRESH_SECRET = dev-refresh-secret-change-in-production"
Write-Host ""

Write-Host "3) Apos o deploy, copie a URL do servico (ex: https://barbershop-whatsapp-api.onrender.com)"
Write-Host "   Configure na Vercel:" -ForegroundColor Yellow
Write-Host "   WHATSAPP_API_URL = https://SUA-URL.onrender.com/api"
Write-Host ""

$useRailway = Read-Host "Tentar deploy via Railway CLI agora? (s/N)"
if ($useRailway -eq "s" -or $useRailway -eq "S") {
  Set-Location $Root
  npx @railway/cli login
  npx @railway/cli init --name barbershop-whatsapp-api
  npx @railway/cli up --service barbershop-whatsapp-api
}

Write-Host ""
Write-Host "Pronto! Veja backend/.env.production.example para todas as variaveis." -ForegroundColor Green
