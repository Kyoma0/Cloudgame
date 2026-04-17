# Cloudgame - Iniciar Tudo
# Executa: Moonlight Launcher + Frontend

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cloudgame - Iniciando..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Iniciar Moonlight Web Server
Write-Host "[1/3] Iniciando Moonlight Web Server..." -ForegroundColor Yellow
$webServer = Join-Path $ScriptDir "moonlight-web-server.exe"
$webProcess = Start-Process -FilePath $webServer -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
Write-Host "  OK - Moonlight Web Server" -ForegroundColor Green

# 2. Iniciar Moonlight Launcher (background)
Write-Host "[2/3] Iniciando Moonlight Launcher..." -ForegroundColor Yellow
$launcher = Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy", "Bypass", "-File", "`"$ScriptDir\moonlight-launcher.ps1`"" -WindowStyle Hidden -PassThru
Write-Host "  OK - Launcher na porta 47999" -ForegroundColor Green

# 3. Iniciar Frontend
Write-Host "[3/3] Iniciando Frontend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Cloudgame iniciado!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Acesse:" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  - Moonlight Web: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador com frontend
Start-Process "http://localhost:3000"

Write-Host "Pressione Ctrl+C para parar todos os servicos..." -ForegroundColor Yellow
Write-Host ""

# Aguardar Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host ""
    Write-Host "Parando servicos..." -ForegroundColor Yellow
    Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "powershell" -Force -ErrorAction SilentlyContinue
    Write-Host "Pronto!" -ForegroundColor Green
}