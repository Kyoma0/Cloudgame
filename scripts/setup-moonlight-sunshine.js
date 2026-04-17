#!/usr/bin/env node
/*
  Auto-setup: Sunshine integration and Moonlight Web binary download.
  - Ensures Sunshine is installed (npm install sunshine@0.0.1)
  - Optionally downloads Moonlight Web binary if MOONLIGHT_WEB_URL env var is provided
  - Writes a Moonlight config file for the app
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Request Failed. Status Code: ' + res.statusCode));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });
    req.on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function ensureSunshine() {
  let hasSunshine = false;
  try {
    require.resolve('sunshine');
    hasSunshine = true;
  } catch {
    // ignore
  }
  if (!hasSunshine) {
    console.log('[MoonlightSunshine] Sunshine not found. Installing...');
    const res = spawnSync('npm', ['install', 'sunshine@0.0.1', '--no-audit', '--no-fund'], { stdio: 'inherit' });
    if (res.status !== 0) {
      console.warn('[MoonlightSunshine] Sunshine installation may have failed.');
    }
  } else {
    console.log('[MoonlightSunshine] Sunshine already installed.');
  }
}

async function main() {
  console.log('[MoonlightSunshine] Starting auto-setup...');
  // 1) Sunshine
  await ensureSunshine();

  // 2) Moonlight Web download (optional)
  const moonUrl = process.env.MOONLIGHT_WEB_URL || '';
  const moonDir = path.resolve(__dirname, '..', 'moonlight');
  ensureDir(moonDir);
  if (moonUrl) {
    const fileName = path.basename(moonUrl);
    const dest = path.resolve(moonDir, fileName);
    if (!fs.existsSync(dest)) {
      console.log(`[MoonlightSunshine] Downloading Moonlight Web from ${moonUrl}...`);
      try {
        await download(moonUrl, dest);
        console.log(`[MoonlightSunshine] Moonlight Web downloaded to ${dest}`);
      } catch (err) {
        console.error('[MoonlightSunshine] Failed to download Moonlight Web:', err.message);
      }
    } else {
      console.log(`[MoonlightSunshine] Moonlight Web already downloaded at ${dest}`);
    }
  } else {
    console.log('[MoonlightSunshine] MOONLIGHT_WEB_URL not set. Skipping binary download.');
  }

  // 3) Moonlight config
  const configDir = path.resolve(__dirname, '..', 'config');
  ensureDir(configDir);
  const cfgPath = path.resolve(configDir, 'moonlight.json');
  const cfg = {
    moonlightWebPort: 8080,
    sunshineEnabled: true
  };
  try {
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    console.log(`[MoonlightSunshine] Moonlight config written at ${cfgPath}`);
  } catch (e) {
    console.error('[MoonlightSunshine] Failed to write config:', e);
  }

  console.log('[MoonlightSunshine] Setup complete.');
}

main().catch((err) => {
  console.error('[MoonlightSunshine] Fatal error:', err);
  process.exit(1);
});
