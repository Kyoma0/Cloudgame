# Cloudgame - Moonlight Web Server Launcher
# Execute este script como Administrador se necessario

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cloudgame - Moonlight Web Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MoonlightExe = Join-Path $ScriptDir "moonlight-web-server.exe"
$StaticDir = Join-Path $ScriptDir "static"
$ConfigDir = "$env:APPDATA\Cloudgame"
$ConfigFile = Join-Path $ConfigDir "config.json"

# Criar diretorios
if (!(Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Host "[INFO] Diretorio de config criado: $ConfigDir" -ForegroundColor Yellow
}

# Copiar config se necessario
if (!(Test-Path $ConfigFile)) {
    $DefaultConfig = @"
{
  "web_server": {
    "bind_address": "0.0.0.0:8080"
  },
  "webrtc": {
    "ice_servers": [
      {"urls": ["stun:stun.l.google.com:19302"]}
    ]
  }
}
"@
    $DefaultConfig | Out-File -FilePath $ConfigFile -Encoding UTF8
    Write-Host "[INFO] Config padrao criado" -ForegroundColor Yellow
}

# Copiar arquivos static para config dir
if (!(Test-Path (Join-Path $ConfigDir "static"))) {
    if (Test-Path $StaticDir) {
        Copy-Item -Path $StaticDir -Destination (Join-Path $ConfigDir "static") -Recurse -Force
        Write-Host "[INFO] Arquivos web copiados" -ForegroundColor Yellow
    } else {
        Write-Host "[ERRO] Pasta static nao encontrada: $StaticDir" -ForegroundColor Red
        exit 1
    }
}

# Verificar executavel
if (!(Test-Path $MoonlightExe)) {
    Write-Host "[ERRO] Moonlight Web Server nao encontrado!" -ForegroundColor Red
    Write-Host "Procure em: $MoonlightExe" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Iniciar servidor com working directory
Write-Host "[OK] Iniciando Moonlight Web Server..." -ForegroundColor Green
Write-Host "[OK] Acesse http://localhost:8080 no navegador" -ForegroundColor Green
Write-Host ""

$Process = Start-Process -FilePath $MoonlightExe -WorkingDirectory $ScriptDir -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

if ($Process.HasExited) {
    Write-Host "[ERRO] Servidor fechou (codigo: $($Process.ExitCode))" -ForegroundColor Red
    Write-Host "Verifique se os arquivos static estao em: $StaticDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Servidor esta rodando (PID: $($Process.Id))" -ForegroundColor Green
Write-Host ""

# Abrir navegador
Start-Process "http://localhost:8080"

Write-Host "Pressione qualquer tecla para parar o servidor..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Servidor parado" -ForegroundColor Green