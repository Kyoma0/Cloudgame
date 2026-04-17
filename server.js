/**
 * Cloudgame - Backend Server (Node.js/Express)
 * Roda localmente no PC host junto com o Sunshine
 * Porta: 3001
 *
 * Para rodar: node server.js
 * Dependências já no package.json: express, better-sqlite3, jsonwebtoken, bcryptjs, cors
 */

const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'cloudgame-secret-key-local-2024';

// ─── BANCO DE DADOS ──────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'gaming.db'));

// Cria tabelas se não existirem
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    quality TEXT DEFAULT '1080p',
    fps INTEGER DEFAULT 60,
    bitrate INTEGER DEFAULT 50,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS host_stats (
    id INTEGER PRIMARY KEY,
    temp REAL,
    gpu_usage REAL,
    memory_usage REAL,
    encoder TEXT,
    uptime_seconds INTEGER,
    platform_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Cria usuário admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('✅ Usuário admin criado: admin / admin123');
}

// ─── MIDDLEWARES ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*', // Permite qualquer origem (TV, celular, etc)
  credentials: true
}));
app.use(express.json());

// Middleware de autenticação JWT
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username e password obrigatórios' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, username } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username já existe' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// ─── HOST STATS (recebe dados do server_agent.js) ────────────────────────────
app.post('/api/host/update', (req, res) => {
  const stats = req.body;

  db.prepare(`
    INSERT OR REPLACE INTO host_stats (id, temp, gpu_usage, memory_usage, encoder, uptime_seconds, platform_status, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    stats.temp,
    stats.gpu_usage,
    stats.memory_usage,
    stats.encoder || 'NVENC (H.265)',
    stats.uptime_seconds,
    JSON.stringify(stats.platform_status || {})
  );

  // Verifica se algum cliente tem sessão ativa pra enviar comando
  const activeSession = db.prepare("SELECT * FROM queue WHERE status = 'active' LIMIT 1").get();
  res.json({
    sync_library: !fs.existsSync(path.join(__dirname, 'library.json')),
    kill_session: false,
    has_active_session: !!activeSession
  });
});

app.post('/api/host/library', (req, res) => {
  const { library } = req.body;
  fs.writeFileSync(path.join(__dirname, 'library.json'), JSON.stringify(library, null, 2));
  res.json({ success: true, count: library.length });
});

// ─── STATS (frontend busca) ──────────────────────────────────────────────────
app.get('/api/host/stats', authMiddleware, (req, res) => {
  const stats = db.prepare('SELECT * FROM host_stats WHERE id = 1').get();
  if (!stats) return res.json({ online: false });

  const updatedAt = new Date(stats.updated_at + 'Z');
  const secondsAgo = (Date.now() - updatedAt.getTime()) / 1000;

  res.json({
    online: secondsAgo < 15,
    seconds_ago: Math.round(secondsAgo),
    temp: stats.temp,
    gpu_usage: stats.gpu_usage,
    memory_usage: stats.memory_usage,
    encoder: stats.encoder,
    uptime_seconds: stats.uptime_seconds,
    platform_status: JSON.parse(stats.platform_status || '{}'),
    sunshine_url: `http://localhost:47990` // painel web do Sunshine
  });
});

// ─── BIBLIOTECA DE JOGOS ──────────────────────────────────────────────────────
app.get('/api/library', authMiddleware, (req, res) => {
  const libPath = path.join(__dirname, 'library.json');
  if (!fs.existsSync(libPath)) {
    // Retorna biblioteca mock enquanto o agent não rodou ainda
    return res.json([
      { id: 'mock_1', name: 'Cyberpunk 2077', platform: 'Steam', path: 'steam://run/1091500', image: 'https://picsum.photos/seed/cp77/400/225' },
      { id: 'mock_2', name: 'Fortnite', platform: 'Epic', path: 'com.epicgames.launcher://apps/Fortnite', image: 'https://picsum.photos/seed/fortnite/400/225' },
      { id: 'mock_3', name: 'The Witcher 3', platform: 'Steam', path: 'steam://run/292030', image: 'https://picsum.photos/seed/tw3/400/225' },
    ]);
  }
  const library = JSON.parse(fs.readFileSync(libPath, 'utf-8'));
  res.json(library);
});

// ─── FILA DE ACESSO ──────────────────────────────────────────────────────────
app.post('/api/queue/join', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // Remove entradas antigas do mesmo usuário
  db.prepare("DELETE FROM queue WHERE user_id = ? AND status IN ('waiting', 'active')").run(userId);

  // Verifica se já tem alguém com sessão ativa
  const activeSession = db.prepare("SELECT * FROM queue WHERE status = 'active'").get();

  let status = 'waiting';
  if (!activeSession) {
    status = 'active'; // Ninguém na fila, entra direto
  }

  const result = db.prepare(
    "INSERT INTO queue (user_id, status, activated_at) VALUES (?, ?, ?)"
  ).run(userId, status, status === 'active' ? new Date().toISOString() : null);

  const position = db.prepare(
    "SELECT COUNT(*) as pos FROM queue WHERE status = 'waiting' AND id <= ?"
  ).get(result.lastInsertRowid)?.pos || 0;

  res.json({ success: true, status, position });
});

