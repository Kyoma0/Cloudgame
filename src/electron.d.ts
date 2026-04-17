export {};

declare global {
  interface Window {
    cloudgame?: {
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
      startMoonlightLauncher: () => Promise<{ success: boolean }>;
    };
    isElectron?: boolean;
  }
}
