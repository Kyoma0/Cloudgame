#!/usr/bin/env node
// Auto-download cloudflared tunnel binary for current OS/Arch
// Places binary under bin/cloudflared/ and makes it executable when appropriate
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

function getAssetName() {
  const platform = os.platform(); // 'win32', 'linux', 'darwin'
  const arch = os.arch(); // 'x64', 'arm64'
  if (platform === 'win32') {
    // Use 32-bit binary if running on ia32 (Windows 32-bit)
    if (arch === 'ia32') return 'cloudflared-windows-386.exe';
    return 'cloudflared-windows-amd64.exe';
  }
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'cloudflared-darwin-arm64' : 'cloudflared-darwin-amd64';
  }
  // linux
  return arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doRequest = (target) => {
      https.get(target, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, target).toString();
          doRequest(next);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download cloudflared: ${res.statusCode}`));
          res.resume();
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    };
    doRequest(url);
  });
}

async function main() {
  const asset = getAssetName();
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;
  const destDir = path.resolve(__dirname, '..', 'bin', 'cloudflared');
  const destPath = path.resolve(destDir, asset);
  try {
    await fs.promises.mkdir(destDir, { recursive: true });
  } catch {}
  if (fs.existsSync(destPath)) {
    console.log('[cloudflared] Binary already exists at', destPath);
    return;
  }
  console.log('[cloudflared] Downloading', asset, 'to', destPath);
  await download(url, destPath);
  // Make executable on non-Windows platforms
  try {
    if (os.platform() !== 'win32') {
      fs.chmodSync(destPath, 0o755);
    }
  } catch {
    // ignore chmod failures
  }
  console.log('[cloudflared] Download complete.');
}

main().catch((err) => {
  console.error('[cloudflared] Download failed:', err && err.message ? err.message : err);
  process.exit(1);
});
