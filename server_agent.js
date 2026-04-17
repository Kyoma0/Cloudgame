/**
 * Cloudgame - Host Agent (Node.js)
 * Coleta stats do PC (GPU, CPU, jogos) e manda pro backend local
 *
 * Para rodar: node server_agent.js
 * Sem dependências extras — usa só Node.js nativo + child_process
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Aponta pro backend local (server.js) na porta 3001
const API_URL = 'http://localhost:3001/api';
const UPDATE_INTERVAL = 3000; // 3 segundos
const LIBRARY_FILE = path.join(__dirname, 'library.json');

// ─── GPU STATS ────────────────────────────────────────────────────────────────
function getGpuStats() {
  try {
    // Tenta NVIDIA primeiro
    const output = execSync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits',
      { timeout: 3000 }
    ).toString().trim();

    const [gpuUtil, memUsed, memTotal, temp] = output.split(', ').map(Number);
    return {
      gpu_usage: gpuUtil,
      memory_usage: (memUsed / memTotal) * 100,
      temp,
      encoder: 'NVENC (H.265)'
    };
  } catch {
    // Fallback: usa CPU como aproximação
    const cpuLoad = getCpuUsage();
    return {
      gpu_usage: cpuLoad,
      memory_usage: getMemoryUsage(),
      temp: 45 + cpuLoad * 0.4,
      encoder: 'Software (x264)'
    };
  }
}

// ─── CPU USAGE ────────────────────────────────────────────────────────────────
function getCpuUsage() {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        'wmic cpu get loadpercentage /value',
        { timeout: 3000 }
      ).toString();
      const match = result.match(/LoadPercentage=(\d+)/);
      return match ? parseInt(match[1]) : 50;
    } else {
      const result = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", { timeout: 3000 }).toString();
      return parseFloat(result) || 50;
    }
  } catch {
    return 50;
  }
}

// ─── MEMORY USAGE ─────────────────────────────────────────────────────────────
function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

// ─── PLATFORM STATUS ──────────────────────────────────────────────────────────
function getPlatformStatus() {
  const status = { steam: false, epic: false, gog: false };
  try {
    let processes = '';
    if (process.platform === 'win32') {
      processes = execSync('tasklist /fo csv /nh', { timeout: 3000 }).toString().toLowerCase();
    } else {
      processes = execSync('ps aux', { timeout: 3000 }).toString().toLowerCase();
    }
    if (processes.includes('steam')) status.steam = true;
    if (processes.includes('epic') || processes.includes('fortnite')) status.epic = true;
    if (processes.includes('galaxy') || processes.includes('gog')) status.gog = true;
  } catch {}
  return status;
}

// ─── SCAN LIBRARY ─────────────────────────────────────────────────────────────
function scanLibrary() {
  const games = [];

  // Steam
  const steamPaths = [
    'C:/Program Files (x86)/Steam/steamapps',
    'D:/SteamLibrary/steamapps',
    'E:/SteamLibrary/steamapps',
    path.join(os.homedir(), '.steam/steam/steamapps'), // Linux
  ];

  for (const steamPath of steamPaths) {
    if (!fs.existsSync(steamPath)) continue;
    try {
      const files = fs.readdirSync(steamPath).filter(f => f.endsWith('.acf'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(steamPath, file), 'utf-8');
        const nameMatch = content.match(/"name"\s+"([^"]+)"/);
        const appIdMatch = content.match(/"appid"\s+"(\d+)"/);
        if (nameMatch && appIdMatch) {
          games.push({
            id: `steam_${appIdMatch[1]}`,
            name: nameMatch[1],
            platform: 'Steam',
            path: `steam://run/${appIdMatch[1]}`,
            image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appIdMatch[1]}/header.jpg`
          });
        }
      }
    } catch {}
  }

  // Epic Games
  const epicPath = 'C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests';
  if (fs.existsSync(epicPath)) {
    try {
      const files = fs.readdirSync(epicPath).filter(f => f.endsWith('.item'));
      for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(epicPath, file), 'utf-8'));
        games.push({
          id: `epic_${data.AppName}`,
          name: data.DisplayName,
          platform: 'Epic',
          path: `com.epicgames.launcher://apps/${data.AppName}?action=launch&silent=true`,
          image: 'https://picsum.photos/seed/epic/400/225'
        });
      }
    } catch {}
  }

  // Se não achou nada, retorna mock pra não ficar vazio
  if (games.length === 0) {
    games.push(
      { id: 'mock_1', name: 'Cyberpunk 2077', platform: 'Steam', path: 'steam://run/1091500', image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg' },
      { id: 'mock_2', name: 'The Witcher 3', platform: 'Steam', path: 'steam://run/292030', image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg' },
      { id: 'mock_3', name: 'Grand Theft Auto V', platform: 'Steam', path: 'steam://run/271590', image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg' }
    );
  }

  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(games, null, 2));
  return games;
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
async function sendStats() {
  const gpuStats = getGpuStats();
  const stats = {
    ...gpuStats,
    uptime_seconds: Math.floor(os.uptime()),
    platform_status: getPlatformStatus(),
    tailscale_ip: getTailscaleIp()
  };

  try {
    const res = await fetch(`${API_URL}/host/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats)
    });

    if (!res.ok) {
      console.error(`❌ Backend retornou ${res.status}`);
      return;
    }

    const data = await res.json();

    // Backend pediu pra sincronizar a biblioteca de jogos
    if (data.sync_library) {
      console.log('📚 Sincronizando biblioteca de jogos...');
      const library = scanLibrary();
      await fetch(`${API_URL}/host/library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library })
      });
      console.log(`✅ ${library.length} jogos enviados`);
    }

    // Log resumido
    process.stdout.write(
      `\r🖥️  GPU: ${gpuStats.gpu_usage.toFixed(0)}% | ` +
      `Mem: ${gpuStats.memory_usage.toFixed(0)}% | ` +
      `Temp: ${gpuStats.temp.toFixed(0)}°C | ` +
      `Uptime: ${formatUptime(stats.uptime_seconds)}   `
    );

  } catch (e) {
    console.error(`\n❌ Erro ao enviar stats: ${e.message}`);
    console.error('   Certifique-se que o server.js está rodando (node server.js)');
  }
}

function getTailscaleIp() {
  try {
    return execSync('tailscale ip -4', { timeout: 2000 }).toString().trim();
  } catch {
    return null;
  }
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m}m`;
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║   Cloudgame Agent - INICIADO           ║');
console.log(`║   Backend: ${API_URL.padEnd(28)}║`);
console.log('╚════════════════════════════════════════╝');
console.log('');

// Faz scan da biblioteca na inicialização
console.log('📚 Escaneando biblioteca de jogos...');
const initialLibrary = scanLibrary();
console.log(`✅ ${initialLibrary.length} jogos encontrados`);
console.log('');
console.log('🔄 Enviando stats a cada 3 segundos...');

// Loop principal
setInterval(sendStats, UPDATE_INTERVAL);
sendStats(); // Roda imediatamente na inicialização
