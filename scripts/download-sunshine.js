#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUNSHINE_URL = 'https://github.com/LizardByte/Sunshine/releases/download/v2025.924.154138/Sunshine-Windows-AMD64-installer.exe';
const DEST_DIR = path.resolve(__dirname, '..', 'sunshine');
const DEST_FILE = path.resolve(DEST_DIR, 'Sunshine-Windows-AMD64-installer.exe');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doRequest = (target) => {
      https.get(target, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, target).toString();
          doRequest(next);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(resolve); });
      }).on('error', (err) => { fs.unlink(dest, () => reject(err)); });
    };
    doRequest(url);
  });
}

async function main() {
  console.log('[Sunshine] Downloading Sunshine installer for Windows...');
  ensureDir(DEST_DIR);
  console.log('[Sunshine] URL:', SUNSHINE_URL);
  console.log('[Sunshine] Destination:', DEST_FILE);
  await download(SUNSHINE_URL, DEST_FILE);
  console.log('[Sunshine] Download complete!');
  console.log('[Sunshine] Installer location:', DEST_FILE);
  console.log('[Sunshine] Run the installer to install Sunshine.');
}

main().catch((err) => {
  console.error('[Sunshine] Error:', err.message);
  process.exit(1);
});