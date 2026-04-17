import { contextBridge, ipcRenderer } from 'electron';

export interface CloudgameAPI {
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<void>;
  checkTailscale: () => Promise<{ installed: boolean; connected: boolean; ip: string | null }>;
  installTailscale: (authKey: string) => Promise<boolean>;
  getTailscaleIP: () => Promise<string | null>;
  checkMoonlight: () => Promise<boolean>;
  checkMoonlightWeb: () => Promise<{ installed: boolean; running: boolean }>;
  startMoonlightWeb: (port: number) => Promise<boolean>;
  stopMoonlightWeb: () => Promise<{ success: boolean }>;
  launchGame: (hostIP: string, gameId: number, gameName: string) => Promise<{ success: boolean }>;
  stopGame: () => Promise<{ success: boolean }>;
  openExternal: (url: string) => Promise<void>;
  showMessage: (options: { type: string; title: string; message: string }) => Promise<any>;
}

const api: CloudgameAPI = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  checkTailscale: () => ipcRenderer.invoke('check-tailscale'),
  installTailscale: (authKey) => ipcRenderer.invoke('install-tailscale', authKey),
  getTailscaleIP: () => ipcRenderer.invoke('get-tailscale-ip'),
  checkMoonlight: () => ipcRenderer.invoke('check-moonlight'),
  checkMoonlightWeb: () => ipcRenderer.invoke('check-moonlight-web'),
  startMoonlightWeb: (port) => ipcRenderer.invoke('start-moonlight-web', port),
  stopMoonlightWeb: () => ipcRenderer.invoke('stop-moonlight-web'),
  launchGame: (hostIP, gameId, gameName) => ipcRenderer.invoke('launch-game', hostIP, gameId, gameName),
  stopGame: () => ipcRenderer.invoke('stop-game'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showMessage: (options) => ipcRenderer.invoke('show-message', options),
};

contextBridge.exposeInMainWorld('cloudgame', api);