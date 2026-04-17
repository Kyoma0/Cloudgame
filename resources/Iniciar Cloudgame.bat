@echo off
REM Cloudgame - Iniciar Tudo
REM Este script inicia o frontend + Moonlight Web Server + Moonlight Launcher

echo ========================================
echo   Cloudgame - Iniciando...
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"

REM 1. Iniciar Moonlight Web Server em background
echo [1/3] Iniciando Moonlight Web Server...
start /B "" "%SCRIPT_DIR%moonlight-web-server.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo   OK

REM 2. Iniciar Moonlight Launcher em background
echo [2/3] Iniciando Moonlight Launcher...
start /B "" powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%moonlight-launcher.ps1" >nul 2>&1
timeout /t 1 /nobreak >nul
echo   OK

REM 3. Abrir navegador com frontend
echo [3/3] Iniciando Frontend...
echo.
echo ========================================
echo   Cloudgame iniciado!
echo ========================================
echo.
echo   Acesse:
echo   - Frontend: http://localhost:3000
echo   - Moonlight Web: http://localhost:8080
echo.
echo   Clique em PLAY para abrir o Moonlight Desktop!
echo.

REM Abrir frontend no navegador padrao
start http://localhost:3000

echo Pressione qualquer tecla para sair (nao para os servicos)...
pause >nul