// Moonlight Web launcher for Electron renderer context (optional and best-effort).
// This module attempts to spawn the Moonlight Web binary if present in the app's moonlight/ folder.
// It uses the Node 'child_process' API via a safe, optional require to avoid breaking in non-Electron environments.

import * as path from 'path'
import * as fs from 'fs'

let moonlightProc: any = null

function dynamicRequireChildProcess(): any {
  try {
    const w = (global as any) || (window as any)
    const req = (w && w.require) || null
    if (typeof req === 'function') {
      return req('child_process')
    }
  } catch {
    // ignore
  }
  return null
}

function findMoonlightBinary(): string | null {
  try {
    const root = process.cwd ? process.cwd() : '/';
    const moonDir = path.resolve(root, 'moonlight')
    if (!fs.existsSync(moonDir)) return null
    const files = fs.readdirSync(moonDir)
    // Choose first executable file as candidate
    for (const f of files) {
      const full = path.join(moonDir, f)
      try {
        const stat = fs.statSync(full)
        if (stat.isFile()) {
          const isWin = process.platform === 'win32'
          if (isWin) {
            if (full.toLowerCase().endsWith('.exe')) return full
          } else {
            // Linux/macOS: require execute bit
            if ((stat.mode & fs.constants.S_IXUSR) || (stat.mode & fs.constants.S_IXGRP) || (stat.mode & fs.constants.S_IXOTH)) {
              return full
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return null
}

async function ensureMoonlightRunnable(bin: string): Promise<boolean> {
  // If Linux/macOS, try to chmod +x
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(bin, 0o755)
    } catch {
      // ignore
    }
  }
  return true
}

export async function startMoonlightWebIfPresent(): Promise<void> {
  const bin = findMoonlightBinary()
  if (!bin) {
    console.log('[MoonlightLauncher] Moonlight binary not found in moonlight/ folder.')
    return
  }
  try {
    await ensureMoonlight(bin)
  } catch (e) {
    // ignore startup errors; Moonlight is optional
    console.error('[MoonlightLauncher] Failed to start Moonlight:', (e as any)?.message ?? e)
  }
}
async function ensureMoonlight(bin: string) {
  // Read port from config if present
  let port = 8080
  try {
    const cfgPath = path.resolve(process.cwd(), 'config', 'moonlight.json')
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
      if (cfg?.moonlightWebPort) port = Number(cfg.moonlightWebPort) || port
    }
  } catch {
    // ignore
  }

  // spawn the binary with port if supported; try with and without port
  const cp = dynamicRequireChildProcess()
  if (!cp) {
    console.log('[MoonlightLauncher] Node child_process unavailable in renderer. Skipping start.');
    return
  }

  // Try first with port argument (common flag); fallback to no args
  const argsList = [String('--port'), String(port)]
  try {
    moonlightProc = cp.spawn(bin, argsList, { stdio: 'inherit' })
  } catch {
    moonlightProc = cp.spawn(bin, [], { stdio: 'inherit' })
  }

  moonlightProc && moonlightProc.on('exit', (code: number) => {
    console.log(`[MoonlightLauncher] Moonlight process exited with code ${code}`)
    moonlightProc = null
  })
  moonlightProc && moonlightProc.on('error', (err: any) => {
    console.error('[MoonlightLauncher] Moonlight failed to start:', err)
    moonlightProc = null
  })

  // For completeness, export a handle in case we want to stop later
  ;(global as any).__moonlight_proc = moonlightProc
}

export function stopMoonlightIfRunning(): void {
  try {
    const proc: any = (global as any).__moonlight_proc
    if (proc && typeof proc.kill === 'function') {
      proc.kill()
      (global as any).__moonlight_proc = null
    }
  } catch {
    // ignore
  }
}
