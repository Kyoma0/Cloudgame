import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

log.info('Cloudgame Client starting...');

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let moonlightWebProcess: any = null;

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window shown');
  });

if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getResourcePath(filename: string): string {
  if (isDev) {
    return path.join(__dirname, '../../resources', filename);
  }
  return path.join(process.resourcesPath, filename);
}

async function checkTailscale(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('where tailscale', (err) => {
      resolve(!err);
    });
  });
}

async function installTailscaleMSI(authKey: string): Promise<boolean> {
  log.info('Installing Tailscale...');
  const msiPath = getResourcePath('tailscale-setup.msi');
  
  if (!fs.existsSync(msiPath)) {
    log.error('Tailscale MSI not found:', msiPath);
    return false;
  }

  return new Promise((resolve) => {
    const proc = spawn('msiexec.exe', [
      '/i', msiPath,
      '/qn',
      '/norestart'
    ], { detached: true, stdio: 'ignore' });

    proc.on('close', (code) => {
      if (code === 0) {
        log.info('Tailscale installed, connecting...');
        const up = spawn('tailscale', ['up', '--authkey', authKey, '--accept-routes'], {
          detached: true,
          stdio: 'ignore'
        });
        up.unref();
        setTimeout(() => resolve(true), 3000);
      } else {
        log.error('Tailscale install failed, code:', code);
        resolve(false);
      }
    });
  });
}

