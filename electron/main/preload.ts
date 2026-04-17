import { contextBridge, ipcRenderer } from 'electron';

// Bridge all needed APIs to the renderer process. This keeps existing calls working
// and adds the Moonlight Launcher launcher API.
contextBridge.exposeInMainWorld('cloudgame', {
  checkTailscale: () => ipcRenderer.invoke('check-tailscale'),
  installTailscale: (authKey: string) => ipcRenderer.invoke('install-tailscale', authKey),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  checkMoonlight: () => ipcRenderer.invoke('check-moonlight'),
  checkMoonlightWeb: () => ipcRenderer.invoke('check-moonlight-web'),
  startMoonlightWeb: (port: number) => ipcRenderer.invoke('start-moonlight-web', port),
  stopMoonlightWeb: () => ipcRenderer.invoke('stop-moonlight-web'),
  launchGame: (hostIP: string, gameId: number, gameName: string) => ipcRenderer.invoke('launch-game', hostIP, gameId, gameName),
  stopGame: () => ipcRenderer.invoke('stop-game'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showMessage: (options: { type: string; title: string; message: string }) => ipcRenderer.invoke('show-message', options),
  startMoonlightLauncher: () => ipcRenderer.invoke('start-moonlight-launcher')
});
