// Sunshine loader shim. Try to load Sunshine via Electron's runtime require when available;
// otherwise fall back to a no-op shim. This avoids static resolution of the package by the bundler.
export function loadSunshine(): any {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const req = (window as any).require;
      if (typeof req === 'function') {
        const mod = req('sunshine');
        if (mod) return mod;
      }
    } catch {
      // ignore
    }
  }
  return {
    __shim: true,
    init: () => {
      // no-op when Sunshine isn't actually loaded
    },
  };
}