async function getTailscaleIP(): Promise<string | null> {
  return new Promise((resolve) => {
    exec('tailscale ip -4', (err, stdout) => {
      if (err) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function checkMoonlight(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('where Moonlight.exe', (err) => {
      resolve(!err);
    });
  });
}

// Resolve Moonlight executable path with sensible fallbacks
function getMoonlightExePath(): string | null {
  // 1) Environment override (user-defined path)
  const envPath = process.env.MOONLIGHT_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2) Common Windows install locations
  const candidates = [
    'C:\\Program Files\\Moonlight Game Streaming\\Moonlight.exe',
    'C:\\Program Files (x86)\\Moonlight Game Streaming\\Moonlight.exe',
    'C:\\Program Files\\Moonlight Game Streaming\\Moonlight.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // 3) Dev/resource fallback
  const fallback = path.join(__dirname, '../../resources/Moonlight.exe');
  if (fs.existsSync(fallback)) return fallback;

  return null;
}

function launchMoonlight(hostIP: string, _gameId: number, gameName: string): void {
  log.info(`Launching Moonlight: ${hostIP}, game: ${gameName}`);
   
  // Usar protocolo moonlight:// que abre o Moonlight Desktop
  const moonlightUrl = `moonlight://connect?host=${hostIP}&app=${encodeURIComponent(gameName)}`;
  
  // Tentar abrir com Shell primeiro (usa moonlight://)
  shell.openExternal(moonlightUrl).catch(() => {
    // Fallback: tentar executar Moonlight.exe diretamente
    // Use resolver para encontrar Moonlight exato
    let exePath = getMoonlightExePath();
    if (!exePath) {
      exePath = isDev
        ? path.join(__dirname, '../../resources/Moonlight.exe')
        : path.join(process.resourcesPath, 'Moonlight.exe');
    }
    
    if (exePath && fs.existsSync(exePath)) {
      const args = ['stream', hostIP, '-app', gameName];
      const proc = spawn(exePath, args, { detached: true, stdio: 'ignore' });
      proc.unref();
    } else {
      log.warn('Moonlight Desktop nao encontrado - usando moonlight:// protocol');
    }
  });
  
  log.info('Moonlight launch initiated');
}

async function killMoonlight(): Promise<void> {
  return new Promise((resolve) => {
    exec('taskkill /F /IM Moonlight.exe', () => resolve());
  });
}

// Moonlight Web Server functions
function getMoonlightWebPath(): string {
  const webServerPath = isDev 
    ? path.join(__dirname, '../../resources/moonlight-web-server.exe')
    : path.join(process.resourcesPath, 'moonlight-web-server.exe');
  return webServerPath;
}

function getStaticPath(): string {
  const staticPath = isDev 
    ? path.join(__dirname, '../../resources/static')
    : path.join(process.resourcesPath, 'static');
  return staticPath;
}

async function checkMoonlightWeb(): Promise<boolean> {
  const exePath = getMoonlightWebPath();
  return fs.existsSync(exePath);
}

async function startMoonlightWeb(port: number = 8080): Promise<boolean> {
  const exePath = getMoonlightWebPath();
  const staticPath = getStaticPath();
  
  if (!fs.existsSync(exePath)) {
    log.error('Moonlight Web Server not found:', exePath);
    return false;
  }
  
  if (moonlightWebProcess) {
    log.info('Moonlight Web already running');
    return true;
  }
  
  log.info('Starting Moonlight Web Server...');
  
  try {
    moonlightWebProcess = spawn(exePath, [
      '--config-dir', path.dirname(getConfigPath()),
      '--port', port.toString(),
      '--static-dir', staticPath
    ], { detached: true, stdio: 'ignore' });
    
    moonlightWebProcess.unref();
    
    moonlightWebProcess.on('error', (err: any) => {
      log.error('Moonlight Web error:', err);
      moonlightWebProcess = null;
    });
    
    log.info('Moonlight Web Server started');
    return true;
  } catch (e) {
    log.error('Failed to start Moonlight Web:', e);
    return false;
  }
}

async function stopMoonlightWeb(): Promise<void> {
  if (moonlightWebProcess) {
    try {
      process.kill(-moonlightWebProcess.pid);
    } catch (e) {}
    moonlightWebProcess = null;
  }
  exec('taskkill /F /IM moonlight-web-server.exe');
}

// Start Moonlight Launcher (PowerShell) on demand
function startMoonlightLauncher(): boolean {
  const launcherScript = getResourcePath('moonlight-launcher.ps1');
  if (!fs.existsSync(launcherScript)) {
    log.error('Moonlight Launcher script not found: ' + launcherScript);
    return false;
  }
  try {
    const ps = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', launcherScript], { detached: true, stdio: 'ignore' });
    ps.unref();
    log.info('Moonlight Launcher started');
    return true;
  } catch (e) {
    log.error('Failed to start Moonlight Launcher', e);
    return false;
  }
}

ipcMain.handle('start-moonlight-launcher', async () => {
  const ok = startMoonlightLauncher();
  return { success: ok };
});

function getConfigPath(): string {
  return isDev
    ? path.join(__dirname, '../../config.json')
    : path.join(app.getPath('userData'), 'config.json');
}

function getConfig(): any {
  const configPath = isDev
    ? path.join(__dirname, '../../config.json')
    : path.join(app.getPath('userData'), 'config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    log.error('Error reading config:', e);
  }
  return null;
}

function saveConfig(config: any): void {
  const configPath = isDev
    ? path.join(__dirname, '../../config.json')
    : path.join(app.getPath('userData'), 'config.json');
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

ipcMain.handle('get-config', () => getConfig());
ipcMain.handle('save-config', (_event, config) => saveConfig(config));

ipcMain.handle('check-tailscale', async () => {
  const installed = await checkTailscale();
  if (installed) {
    const ip = await getTailscaleIP();
    return { installed: true, connected: !!ip, ip };
  }
  return { installed: false, connected: false, ip: null };
});

ipcMain.handle('install-tailscale', async (_event, authKey: string) => {
  return installTailscaleMSI(authKey);
});

ipcMain.handle('get-tailscale-ip', async () => getTailscaleIP());

ipcMain.handle('check-moonlight', async () => {
  return checkMoonlight();
});

ipcMain.handle('check-moonlight-web', async () => {
  const installed = await checkMoonlightWeb();
  return { installed, running: !!moonlightWebProcess };
});

ipcMain.handle('start-moonlight-web', async (_event, port: number) => {
  return startMoonlightWeb(port);
});

ipcMain.handle('stop-moonlight-web', async () => {
  await stopMoonlightWeb();
  return { success: true };
});

ipcMain.handle('launch-game', async (_event, hostIP: string, gameId: number, gameName: string) => {
  launchMoonlight(hostIP, gameId, gameName);
  return { success: true };
});

ipcMain.handle('stop-game', async () => {
  await killMoonlight();
  return { success: true };
});

ipcMain.handle('open-external', async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-message', async (_event, options: { type: string; title: string; message: string }) => {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: options.type as any,
    title: options.title,
    message: options.message,
  });
  return result;
});

app.whenReady().then(() => {
  log.info('App ready');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
