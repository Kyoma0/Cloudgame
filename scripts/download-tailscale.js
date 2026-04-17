#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const TAILSCALE_URL = 'https://pkgs.tailscale.com/stable/tailscale-setup.exe';
const DEST_DIR = path.resolve(__dirname, '..', 'bin', 'tailscale');
const DEST_FILE = path.resolve(DEST_DIR, 'tailscale-setup.exe');

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
  console.log('[Tailscale] Downloading Tailscale installer...');
  ensureDir(DEST_DIR);
  
  if (fs.existsSync(DEST_FILE)) {
    console.log('[Tailscale] Installer already exists.');
  } else {
    await download(TAILSCALE_URL, DEST_FILE);
    console.log('[Tailscale] Download complete!');
  }
  
  console.log('[Tailscale] Installing Tailscale silently...');
  
  return new Promise((resolve, reject) => {
    const proc = spawn(DEST_FILE, ['/S'], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[Tailscale] Installation complete!');
        console.log('[Tailscale] Run "tailscale up" to connect.');
        resolve(true);
      } else {
        reject(new Error(`Install failed with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

main().catch((err) => {
  console.error('[Tailscale] Error:', err.message);
  process.exit(1);
});