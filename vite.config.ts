import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { exec, spawn } = require('child_process');
const fs = require('fs');

const apiPlugin = () => {
  const db = new Database('gaming.db');
  db.pragma('foreign_keys = ON');
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');
  const SECRET_KEY = process.env.JWT_SECRET || 'v-cloud-secret-key-2024';

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'player', -- 'admin', 'player'
      display_name TEXT DEFAULT '',
      avatar_color TEXT DEFAULT 'cyan',
      bio TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      tailscale_ip TEXT DEFAULT '',
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      gamerscore INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      duration INTEGER,
      status TEXT DEFAULT 'active', -- 'active', 'finished', 'killed'
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'waiting',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS host_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_paused INTEGER DEFAULT 0,
      kill_pending INTEGER DEFAULT 0,
      sync_library INTEGER DEFAULT 0,
      platform_status TEXT DEFAULT '{}',
      temp REAL,
      gpu_usage REAL,
      memory_usage REAL,
      encoder TEXT,
      tailscale_ip TEXT,
      uptime_seconds INTEGER,
      is_charging INTEGER,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      tag TEXT,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      quality TEXT DEFAULT '1080p',
      fps INTEGER DEFAULT 60,
      bitrate INTEGER DEFAULT 50,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migration: Add platform_status and sync_library
  try {
    db.prepare("ALTER TABLE host_status ADD COLUMN sync_library INTEGER DEFAULT 0").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE host_status ADD COLUMN platform_status TEXT DEFAULT '{}'").run();
  } catch (e) {}

  // Migration: Add last_seen to users
  try {
    const columns = db.pragma('table_info(users)') as any[];
    const hasLastSeen = columns.some(c => c.name === 'last_seen');
    if (!hasLastSeen) {
      db.prepare("ALTER TABLE users ADD COLUMN last_seen DATETIME DEFAULT CURRENT_TIMESTAMP").run();
      console.log("Migration: Added last_seen column to users table");
    }
  } catch (e: any) {
    console.error("Migration error (last_seen):", e.message);
  }

  // Migration: Add personalization fields to users
  try {
    db.prepare("ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT 'cyan'").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN gamerscore INTEGER DEFAULT 0").run();
  } catch (e) {}

  db.exec(`
    INSERT OR IGNORE INTO host_status (id, is_paused, kill_pending, temp, gpu_usage, memory_usage, encoder, tailscale_ip, uptime_seconds, is_charging) 
    VALUES (1, 0, 0, 0, 0, 0, 'N/A', '0.0.0.0', 0, 1);
  `);

  // Create default admin if not exists
  const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (!adminExists) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', hashed, 'admin');
  }

  function addLog(tag: string, message: string) {
    try {
      db.prepare('INSERT INTO logs (tag, message) VALUES (?, ?)').run(tag, message);
      db.prepare('DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 50)').run();
    } catch (e) {}
  }

  function getGpuTemp() {
    return new Promise((resolve) => {
      exec('nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader', (error, stdout) => {
        if (error) {
          // Mock temperature if nvidia-smi fails
          resolve(45 + Math.floor(Math.random() * 10));
        } else {
          resolve(parseInt(stdout.trim()));
        }
      });
    });
  }

  function getGpuUsage() {
    return new Promise((resolve) => {
      exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', (error, stdout) => {
        if (error) {
          resolve(15 + Math.floor(Math.random() * 20));
        } else {
          resolve(parseInt(stdout.trim()));
        }
      });
    });
  }

  function updateQueue() {
    try {
      const host = db.prepare('SELECT * FROM host_status WHERE id = 1').get() as any;
      if (host.is_paused === 1) return;
      const active = db.prepare("SELECT * FROM queue WHERE status = 'active'").get();
      if (!active) {
        const next = db.prepare("SELECT * FROM queue WHERE status = 'waiting' ORDER BY id ASC LIMIT 1").get() as any;
        if (next) {
          db.prepare("UPDATE queue SET status = 'active' WHERE id = ?").run(next.id);
          const user = db.prepare('SELECT username FROM users WHERE id = ?').get(next.user_id) as any;
          db.prepare('INSERT INTO sessions (user_id) VALUES (?)').run(next.user_id);
          addLog('SESSION', `Sessão iniciada para ${user?.username || next.user_id}`);
        }
      }
    } catch (e) {}
  }

  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();

        const sendJson = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const pathname = url.pathname.replace(/\/$/, ''); // Remove trailing slash

        const getAuthUser = () => {
          const authHeader = req.headers['authorization'];
          if (!authHeader) return null;
          const token = authHeader.split(' ')[1];
          try {
            const decoded = jwt.verify(token, SECRET_KEY) as any;
            // Verify user still exists in DB
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.id);
            if (!user) return null;
            return decoded;
          } catch (e) {
            return null;
          }
        };

        // --- AUTH ROUTES ---
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { username, password } = JSON.parse(body);
              const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
              if (user && bcrypt.compareSync(password, user.password)) {
                if (!user.is_active) return sendJson({ message: 'Conta desativada' }, 403);
                const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
                addLog('AUTH', `Login: ${username}`);
                return sendJson({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
              }
              sendJson({ message: 'Credenciais inválidas' }, 401);
            } catch (e) { sendJson({ error: String(e) }, 500); }
          });
          return;
        }

        if (pathname === '/api/auth/register' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { username, password } = JSON.parse(body);
              if (!username || !password || username.length < 3 || password.length < 6) {
                return sendJson({ message: 'Dados inválidos (Min: User 3, Pass 6)' }, 400);
              }
              const hashed = bcrypt.hashSync(password, 10);
              db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashed, 'player');
              addLog('AUTH', `Novo cadastro: ${username}`);
              sendJson({ success: true });
            } catch (e) { sendJson({ message: 'Usuário já existe' }, 400); }
          });
          return;
        }

        // --- ADMIN ROUTES (Protected) ---
        if (pathname.startsWith('/api/admin')) {
          const user = getAuthUser();
          if (!user || user.role !== 'admin') return sendJson({ message: 'Acesso negado' }, 403);

          // List Users
          if (pathname === '/api/admin/users' && req.method === 'GET') {
            const users = db.prepare('SELECT id, username, role, is_active, tailscale_ip, created_at FROM users').all();
            return sendJson(users);
          }

          // Create User
          if (pathname === '/api/admin/users' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { username, password, role } = JSON.parse(body);
                const hashed = bcrypt.hashSync(password, 10);
                db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashed, role || 'player');
                addLog('ADMIN', `Usuário criado: ${username}`);
                sendJson({ success: true });
              } catch (e) { sendJson({ message: 'Usuário já existe' }, 400); }
            });
            return;
          }

          // Toggle User Status
          if (pathname.startsWith('/api/admin/users/toggle/') && req.method === 'POST') {
            const id = pathname.split('/').pop();
            db.prepare('UPDATE users SET is_active = 1 - is_active WHERE id = ?').run(id);
            return sendJson({ success: true });
          }

          // Clear Queue
          if (pathname === '/api/admin/queue/clear' && req.method === 'POST') {
            db.prepare("UPDATE queue SET status = 'finished' WHERE status != 'finished'").run();
            db.prepare("UPDATE sessions SET status = 'finished', end_time = CURRENT_TIMESTAMP WHERE status = 'active'").run();
            addLog('ADMIN', 'Fila limpa pelo administrador');
            sendJson({ success: true });
            return;
          }

          // Force Next
          if (pathname === '/api/admin/queue/next' && req.method === 'POST') {
            db.prepare("UPDATE queue SET status = 'finished' WHERE status = 'active'").run();
            db.prepare("UPDATE sessions SET status = 'finished', end_time = CURRENT_TIMESTAMP WHERE status = 'active'").run();
            db.prepare("UPDATE host_status SET kill_pending = 1 WHERE id = 1").run();
            updateQueue();
            addLog('ADMIN', 'Fila avançada manualmente pelo administrador');
            sendJson({ success: true });
            return;
          }

          // Kill Session
          if (pathname === '/api/admin/session/kill' && req.method === 'POST') {
            const activeSession = db.prepare("SELECT * FROM sessions WHERE status = 'active'").get() as any;
            if (activeSession) {
              db.prepare("UPDATE sessions SET status = 'killed', end_time = CURRENT_TIMESTAMP WHERE id = ?").run(activeSession.id);
              db.prepare("UPDATE queue SET status = 'finished' WHERE user_id = ? AND status = 'active'").run(activeSession.user_id);
              db.prepare("UPDATE host_status SET kill_pending = 1 WHERE id = 1").run();
              addLog('ADMIN', `Sessão terminada forçadamente (ID: ${activeSession.id})`);
              updateQueue();
              return sendJson({ success: true });
            }
            return sendJson({ message: 'Nenhuma sessão ativa encontrada' }, 404);
          }

          // Change User Role
          if (pathname.startsWith('/api/admin/users/role/') && req.method === 'POST') {
            const id = pathname.split('/').pop();
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { role } = JSON.parse(body);
                db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
                addLog('ADMIN', `Cargo do usuário ID ${id} alterado para ${role}`);
                sendJson({ success: true });
              } catch (e) { sendJson({ error: String(e) }, 500); }
            });
            return;
          }

          // Delete User
          if (pathname.startsWith('/api/admin/users/') && req.method === 'DELETE') {
            const id = pathname.split('/').pop();
            db.prepare('DELETE FROM users WHERE id = ?').run(id);
            addLog('ADMIN', `Usuário ID ${id} removido permanentemente`);
            sendJson({ success: true });
            return;
          }

          // Maintenance Toggle
          if (pathname === '/api/admin/maintenance/toggle' && req.method === 'POST') {
            db.prepare('UPDATE host_status SET is_paused = 1 - is_paused WHERE id = 1').run();
            const host = db.prepare('SELECT is_paused FROM host_status WHERE id = 1').get() as any;
            addLog('ADMIN', `Modo Manutenção: ${host.is_paused === 1 ? 'ATIVADO' : 'DESATIVADO'}`);
            sendJson({ success: true, is_paused: host.is_paused === 1 });
            return;
          }

          // Consolidated Admin Data
          if (pathname === '/api/admin/data' && req.method === 'GET') {
            const queue = db.prepare(`SELECT q.*, u.username FROM queue q JOIN users u ON q.user_id = u.id WHERE q.status != 'finished' ORDER BY q.id ASC`).all();
            const host = db.prepare('SELECT * FROM host_status WHERE id = 1').get();
            const logs = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 20').all();
            const activeSessions = db.prepare("SELECT s.*, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.status = 'active'").all();
            return sendJson({ queue, host, logs, activeSessions });
          }
        }

        // --- PLAYER ROUTES ---
        if (pathname === '/api/launch' && req.method === 'POST') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          const active = db.prepare("SELECT * FROM queue WHERE status = 'active' AND user_id = ?").get(user.id);
          if (!active) {
            return sendJson({ message: 'Você não é o primeiro da fila ou sua sessão não está ativa' }, 403);
          }

          const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user.id) as any;
          const host = db.prepare('SELECT * FROM host_status WHERE id = 1').get() as any;
          const bitrate = settings?.bitrate || 50;
          const ip = host?.tailscale_ip || '192.168.15.119';
          const appName = 'Desktop';

          addLog('SESSION', `Sessão iniciada por ${user.username} via Moonlight (${bitrate}Mbps)`);
          return sendJson({ 
            success: true, 
            moonlightUrl: `moonlight://connect?host=${ip}&app=${encodeURIComponent(appName)}`,
            host: ip,
            app: appName
          });
        }
        
        // Redirect /launch to the launcher page
        if (pathname === '/launch') {
          res.statusCode = 302;
          res.setHeader('Location', '/launch.html');
          res.end();
          return;
        }

        if (pathname === '/api/queue/join' && req.method === 'POST') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          
          const existing = db.prepare("SELECT * FROM queue WHERE user_id = ? AND status != 'finished'").get(user.id);
          if (existing) return sendJson({ success: true, message: 'Já na fila' });

          db.prepare('INSERT INTO queue (user_id) VALUES (?)').run(user.id);
          addLog('QUEUE', `Usuário ${user.username} entrou na fila`);
          updateQueue();
          return sendJson({ success: true });
        }

        if (pathname === '/api/queue/status' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          // Update last seen
          db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

          const userQueue = db.prepare("SELECT * FROM queue WHERE user_id = ? AND status != 'finished'").get(user.id) as any;
          if (!userQueue) return sendJson({ inQueue: false });

          const waitingBefore = db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'waiting' AND id < ?").get(userQueue.id) as any;
          const host = db.prepare('SELECT * FROM host_status WHERE id = 1').get() as any;
          
          return sendJson({
            inQueue: true,
            status: userQueue.status,
            position: waitingBefore.count + 1,
            hostPaused: host.is_paused === 1,
            tailscaleIp: host.tailscale_ip,
            hostStats: {
              temp: host.temp,
              gpu_usage: host.gpu_usage,
              memory_usage: host.memory_usage,
              uptime_seconds: host.uptime_seconds
            }
          });
        }

        // --- SOCIAL ROUTES ---
        if (pathname === '/api/social/search' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          
          const query = url.searchParams.get('q') || '';
          const users = db.prepare(`
            SELECT id, username, display_name, avatar_color, last_seen 
            FROM users 
            WHERE (username LIKE ? OR display_name LIKE ?) AND is_active = 1
            LIMIT 10
          `).all(`%${query}%`, `%${query}%`) as any[];
          
          return sendJson(users);
        }

        if (pathname === '/api/social/users' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          const users = db.prepare(`
            SELECT id, username, display_name, avatar_color, gamerscore, last_seen,
            (SELECT status FROM queue WHERE user_id = users.id AND status = 'active') as active_status
            FROM users 
            WHERE is_active = 1
          `).all() as any[];

          const now = new Date();
          const socialUsers = users.map(u => {
            const lastSeen = new Date(u.last_seen);
            const diff = (now.getTime() - lastSeen.getTime()) / 1000;
            let status = 'offline';
            if (diff < 60) status = u.active_status ? 'in-game' : 'online';
            
            return {
              id: u.id,
              username: u.username,
              display_name: u.display_name,
              avatar_color: u.avatar_color,
              gamerscore: u.gamerscore,
              status
            };
          });

          return sendJson(socialUsers);
        }

        // --- PROFILE ROUTES ---
        if (pathname === '/api/user/profile' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          const data = db.prepare('SELECT id, username, display_name, avatar_color, bio, role, gamerscore FROM users WHERE id = ?').get(user.id);
          return sendJson(data);
        }

        if (pathname === '/api/user/profile' && req.method === 'POST') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { display_name, avatar_color, bio, gamerscore } = JSON.parse(body);
              db.prepare(`
                UPDATE users 
                SET display_name = ?, avatar_color = ?, bio = ?, gamerscore = COALESCE(?, gamerscore)
                WHERE id = ?
              `).run(display_name, avatar_color, bio, gamerscore, user.id);
              return sendJson({ success: true });
            } catch (e) {
              return sendJson({ message: 'Erro ao processar dados' }, 400);
            }
          });
          return;
        }

        // --- SETTINGS ROUTES ---
        if (pathname === '/api/user/settings' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user.id) as any;
          if (!settings) {
            db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(user.id);
            settings = { quality: '1080p', fps: 60, bitrate: 50 };
          }
          return sendJson(settings);
        }

        if (pathname === '/api/user/settings' && req.method === 'POST') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { quality, fps, bitrate } = JSON.parse(body);
              db.prepare('INSERT OR REPLACE INTO user_settings (user_id, quality, fps, bitrate) VALUES (?, ?, ?, ?)').run(user.id, quality, fps, bitrate);
              
              // Persist to config.json as requested
              const config = {
                userId: user.id,
                username: user.username,
                quality,
                fps,
                bitrate,
                updatedAt: new Date().toISOString()
              };
              fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
              
              sendJson({ success: true });
            } catch (e) { sendJson({ error: String(e) }, 500); }
          });
          return;
        }

        // --- TELEMETRY ROUTE ---
        if (pathname === '/api/host/telemetry' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          Promise.all([getGpuTemp(), getGpuUsage()]).then(([temp, usage]) => {
            db.prepare('UPDATE host_status SET temp = ?, gpu_usage = ? WHERE id = 1').run(temp, usage);
            sendJson({ temp, gpu_usage: usage });
          });
          return;
        }

        // --- NETWORK TEST ---
        if (pathname === '/api/network/ping' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          
          // Simulate network latency
          const latency = Math.floor(Math.random() * 30) + 10;
          return sendJson({ latency, status: 'stable' });
        }

        // --- HOST AGENT UPDATE ---
        if (pathname === '/api/host/update' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              let is_paused = 0;
              if (data.temp > 85 || data.is_charging === 0) is_paused = 1;
              
              const host = db.prepare('SELECT kill_pending, sync_library FROM host_status WHERE id = 1').get() as any;
              const kill_session = host.kill_pending === 1;
              const sync_library = host.sync_library === 1;

              db.prepare(`
                UPDATE host_status SET 
                  temp = ?, gpu_usage = ?, memory_usage = ?, encoder = ?, tailscale_ip = ?, uptime_seconds = ?, is_charging = ?, is_paused = ?, 
                  platform_status = ?, kill_pending = 0, last_update = CURRENT_TIMESTAMP 
                WHERE id = 1
              `).run(
                data.temp, data.gpu_usage, data.memory_usage, data.encoder || 'N/A', 
                data.tailscale_ip || '0.0.0.0', data.uptime_seconds || 0, data.is_charging ? 1 : 0, 
                is_paused, JSON.stringify(data.platform_status || {})
              );
              
              updateQueue();
              sendJson({ success: true, is_paused, kill_session, sync_library });
            } catch (e) { sendJson({ error: String(e) }, 500); }
          });
          return;
        }

        if (pathname === '/api/host/library' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { library } = JSON.parse(body);
              fs.writeFileSync('library.json', JSON.stringify(library, null, 2));
              db.prepare('UPDATE host_status SET sync_library = 0 WHERE id = 1').run();
              sendJson({ success: true });
            } catch (e) { sendJson({ error: String(e) }, 500); }
          });
          return;
        }

        if (pathname === '/api/user/library' && req.method === 'GET') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);

          try {
            if (fs.existsSync('library.json')) {
              const lib = JSON.parse(fs.readFileSync('library.json', 'utf8'));
              return sendJson(lib);
            }
            return sendJson([]);
          } catch (e) { return sendJson([], 500); }
        }

        if (pathname === '/api/library/sync' && req.method === 'POST') {
          const user = getAuthUser();
          if (!user) return sendJson({ message: 'Não autorizado' }, 401);
          db.prepare('UPDATE host_status SET sync_library = 1 WHERE id = 1').run();
          return sendJson({ success: true });
        }

        if (pathname === '/api/host/status' && req.method === 'GET') {
          const host = db.prepare('SELECT platform_status, temp, gpu_usage FROM host_status WHERE id = 1').get() as any;
          return sendJson({
            platformStatus: JSON.parse(host.platform_status || '{}'),
            temp: host.temp,
            gpuUsage: host.gpu_usage
          });
        }

        // If we reach here, it's an unhandled /api route
        sendJson({ message: 'Rota não encontrada' }, 404);
      } catch (e) {
        console.error("API Error:", e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal Server Error', details: String(e) }));
      }
    });
  }
};
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '.trycloudflare.com',
        '.cloudflare.com'
      ],
    },
  };
});