app.get('/api/queue/status', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const entry = db.prepare("SELECT * FROM queue WHERE user_id = ? AND status IN ('waiting', 'active')").get(userId);

  if (!entry) return res.json({ inQueue: false });

  let position = 0;
  if (entry.status === 'waiting') {
    position = db.prepare(
      "SELECT COUNT(*) as pos FROM queue WHERE status = 'waiting' AND id <= ?"
    ).get(entry.id)?.pos || 0;
  }

  // Calcula tempo estimado de espera (15 min por pessoa na frente)
  const estimatedWait = position * 15;

  // IP do Sunshine para o Moonlight conectar (IP local ou Cloudflare)
  const hostIp = getLocalIp();

  res.json({
    inQueue: true,
    status: entry.status,
    position,
    estimatedWait,
    // Quando status = 'active', o cliente usa essa URL pra conectar no Sunshine via WebRTC
    sunshineUrl: entry.status === 'active' ? `http://${hostIp}:47990` : null,
    tailscaleIp: hostIp
  });
});

app.post('/api/queue/leave', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const entry = db.prepare("SELECT * FROM queue WHERE user_id = ? AND status = 'active'").get(userId);

  db.prepare("DELETE FROM queue WHERE user_id = ?").run(userId);

  // Se era o ativo, promove o próximo da fila
  if (entry) {
    const next = db.prepare("SELECT * FROM queue WHERE status = 'waiting' ORDER BY id ASC LIMIT 1").get();
    if (next) {
      db.prepare("UPDATE queue SET status = 'active', activated_at = CURRENT_TIMESTAMP WHERE id = ?").run(next.id);
      console.log(`✅ Próximo da fila promovido: user_id=${next.user_id}`);
    }
  }

  res.json({ success: true });
});

// ─── SOCIAL (usuários online) ─────────────────────────────────────────────────
app.get('/api/social/users', authMiddleware, (req, res) => {
  db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);

  const users = db.prepare(`
    SELECT id, username, last_seen,
      (SELECT status FROM queue WHERE user_id = users.id AND status IN ('waiting','active') LIMIT 1) as queue_status
    FROM users WHERE is_active = 1
  `).all();

  const now = Date.now();
  const result = users.map(u => {
    const lastSeen = new Date(u.last_seen + 'Z').getTime();
    const diffMinutes = (now - lastSeen) / 60000;
    let status = 'offline';
    if (diffMinutes < 2) status = 'online';
    else if (diffMinutes < 10) status = 'away';

    return {
      id: u.id,
      username: u.username,
      status,
      queue_status: u.queue_status || null
    };
  });

  res.json(result);
});

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
app.get('/api/user/settings', authMiddleware, (req, res) => {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
  res.json(settings || { quality: '1080p', fps: 60, bitrate: 50 });
});

app.post('/api/user/settings', authMiddleware, (req, res) => {
  const { quality, fps, bitrate } = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO user_settings (user_id, quality, fps, bitrate)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, quality, fps, bitrate);
  res.json({ success: true });
});

// ─── NETWORK ──────────────────────────────────────────────────────────────────
app.get('/api/network/ping', (req, res) => {
  res.json({ latency: Math.floor(Math.random() * 30) + 5, status: 'stable' });
});

// ─── SUNSHINE CONTROL ────────────────────────────────────────────────────────
// Verifica se o Sunshine está rodando
app.get('/api/sunshine/status', authMiddleware, (req, res) => {
  try {
    // Testa se a porta do Sunshine está aberta
    const http = require('http');
    const req2 = http.get('http://localhost:47990', (r) => {
      res.json({ running: true, port: 47990, web_ui: 'http://localhost:47990' });
    });
    req2.on('error', () => {
      res.json({ running: false, message: 'Sunshine não está rodando. Abra o Sunshine no PC host.' });
    });
    req2.setTimeout(2000, () => {
      req2.destroy();
      res.json({ running: false, message: 'Timeout ao verificar Sunshine' });
    });
  } catch (e) {
    res.json({ running: false, error: e.message });
  }
});

// ─── HELPER ───────────────────────────────────────────────────────────────────
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Tailscale usa range 100.x.x.x — preferência!
      if (net.family === 'IPv4' && net.address.startsWith('100.')) return net.address;
    }
  }
  // Fallback: primeiro IP privado não-loopback
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Cloudgame Backend - ONLINE         ║');
  console.log(`║     Porta: ${PORT}                        ║`);
  console.log(`║     IP Local: ${getLocalIp().padEnd(25)}║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints disponíveis:');
  console.log('  POST /api/auth/register   - Criar conta');
  console.log('  POST /api/auth/login      - Login');
  console.log('  GET  /api/host/stats      - Stats do PC (GPU/CPU/Temp)');
  console.log('  GET  /api/library         - Biblioteca de jogos');
  console.log('  POST /api/queue/join      - Entrar na fila');
  console.log('  GET  /api/queue/status    - Status da fila');
  console.log('  POST /api/queue/leave     - Sair da fila');
  console.log('  GET  /api/social/users    - Usuários online');
  console.log('  GET  /api/sunshine/status - Status do Sunshine');
  console.log('');
  console.log('▶ Agora rode também: node server_agent.js');
});
