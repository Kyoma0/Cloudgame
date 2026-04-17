@echo off
REM Cloudgame Auto Setup Script
REM Inicia automaticamente o Moonlight Web Server

echo ========================================
echo   Cloudgame - Auto Setup
echo ========================================
echo.

REM Definir caminhos
set "RESOURCES_DIR=%~dp0"
set "MOONLIGHT_WEB=%RESOURCES_DIR%moonlight-web-server.exe"
set "CONFIG_DIR=%APPDATA%\Cloudgame"

REM Criar diretórios se não existirem
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

REM Verificar Moonlight Web
if not exist "%MOONLIGHT_WEB%" (
    echo [ERRO] Moonlight Web Server não encontrado!
    echo Procure em: %MOONLIGHT_WEB%
    pause
    exit /b 1
)

REM Criar config padrão se não existir
if not exist "%CONFIG_DIR%\config.json" (
    echo [INFO] Criando config padrão...
    (
        echo {
        echo   "web_server": {
        echo     "bind_address": "0.0.0.0:8080"
        echo   },
        echo   "webrtc": {
        echo     "ice_servers": [
        echo       {"urls": ["stun:stun.l.google.com:19302"]}
        echo     ]
        echo   }
        echo }
    ) > "%CONFIG_DIR%\config.json"
)

REM Copiar arquivos static para config dir
if not exist "%CONFIG_DIR%\static" (
    echo [INFO] Copiando arquivos web...
    xcopy /E /Y "%RESOURCES_DIR%static\*" "%CONFIG_DIR%\static\" >nul
)

echo [OK] Iniciando Moonlight Web Server...
echo [OK] Acesse http://localhost:8080 no navegador
echo.

REM Iniciar Moonlight Web em background
start "" "%MOONLIGHT_WEB%" --config "%CONFIG_DIR%\config.json"

echo [OK] Servidor iniciado!
timeout /t 2 /nobreak >nul

REM Abrir navegador padrão
start http://localhost:8080

exit /b 0