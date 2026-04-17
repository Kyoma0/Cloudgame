"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Bridge all needed APIs to the renderer process. This keeps existing calls working
// and adds the Moonlight Launcher launcher API.
electron_1.contextBridge.exposeInMainWorld('cloudgame', {
    checkTailscale: () => electron_1.ipcRenderer.invoke('check-tailscale'),
    installTailscale: (authKey) => electron_1.ipcRenderer.invoke('install-tailscale', authKey),
    getConfig: () => electron_1.ipcRenderer.invoke('get-config'),
    saveConfig: (config) => electron_1.ipcRenderer.invoke('save-config', config),
    checkMoonlight: () => electron_1.ipcRenderer.invoke('check-moonlight'),
    checkMoonlightWeb: () => electron_1.ipcRenderer.invoke('check-moonlight-web'),
    startMoonlightWeb: (port) => electron_1.ipcRenderer.invoke('start-moonlight-web', port),
    stopMoonlightWeb: () => electron_1.ipcRenderer.invoke('stop-moonlight-web'),
    launchGame: (hostIP, gameId, gameName) => electron_1.ipcRenderer.invoke('launch-game', hostIP, gameId, gameName),
    stopGame: () => electron_1.ipcRenderer.invoke('stop-game'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    showMessage: (options) => electron_1.ipcRenderer.invoke('show-message', options),
    startMoonlightLauncher: () => electron_1.ipcRenderer.invoke('start-moonlight-launcher')
});
