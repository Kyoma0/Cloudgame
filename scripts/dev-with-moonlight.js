#!/usr/bin/env node
// Dev bootstrap: start Moonlight Web (if present) and Vite dev server in parallel
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function findMoonlightBinary() {
  try {
    const root = process.cwd ? process.cwd() : '/';
    const moonDir = path.resolve(root, 'moonlight');
    if (!fs.existsSync(moonDir)) return null;
    
    // Check for web-server.exe in moonlight/package/ (extracted from v2.8+)
    const packageDir = path.resolve(moonDir, 'package');
    if (fs.existsSync(packageDir)) {
      const pkgFiles = fs.readdirSync(packageDir);
      for (const f of pkgFiles) {
        if (f.toLowerCase().includes('web-server') && f.toLowerCase().endsWith('.exe')) {
          return path.resolve(packageDir, f);
        }
      }
    }
    
    // Legacy: check directly in moonlight/
    const files = fs.readdirSync(moonDir);
    for (const f of files) {
      const full = path.resolve(moonDir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          const isWin = process.platform === 'win32';
          if (isWin) {
            if (full.toLowerCase().endsWith('.exe')) return full;
          } else {
            if ((stat.mode & 0o111)) return full;
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function spawnMoonlight(bin) {
  if (!bin) return null;
  // Need to run from the package directory where 'static' folder exists
  const workDir = path.dirname(bin);
  const args = ['--bind-address', '0.0.0.0:8080'];
  try {
    return spawn(bin, args, { stdio: 'inherit', cwd: workDir });
  } catch {
    return spawn(bin, [], { stdio: 'inherit', cwd: workDir });
  }
}

function spawnVite() {
  // Cross-platform approach: prefer running vite via its JS entry point to avoid Windows .cmd issues
  const viteJs = path.resolve(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  try {
    if (fs.existsSync(viteJs)) {
      return spawn(process.execPath, [viteJs], { stdio: 'inherit' });
    }
  } catch {
    // fall back to binary if something goes wrong
  }
  // Fallbacks: rely on bin scripts (may require shell handling on Windows)
  try {
    const viteBin = path.resolve(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
    return spawn(viteBin, [], { stdio: 'inherit', shell: true });
  } catch {
    // Last resort: try npx
    return spawn('npx', ['vite'], { stdio: 'inherit', shell: true });
  }
}

const moonBin = findMoonlightBinary();
if (!moonBin) {
  console.log('[MoonlightDev] Moonlight binary not found in moonlight/. Skipping auto-start.');
}
const moonProc = spawnMoonlight(moonBin);
const viteProc = spawnVite();

// Optional: start Cloudflare Tunnel automatically if a tunnel name is provided
try {
  const tunnelName = process.env.TUNNEL_NAME;
  if (tunnelName) {
    const platform = process.platform;
    const arch = process.arch;
    let cfAsset = '';
    if (platform === 'win32') {
      cfAsset = arch === 'ia32' ? 'cloudflared-windows-386.exe' : 'cloudflared-windows-amd64.exe';
    } else if (platform === 'darwin') {
      cfAsset = arch === 'arm64' ? 'cloudflared-darwin-arm64' : 'cloudflared-darwin-amd64';
    } else {
      cfAsset = arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
    }
    const cfBin = path.resolve(__dirname, '..', 'bin', 'cloudflared', cfAsset);
    // start the tunnel if the binary exists
    try {
      const fs = require('fs');
      if (fs.existsSync(cfBin)) {
        const cf = spawn(cfBin, ['tunnel', 'run', tunnelName, '--url', 'http://localhost:3000'], { stdio: 'inherit' });
        cf.on('error', (err) => {
          // non-fatal: log and continue
          console.error('[cloudflared] failed to start tunnel:', err && err.message ? err.message : err);
        });
      } else {
        console.log('[cloudflared] Binary not found at', cfBin);
      }
    } catch (e) {
      // ignore errors starting tunnel
    }
  }
} catch {
  // ignore issues attempting to auto-start tunnel
}

function cleanup() {
  try { if (moonProc && !moonProc.killed) moonProc.kill(); } catch {}
  try { if (viteProc && !viteProc.killed) viteProc.kill(); } catch {}
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Keep the process alive as long as either child is alive
moonProc && moonProc.on('exit', () => {});
viteProc && viteProc.on('exit', () => {});
