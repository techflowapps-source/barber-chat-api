# Deploy completo — backend WhatsApp + painel Vercel
# Execute apos criar Redis no Upstash e servico no Render.

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DEPLOY BARBEARIA WHATSAPP - PRODUCAO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Passo 1: Upstash Redis ---
Write-Host "[1/4] Redis Upstash (gratis)" -ForegroundColor Yellow
Write-Host "  1. Abra https://console.upstash.com/redis"
Write-Host "  2. Create Database -> Region: us-east-1 (ou sa-east-1)"
Write-Host "  3. Copie a URL Redis (rediss://default:...@....upstash.io:6379)"
Write-Host ""
$redisUrl = Read-Host "Cole REDIS_URL aqui (ou Enter para pular)"

# --- Passo 2: URL Render ---
Write-Host ""
Write-Host "[2/4] Backend no Render" -ForegroundColor Yellow
Write-Host "  1. Suba o projeto no GitHub (git init + push)"
Write-Host "  2. https://dashboard.render.com -> New -> Blueprint"
Write-Host "  3. Selecione o repo (render.yaml na raiz)"
Write-Host "  4. Preencha secrets:"
Write-Host "     DATABASE_URL = (copie do Supabase Dashboard)"
if ($redisUrl) { Write-Host "     REDIS_URL    = $redisUrl" }
Write-Host "     JWT_SECRET   = dev-access-secret-change-in-production"
Write-Host "     JWT_REFRESH_SECRET = dev-refresh-secret-change-in-production"
Write-Host ""
$renderUrl = Read-Host "Cole a URL do Render (ex: https://barbershop-whatsapp-api.onrender.com)"

if ($renderUrl) {
  $apiBase = $renderUrl.TrimEnd("/")
  if (-not $apiBase.EndsWith("/api")) { $apiBase = "$apiBase/api" }

  Write-Host ""
  Write-Host "[3/4] Configurando Vercel WHATSAPP_API_URL..." -ForegroundColor Yellow
  $whatsappApi = $apiBase
  npx vercel env rm WHATSAPP_API_URL production --yes --cwd $Root 2>$null
  $whatsappApi | npx vercel env add WHATSAPP_API_URL production --cwd $Root
}

Write-Host ""
Write-Host "[4/4] Deploy frontend Vercel..." -ForegroundColor Yellow
npx vercel deploy --prod --yes --cwd $Root

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " CONCLUIDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Painel: https://barber-chat-api-main.vercel.app/admin/login"
Write-Host "Login:  barbershoppaiva@gmail.com / Paiva@2026DL"
Write-Host ""
Write-Host "Apos conectar WhatsApp no painel, clientes receberao mensagens reais."
Write-Host ""
