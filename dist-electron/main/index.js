"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const electron_log_1 = __importDefault(require("electron-log"));
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'debug';
electron_log_1.default.info('Cloudgame Client starting...');
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let moonlightWebProcess = null;
process.on('uncaughtException', (error) => {
    electron_log_1.default.error('Uncaught Exception:', error);
    electron_1.app.exit(1);
});
process.on('unhandledRejection', (reason) => {
    electron_log_1.default.error('Unhandled Rejection:', reason);
});
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false,
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        electron_log_1.default.info('Main window shown');
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function getResourcePath(filename) {
    if (isDev) {
        return path_1.default.join(__dirname, '../../resources', filename);
    }
    return path_1.default.join(process.resourcesPath, filename);
}
async function checkTailscale() {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('where tailscale', (err) => {
            resolve(!err);
        });
    });
}
async function installTailscaleMSI(authKey) {
    electron_log_1.default.info('Installing Tailscale...');
    const msiPath = getResourcePath('tailscale-setup.msi');
    if (!fs_1.default.existsSync(msiPath)) {
        electron_log_1.default.error('Tailscale MSI not found:', msiPath);
        return false;
    }
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)('msiexec.exe', [
            '/i', msiPath,
            '/qn',
            '/norestart'
        ], { detached: true, stdio: 'ignore' });
        proc.on('close', (code) => {
            if (code === 0) {
                electron_log_1.default.info('Tailscale installed, connecting...');
                const up = (0, child_process_1.spawn)('tailscale', ['up', '--authkey', authKey, '--accept-routes'], {
                    detached: true,
                    stdio: 'ignore'
                });
                up.unref();
                setTimeout(() => resolve(true), 3000);
            }
            else {
                electron_log_1.default.error('Tailscale install failed, code:', code);
                resolve(false);
            }
        });
    });
}
async function getTailscaleIP() {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('tailscale ip -4', (err, stdout) => {
            if (err) {
                resolve(null);
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
}
async function checkMoonlight() {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('where Moonlight.exe', (err) => {
            resolve(!err);
        });
    });
}
// Resolve Moonlight executable path with sensible fallbacks
function getMoonlightExePath() {
    // 1) Environment override (user-defined path)
    const envPath = process.env.MOONLIGHT_PATH;
    if (envPath && fs_1.default.existsSync(envPath))
        return envPath;
    // 2) Common Windows install locations
    const candidates = [
        'C:\\Program Files\\Moonlight Game Streaming\\Moonlight.exe',
        'C:\\Program Files (x86)\\Moonlight Game Streaming\\Moonlight.exe',
        'C:\\Program Files\\Moonlight Game Streaming\\Moonlight.exe',
    ];
    for (const c of candidates) {
        if (fs_1.default.existsSync(c))
            return c;
    }
    // 3) Dev/resource fallback
    const fallback = path_1.default.join(__dirname, '../../resources/Moonlight.exe');
    if (fs_1.default.existsSync(fallback))
        return fallback;
    return null;
}
function launchMoonlight(hostIP, _gameId, gameName) {
    electron_log_1.default.info(`Launching Moonlight: ${hostIP}, game: ${gameName}`);
    // Usar protocolo moonlight:// que abre o Moonlight Desktop
    const moonlightUrl = `moonlight://connect?host=${hostIP}&app=${encodeURIComponent(gameName)}`;
    // Tentar abrir com Shell primeiro (usa moonlight://)
    electron_1.shell.openExternal(moonlightUrl).catch(() => {
        // Fallback: tentar executar Moonlight.exe diretamente
        // Use resolver para encontrar Moonlight exato
        let exePath = getMoonlightExePath();
        if (!exePath) {
            exePath = isDev
                ? path_1.default.join(__dirname, '../../resources/Moonlight.exe')
                : path_1.default.join(process.resourcesPath, 'Moonlight.exe');
        }
        if (exePath && fs_1.default.existsSync(exePath)) {
            const args = ['stream', hostIP, '-app', gameName];
            const proc = (0, child_process_1.spawn)(exePath, args, { detached: true, stdio: 'ignore' });
            proc.unref();
        }
        else {
            electron_log_1.default.warn('Moonlight Desktop nao encontrado - usando moonlight:// protocol');
        }
    });
    electron_log_1.default.info('Moonlight launch initiated');
}
async function killMoonlight() {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('taskkill /F /IM Moonlight.exe', () => resolve());
    });
}
// Moonlight Web Server functions
function getMoonlightWebPath() {
    const webServerPath = isDev
        ? path_1.default.join(__dirname, '../../resources/moonlight-web-server.exe')
        : path_1.default.join(process.resourcesPath, 'moonlight-web-server.exe');
    return webServerPath;
}
function getStaticPath() {
    const staticPath = isDev
        ? path_1.default.join(__dirname, '../../resources/static')
        : path_1.default.join(process.resourcesPath, 'static');
    return staticPath;
}
async function checkMoonlightWeb() {
    const exePath = getMoonlightWebPath();
    return fs_1.default.existsSync(exePath);
}
async function startMoonlightWeb(port = 8080) {
    const exePath = getMoonlightWebPath();
    const staticPath = getStaticPath();
    if (!fs_1.default.existsSync(exePath)) {
        electron_log_1.default.error('Moonlight Web Server not found:', exePath);
        return false;
    }
    if (moonlightWebProcess) {
        electron_log_1.default.info('Moonlight Web already running');
        return true;
    }
    electron_log_1.default.info('Starting Moonlight Web Server...');
    try {
        moonlightWebProcess = (0, child_process_1.spawn)(exePath, [
            '--config-dir', path_1.default.dirname(getConfigPath()),
            '--port', port.toString(),
            '--static-dir', staticPath
        ], { detached: true, stdio: 'ignore' });
        moonlightWebProcess.unref();
        moonlightWebProcess.on('error', (err) => {
            electron_log_1.default.error('Moonlight Web error:', err);
            moonlightWebProcess = null;
        });
        electron_log_1.default.info('Moonlight Web Server started');
        return true;
    }
    catch (e) {
        electron_log_1.default.error('Failed to start Moonlight Web:', e);
        return false;
    }
}
async function stopMoonlightWeb() {
    if (moonlightWebProcess) {
        try {
            process.kill(-moonlightWebProcess.pid);
        }
        catch (e) { }
        moonlightWebProcess = null;
    }
    (0, child_process_1.exec)('taskkill /F /IM moonlight-web-server.exe');
}
// Start Moonlight Launcher (PowerShell) on demand
function startMoonlightLauncher() {
    const launcherScript = getResourcePath('moonlight-launcher.ps1');
    if (!fs_1.default.existsSync(launcherScript)) {
        electron_log_1.default.error('Moonlight Launcher script not found: ' + launcherScript);
        return false;
    }
    try {
        const ps = (0, child_process_1.spawn)('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', launcherScript], { detached: true, stdio: 'ignore' });
        ps.unref();
        electron_log_1.default.info('Moonlight Launcher started');
        return true;
    }
    catch (e) {
        electron_log_1.default.error('Failed to start Moonlight Launcher', e);
        return false;
    }
}
electron_1.ipcMain.handle('start-moonlight-launcher', async () => {
    const ok = startMoonlightLauncher();
    return { success: ok };
});
function getConfigPath() {
    return isDev
        ? path_1.default.join(__dirname, '../../config.json')
        : path_1.default.join(electron_1.app.getPath('userData'), 'config.json');
}
function getConfig() {
    const configPath = isDev
        ? path_1.default.join(__dirname, '../../config.json')
        : path_1.default.join(electron_1.app.getPath('userData'), 'config.json');
    try {
        if (fs_1.default.existsSync(configPath)) {
            return JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
        }
    }
    catch (e) {
        electron_log_1.default.error('Error reading config:', e);
    }
    return null;
}
function saveConfig(config) {
    const configPath = isDev
        ? path_1.default.join(__dirname, '../../config.json')
        : path_1.default.join(electron_1.app.getPath('userData'), 'config.json');
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
electron_1.ipcMain.handle('get-config', () => getConfig());
electron_1.ipcMain.handle('save-config', (_event, config) => saveConfig(config));
electron_1.ipcMain.handle('check-tailscale', async () => {
    const installed = await checkTailscale();
    if (installed) {
        const ip = await getTailscaleIP();
        return { installed: true, connected: !!ip, ip };
    }
    return { installed: false, connected: false, ip: null };
});
electron_1.ipcMain.handle('install-tailscale', async (_event, authKey) => {
    return installTailscaleMSI(authKey);
});
electron_1.ipcMain.handle('get-tailscale-ip', async () => getTailscaleIP());
electron_1.ipcMain.handle('check-moonlight', async () => {
    return checkMoonlight();
});
electron_1.ipcMain.handle('check-moonlight-web', async () => {
    const installed = await checkMoonlightWeb();
    return { installed, running: !!moonlightWebProcess };
});
electron_1.ipcMain.handle('start-moonlight-web', async (_event, port) => {
    return startMoonlightWeb(port);
});
electron_1.ipcMain.handle('stop-moonlight-web', async () => {
    await stopMoonlightWeb();
    return { success: true };
});
electron_1.ipcMain.handle('launch-game', async (_event, hostIP, gameId, gameName) => {
    launchMoonlight(hostIP, gameId, gameName);
    return { success: true };
});
electron_1.ipcMain.handle('stop-game', async () => {
    await killMoonlight();
    return { success: true };
});
electron_1.ipcMain.handle('open-external', async (_event, url) => {
    await electron_1.shell.openExternal(url);
});
electron_1.ipcMain.handle('show-message', async (_event, options) => {
    const result = await electron_1.dialog.showMessageBox(mainWindow, {
        type: options.type,
        title: options.title,
        message: options.message,
    });
    return result;
});
electron_1.app.whenReady().then(() => {
    electron_log_1.default.info('App ready');
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
