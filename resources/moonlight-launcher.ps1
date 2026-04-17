# Cloudgame - Moonlight Launcher
# Este script fica rodando em background e abre o Moonlight quando solicitado
## Logging (diagnostic)
$LogFile = Join-Path $env:APPDATA "Cloudgame\moonlight-launcher.log"
if (!(Test-Path (Split-Path $LogFile -Parent))) {
  New-Item -ItemType Directory -Path (Split-Path $LogFile -Parent) -Force | Out-Null
}
function LOG([string]$message) {
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "$ts - $message"
}
LOG "Moonlight Launcher script started"

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Cloudgame Moonlight Launcher started" -ForegroundColor Green
Write-Host "Aguardando comandos na porta 47999..."

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:47999/")
$listener.Start()

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $hostIp = $request.QueryString["host"]
    $appName = $request.QueryString["app"]
    
    if ($hostIp -and $appName) {
        Write-Host "Recebido: host=$hostIp app=$appName" -ForegroundColor Cyan
        
        # Abrir Moonlight com protocolo
        # Use the raw app name without brackets to form a valid Moonlight URL
        $url = "moonlight://connect?host=$hostIp&app=$appName"
        Start-Process $url
        
        $content = "OK - Moonlight aberto"
    } else {
        $content = "Aguardando..."
    }
    
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()
}

$listener.Stop()
