#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const MOONLIGHT_WEB_URL = 'https://github.com/MrCreativ3001/moonlight-web-stream/releases/download/v2.8/moonlight-web-x86_64-pc-windows-gnu.zip';
const MOONLIGHT_DIR = path.resolve(__dirname, '..', 'moonlight');
const DEST_ZIP = path.resolve(MOONLIGHT_DIR, 'moonlight-web.zip');

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

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`], { stdio: 'inherit' });
    ps.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Unzip failed with code ${code}`));
    });
  });
}

async function main() {
  console.log('[MoonlightWeb] Starting download...');
  ensureDir(MOONLIGHT_DIR);
  
  if (fs.existsSync(path.resolve(MOONLIGHT_DIR, 'moonlight-web.exe'))) {
    console.log('[MoonlightWeb] Binary already exists.');
    return;
  }
  
  console.log('[MoonlightWeb] Downloading moonlight-web-x86_64-pc-windows-gnu.zip...');
  await download(MOONLIGHT_WEB_URL, DEST_ZIP);
  
  console.log('[MoonlightWeb] Extracting...');
  await extractZip(DEST_ZIP, MOONLIGHT_DIR);
  
  // Rename if needed
  const extractedFiles = fs.readdirSync(MOONLIGHT_DIR);
  for (const f of extractedFiles) {
    if (f.toLowerCase().endsWith('.exe')) {
      console.log('[MoonlightWeb] Found executable:', f);
    }
  }
  
  // Cleanup zip
  try { fs.unlinkSync(DEST_ZIP); } catch {}
  
  console.log('[MoonlightWeb] Done! Binary is in', MOONLIGHT_DIR);
}

main().catch((err) => {
  console.error('[MoonlightWeb] Error:', err.message);
  process.exit(1);
});