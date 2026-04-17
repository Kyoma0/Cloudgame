import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Cpu, 
  Activity, 
  Terminal, 
  Users, 
  Shield, 
  LogOut, 
  Play, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  Trash2,
  UserPlus,
  Power,
  Zap,
  ChevronRight,
  Server,
  Home,
  Library,
  Settings,
  Search,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Globe,
  CheckCircle2,
  Signal,
  Volume2,
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  username: string;
  role: 'admin' | 'player';
  is_active: number;
  tailscale_ip: string;
}

interface HostStatus {
  temp: number;
  gpu_usage: number;
  memory_usage: number;
  encoder: string;
  tailscale_ip: string;
  uptime_seconds: number;
  is_charging: number;
  is_paused: number;
  last_update: string;
}

interface QueueItem {
  id: number;
  username: string;
  status: string;
  joined_at: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  tag: string;
  message: string;
}

// --- Components ---

const StatCard = ({ icon: Icon, label, value, subValue, color = "cyan" }: any) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="stat-card-premium group"
  >
    <div className="flex items-start justify-between mb-3">
      <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-accent/20 transition-colors">
        <Icon size={18} className={color === "cyan" ? "text-accent" : "text-danger"} />
      </div>
      {color === "cyan" && (
        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
      )}
    </div>
    <div>
      <p className="text-[10px] font-display font-bold uppercase tracking-widest text-text-dim mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-display font-bold tracking-tight text-text-main">{value}</p>
        {subValue && <p className="text-[10px] font-mono text-text-dim">{subValue}</p>}
      </div>
    </div>
  </motion.div>
);

const CodeBlock = ({ children, label }: any) => (
  <div className="glass rounded-lg font-mono text-[11px] p-4 relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    {label && <div className="text-text-dim text-[9px] uppercase tracking-widest mb-2 border-b border-line pb-1">{label}</div>}
    <div className="overflow-x-auto whitespace-pre text-text-main custom-scrollbar">
      {children}
    </div>
  </div>
);

// --- Electron Settings Component ---
const ElectronSettings = () => {
  const [tailscaleStatus, setTailscaleStatus] = useState<{ installed: boolean; connected: boolean; ip: string | null }>({ installed: false, connected: false, ip: null });
  const [moonlightInstalled, setMoonlightInstalled] = useState<boolean>(false);
  const [moonlightWebStatus, setMoonlightWebStatus] = useState<{ installed: boolean; running: boolean }>({ installed: false, running: false });
  const [loading, setLoading] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [hostIP, setHostIP] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (!window.cloudgame) return;
    try {
      const ts = await window.cloudgame.checkTailscale();
      setTailscaleStatus(ts);
      const ml = await window.cloudgame.checkMoonlight();
      setMoonlightInstalled(ml);
      const mw = await window.cloudgame.checkMoonlightWeb();
      setMoonlightWebStatus(mw);
      const config = await window.cloudgame.getConfig();
      if (config?.auth?.tailscaleAuthKey) setAuthKey(config.auth.tailscaleAuthKey);
      if (config?.host?.tailscaleIp) setHostIP(config.host.tailscaleIp);
    } catch (e) { console.error(e); }
  };

  const installTailscale = async () => {
    if (!window.cloudgame || !authKey) return;
    setLoading(true);
    try {
      const success = await window.cloudgame.installTailscale(authKey);
      if (success) {
        await window.cloudgame.saveConfig({ ...await window.cloudgame.getConfig(), auth: { tailscaleAuthKey: authKey } });
        await checkStatus();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startMoonlightWeb = async () => {
    if (!window.cloudgame) return;
    setLoading(true);
    try {
      await window.cloudgame.startMoonlightWeb(8080);
      await checkStatus();
      window.cloudgame.showMessage({ type: 'info', title: 'Sucesso', message: 'Moonlight Web Server iniciado!' });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const stopMoonlightWeb = async () => {
    if (!window.cloudgame) return;
    try {
      await window.cloudgame.stopMoonlightWeb();
      await checkStatus();
    } catch (e) { console.error(e); }
  };

  const openMoonlightWeb = () => {
    if (window.cloudgame) {
      window.cloudgame.openExternal('http://localhost:8080');
    } else {
      window.open('http://localhost:8080', '_blank');
    }
  };

  const saveHostIP = async () => {
    if (!window.cloudgame) return;
    const config = await window.cloudgame.getConfig() || {};
    await window.cloudgame.saveConfig({ ...config, host: { ...config.host, tailscaleIp: hostIP, apiUrl: 'http://localhost:3000/api' } });
    window.cloudgame.showMessage({ type: 'info', title: 'Salvo', message: 'IP do host salvo com sucesso!' });
  };

  return (
    <div className="mt-6 space-y-4 p-4 bg-white/5 border border-white/10 rounded-lg">
      <h3 className="text-lg font-display font-black uppercase text-accent">Configuração Cloudgame</h3>
      
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-text-dim uppercase">Tailscale</p>
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", tailscaleStatus.connected ? "bg-green-500" : "bg-red-500")} />
          <span className="text-sm">{tailscaleStatus.connected ? `Conectado: ${tailscaleStatus.ip}` : 'Desconectado'}</span>
        </div>
        {!tailscaleStatus.installed && (
          <div className="flex gap-2">
            <input 
              type="password" 
              value={authKey} 
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Auth Key Tailscale"
              className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm"
            />
            <button 
              onClick={installTailscale} 
              disabled={loading || !authKey}
              className="px-4 py-2 bg-accent text-bg font-bold uppercase text-xs rounded disabled:opacity-50"
            >
              Instalar
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-text-dim uppercase">Moonlight Web (Navegador)</p>
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", moonlightWebStatus.running ? "bg-green-500" : "bg-red-500")} />
          <span className="text-sm">{moonlightWebStatus.running ? 'Executando na porta 8080' : 'Parado'}</span>
        </div>
        <div className="flex gap-2">
          {!moonlightWebStatus.running ? (
            <button 
              onClick={startMoonlightWeb} 
              disabled={loading || !moonlightWebStatus.installed}
              className="px-4 py-2 bg-accent text-bg font-bold uppercase text-xs rounded disabled:opacity-50"
            >
              Iniciar Servidor
            </button>
          ) : (
            <button 
              onClick={stopMoonlightWeb} 
              className="px-4 py-2 bg-danger text-white font-bold uppercase text-xs rounded"
            >
              Parar
            </button>
          )}
          {moonlightWebStatus.running && (
            <button 
              onClick={openMoonlightWeb}
              className="px-4 py-2 bg-green-600 text-white font-bold uppercase text-xs rounded"
            >
              Abrir no Navegador
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-text-dim uppercase">Moonlight Desktop</p>
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", moonlightInstalled ? "bg-green-500" : "bg-red-500")} />
          <span className="text-sm">{moonlightInstalled ? 'Instalado' : 'Não encontrado'}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-text-dim uppercase">Host IP (Tailscale)</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={hostIP} 
            onChange={(e) => setHostIP(e.target.value)}
            placeholder="100.x.x.x"
            className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm font-mono"
          />
          <button 
            onClick={saveHostIP}
            className="px-4 py-2 bg-accent text-bg font-bold uppercase text-xs rounded"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Login Page ---
const Login = ({ onLogin }: { onLogin: (data: any) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success) {
        if (isRegister) {
          setSuccess('Cadastro realizado! Agora faça login.');
          setIsRegister(false);
          setPassword('');
        } else {
          onLogin(data);
        }
      } else {
        setError(data.message || 'Erro na operação');
      }
    } catch (e) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-raised p-10 relative"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.1)]">
            <Shield className="text-accent" size={32} />
          </div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-text-main mb-2">V-CLOUD</h1>
          <p className="text-xs text-text-dim uppercase tracking-[0.3em] font-medium">
            {isRegister ? 'Create New Account' : 'Secure Gaming Gateway'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-widest text-text-dim font-bold ml-1">Identity</label>
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-line p-4 rounded-lg font-sans text-sm focus:border-accent outline-none transition-all placeholder:text-text-dim/50"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-widest text-text-dim font-bold ml-1">Access Key</label>
            <div className="relative group">
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-line p-4 rounded-lg font-sans text-sm focus:border-accent outline-none transition-all placeholder:text-text-dim/50"
                required
              />
            </div>
          </div>

          {!isRegister && (
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
              <p className="text-[9px] font-bold text-accent uppercase tracking-widest text-center">
                Dica: Use admin / admin123 para acesso total
              </p>
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-danger text-[11px] font-bold uppercase flex items-center gap-2 bg-danger/10 p-3 rounded-lg border border-danger/20"
            >
              <AlertTriangle size={14} /> {error}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-accent text-[11px] font-bold uppercase flex items-center gap-2 bg-accent/10 p-3 rounded-lg border border-accent/20"
            >
              <RefreshCw size={14} /> {success}
            </motion.div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-premium btn-premium-primary py-4 rounded-lg"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" /> Processing
              </div>
            ) : isRegister ? 'Create Account' : 'Initialize Session'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setSuccess('');
            }}
            className="text-[10px] uppercase tracking-widest text-text-dim hover:text-accent transition-colors font-bold"
          >
            {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-line flex justify-between items-center text-[9px] text-text-dim font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>Node: US-WEST-2</span>
          </div>
          <span>v2.5.0-PRO</span>
        </div>
      </motion.div>
    </div>
  );
};

// --- Player Launcher (Xbox 360 Metro Style) ---
const PlayerLauncher = ({ token, onLogout }: any) => {
  const [status, setStatus] = useState<any>({ 
    inQueue: false, 
    status: 'waiting', 
    position: 0, 
    hostStats: { temp: 0, gpu_usage: 0 } 
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);
  const [activeTile, setActiveTile] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [socialUsers, setSocialUsers] = useState<any[]>([]);
  const [adminData, setAdminData] = useState<any>({ users: [], queue: [], logs: [], host: {}, activeSessions: [] });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem('vcloud_settings');
    return saved ? JSON.parse(saved) : { quality: '1080p', fps: 60, bitrate: 50 };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [socialSearchResults, setSocialSearchResults] = useState<any[]>([]);
  const [browserUrl, setBrowserUrl] = useState('');
  const [isBrowserMode, setIsBrowserMode] = useState(false);
  const [isLibraryMode, setIsLibraryMode] = useState(false);
  const [pingResult, setPingResult] = useState<number | null>(null);
  const [settingsCategory, setSettingsCategory] = useState<string | null>(null);
  const [library, setLibrary] = useState<any[]>([]);
  const [platformStatus, setPlatformStatus] = useState<any>({ steam: false, epic: false, gog: false });

  const auth = JSON.parse(localStorage.getItem('vcloud_auth') || '{}');
  const isAdmin = auth.user?.role === 'admin';

  const baseTabs = [
    { id: 'bing', label: 'BING', icon: Search },
    { id: 'home', label: 'HOME', icon: Home },
    { id: 'social', label: 'SOCIAL', icon: Users },
    { id: 'settings', label: 'SETTINGS', icon: Settings }
  ];

  const tabs = isAdmin ? [...baseTabs, { id: 'admin', label: 'ADMIN', icon: Shield }] : baseTabs;

  const playSound = (type: 'pop' | 'click' | 'woosh') => {
    const urls = {
      pop: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      woosh: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'
    };
    const audio = new Audio(urls[type]);
    audio.volume = 0.15;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const fetchHostStatus = async () => {
      try {
        const res = await fetch('/api/host/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.platformStatus) setPlatformStatus(data.platformStatus);
        
        // Update stats from host status too
        if (data.temp !== undefined) {
          setStatus((prev: any) => ({
            ...prev,
            hostStats: {
              ...prev.hostStats,
              temp: data.temp,
              gpu_usage: data.gpuUsage
            }
          }));
        }
      } catch (e) {}
    };

    const fetchLibrary = async () => {
      try {
        const res = await fetch('/api/user/library', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setLibrary(data || []);
      } catch (e) {}
    };

    fetchHostStatus();
    fetchLibrary();
    fetchProfile();
    if (isAdmin) fetchAdminData();
    
    const interval = setInterval(() => {
      fetchHostStatus();
      fetchStatus();
      if (activeTab === 2) fetchSocial();
      if (activeTab === 1) fetchLibrary();
      if (isAdmin && activeTab === tabs.findIndex(t => t.id === 'admin')) fetchAdminData();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, activeTab, isAdmin]);

  const fetchAdminData = async () => {
    try {
      const authHeader = { 'Authorization': `Bearer ${token}` };
      const [resData, resUsers] = await Promise.all([
        fetch('/api/admin/data', { headers: authHeader }),
        fetch('/api/admin/users', { headers: authHeader })
      ]);
      const data = await resData.json();
      const users = await resUsers.json();
      setAdminData({ ...data, users });
    } catch (e) {}
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data) setUserProfile(data);
    } catch (e) {}
  };

  const saveProfile = async (profileUpdate: any) => {
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(profileUpdate)
      });
      fetchProfile();
    } catch (e) {}
  };

  const searchSocial = async (q: string) => {
    if (!q) {
      setSocialSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/social/search?q=${encodeURIComponent(q)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setSocialSearchResults(data || []);
    } catch (e) {}
  };

  const adminToggleUser = async (id: number) => {
    await fetch(`/api/admin/users/toggle/${id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    fetchAdminData();
    playSound('click');
  };

  const adminDeleteUser = async (id: number) => {
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchAdminData();
    playSound('pop');
  };

  const adminToggleMaintenance = async () => {
    await fetch('/api/admin/maintenance/toggle', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    fetchAdminData();
    playSound('woosh');
  };

  const adminChangeRole = async (id: number, role: string) => {
    await fetch(`/api/admin/users/role/${id}`, { 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    fetchAdminData();
    playSound('click');
  };

  const adminClearQueue = async () => {
    await fetch('/api/admin/queue/clear', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    fetchAdminData();
    playSound('pop');
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/queue/status', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data && typeof data === 'object') {
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/data', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {}
  };

  const fetchSocial = async () => {
    try {
      const res = await fetch('/api/social/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      
      const filtered = isAdmin ? data : data.filter((u: any) => u.status !== 'offline');
      
      const sanitized = filtered.map((u: any) => ({
        ...u,
        username: u.id === auth.user?.id ? (u.display_name || auth.user?.username || 'Hanak') : u.username
      }));
      setSocialUsers(sanitized || []);
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/settings', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data) setUserSettings(data);
    } catch (e) {}
  };

  const saveSettings = async (newSettings: any) => {
    try {
      localStorage.setItem('vcloud_settings', JSON.stringify(newSettings));
      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setUserSettings(newSettings);
    } catch (e) {}
  };

  const runPingTest = async () => {
    try {
      const res = await fetch('/api/network/ping', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setPingResult(data.latency);
    } catch (e) {}
  };

  const joinQueue = async () => {
    try {
      await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchStatus();
    } catch (e) {}
  };

  const syncLibrary = async () => {
    try {
      await fetch('/api/library/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      playSound('click');
    } catch (e) {}
  };

  const launchLocalGame = (game: any) => {
    // In a real scenario, this would send a command to Python agent
    // For now, we open the URI if it's steam/epic
    if (game.path.startsWith('steam://') || game.path.startsWith('com.epicgames.launcher://')) {
      window.open(game.path, '_blank');
    }
    playSound('woosh');
  };

  const launchGame = async () => {
    const game = library[activeTile];
    const gameName = game?.name || 'Desktop';
    // Evitar usar 0.0.0.0 como host IP
    const rawHostIP = status?.tailscaleIp;
    const hostIP = (rawHostIP && rawHostIP !== '0.0.0.0') ? rawHostIP : '192.168.15.119';

    if (window.cloudgame) {
      try {
        const config = await window.cloudgame.getConfig();
        const ip = config?.host?.tailscaleIp || hostIP;
        await window.cloudgame.launchGame(ip, 0, gameName);
        playSound('woosh');
        return;
      } catch (e) { console.error('Electron launch error:', e); }
    }
    
    // Preferir streaming pelo navegador (Moonlight Web) primeiro
    try {
      const webUrl = `http://localhost:8080/?host=${encodeURIComponent(hostIP)}&app=${encodeURIComponent(gameName)}`;
      // Tenta iniciar o Moonlight Web se ainda não estiver rodando
      if ((window as any).cloudgame?.startMoonlightWeb) {
        try { await (window as any).cloudgame.startMoonlightWeb(8080); } catch {}
      }
      // Abre o streaming no navegador
      window.open(webUrl, '_blank');
      playSound('woosh');
      return;
    } catch (err) {
      // Fall back: tentar abrir Desktop Moonlight como último recurso
      try {
        const response = await fetch(`http://localhost:47999/?host=${encodeURIComponent(hostIP)}&app=${encodeURIComponent(gameName)}`);
        if (response.ok) {
          playSound('woosh');
          return;
        }
      } catch (_) {}
      // Se ainda não der, instruções manuais
      alert(`Moonlight Launcher não está rodando.\n\nHost: ${hostIP}\nJogo: ${gameName}\n\nExecute: resources\\iniciar-cloudgame.ps1`);
    }
    
    playSound('woosh');
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchSocial();
    fetchSettings();
    const interval = setInterval(() => {
      fetchStatus();
      if (showGuide) fetchLogs();
      if (activeTab === 2) fetchSocial();
    }, 3000);
    return () => clearInterval(interval);
  }, [showGuide, activeTab]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 0 && activeTile === 0) {
      searchInputRef.current?.focus();
    } else {
      containerRef.current?.focus();
    }

    // Clamp activeTile when switching tabs or data changes
    let max = 0;
    const adminIdx = tabs.findIndex(t => t.id === 'admin');
    if (isLibraryMode) {
      max = Math.max(0, library.length - 1);
    } else {
      if (activeTab === 0) max = 0;
      else if (activeTab === 1) max = 4;
      else if (activeTab === 2) max = Math.max(0, socialUsers.length - 1);
      else if (activeTab === 3) {
        if (!settingsCategory) max = 2; // Vídeo, Rede, Perfil
        else {
          if (settingsCategory === 'video') max = 4;
          else if (settingsCategory === 'network') max = 0;
          else if (settingsCategory === 'profile') max = 5;
        }
      } else if (adminIdx !== -1 && activeTab === adminIdx) {
        max = Math.max(0, adminData.users.length - 1);
      }
    }
    
    if (activeTile > max) setActiveTile(0);
  }, [activeTab, activeTile, socialUsers.length, settingsCategory, isLibraryMode, library.length, adminData.users.length]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGuide) {
        if (e.key === 'Escape' || e.key === 'g') setShowGuide(false);
        return;
      }

      if (isLibraryMode) {
        if (e.key === 'Escape' || e.key === 'b') {
          setIsLibraryMode(false);
          setActiveTile(1);
          playSound('woosh');
          return;
        }
        if (e.key === 'ArrowUp') {
          if (activeTile >= 4) {
            setActiveTile(prev => prev - 4);
            playSound('pop');
          }
        } else if (e.key === 'ArrowDown') {
          if (activeTile + 4 < library.length) {
            setActiveTile(prev => prev + 4);
            playSound('pop');
          }
        } else if (e.key === 'ArrowLeft') {
          if (activeTile > 0) {
            setActiveTile(prev => prev - 1);
            playSound('pop');
          }
        } else if (e.key === 'ArrowRight') {
          if (activeTile < library.length - 1) {
            setActiveTile(prev => prev + 1);
            playSound('pop');
          }
        } else if (e.key === 'Enter') {
          handleAction();
        }
        return;
      }

      if (isBrowserMode) {
        if (e.key === 'Escape' || e.key === 'b') {
          setIsBrowserMode(false);
          playSound('click');
        }
        return;
      }

      if (settingsCategory) {
        if (e.key === 'Escape' || e.key === 'b') {
          e.preventDefault();
          setSettingsCategory(null);
          setActiveTile(activeTab === 3 ? (settingsCategory === 'video' ? 0 : (settingsCategory === 'network' ? 1 : 2)) : 0);
          playSound('click');
          return;
        }
        if (e.key === 'ArrowUp' && activeTile > 0) {
          setActiveTile(prev => prev - 1);
          playSound('pop');
        }
        if (e.key === 'ArrowDown') {
          let max = 0;
          if (settingsCategory === 'video') max = 4;
          else if (settingsCategory === 'network') max = 0;
          else if (settingsCategory === 'profile') max = 1;

          if (activeTile < max) {
            setActiveTile(prev => prev + 1);
            playSound('pop');
          }
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAction();
        }
        return;
      }

       // Global Tab Switching (Left/Right)
      if (e.key === 'ArrowLeft' && !settingsCategory && !isBrowserMode) {
        if (activeTab > 0) {
          setActiveTab(prev => prev - 1);
          setActiveTile(0);
          playSound('woosh');
        }
        return;
      }
      if (e.key === 'ArrowRight' && !settingsCategory && !isBrowserMode) {
        if (activeTab < tabs.length - 1) {
          setActiveTab(prev => prev + 1);
          setActiveTile(0);
          playSound('woosh');
        }
        return;
      }

      // Vertical Tile Navigation (Up/Down)
      if (e.key === 'ArrowUp') {
        if (activeTile > 0) {
          setActiveTile(prev => prev - 1);
          playSound('pop');
        }
      } else if (e.key === 'ArrowDown') {
        let maxTiles = 0;
        const adminIdx = tabs.findIndex(t => t.id === 'admin');
        
        if (activeTab === 0) maxTiles = 0;
        else if (activeTab === 1) maxTiles = 4;
        else if (activeTab === 2) maxTiles = Math.max(0, socialUsers.length - 1);
        else if (activeTab === 3) {
          if (!settingsCategory) maxTiles = 2;
          else {
            if (settingsCategory === 'video') maxTiles = 4;
            else if (settingsCategory === 'network') maxTiles = 0;
            else if (settingsCategory === 'profile') maxTiles = 5;
          }
        }
        else if (adminIdx !== -1 && activeTab === adminIdx) {
          maxTiles = Math.max(0, adminData.users.length - 1);
        }

        if (activeTile < maxTiles) {
          setActiveTile(prev => prev + 1);
          playSound('pop');
        }
      } else if (e.key === 'Enter') {
        playSound('click');
        handleAction();
      } else if (e.key === 'g') {
        setShowGuide(true);
        playSound('click');
      } else if (e.key === 'Escape' || e.key === 'b') {
        // Back button simulation / Browser exit
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          playSound('pop');
          return;
        }
        
        if (isBrowserMode) {
          setIsBrowserMode(false);
          playSound('woosh');
        } else if (settingsCategory) {
          setSettingsCategory(null);
          setActiveTile(0);
          playSound('woosh');
        } else if (activeTab !== 1) {
          setActiveTab(1);
          setActiveTile(0);
          playSound('woosh');
        }
      } else if (e.key === 'y') {
        // Shortcut for queue status
        playSound('click');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeTile, showGuide, status]);

  const selectSettingsCategory = (cat: 'video' | 'network' | 'profile') => {
    playSound('click');
    setSettingsCategory(cat);
    setActiveTile(0);
  };

  const handleAction = () => {
    if (isLibraryMode) {
      const game = library[activeTile];
      if (game) launchLocalGame(game);
      return;
    }

    if (activeTab === 0) {
      if (document.activeElement !== searchInputRef.current) {
        searchInputRef.current?.focus();
        playSound('pop');
      } else if (searchQuery.trim()) {
        const url = searchQuery.startsWith('http') ? searchQuery : `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&kp=-2`;
        setBrowserUrl(url);
        setIsBrowserMode(true);
        playSound('woosh');
      }
    } else if (activeTab === 1) {
      if (activeTile === 0) {
        if (status?.status === 'active' || status?.position === 1) launchGame();
        else if (!status?.inQueue) joinQueue();
        playSound('click');
      } else if (activeTile === 1) {
        setIsLibraryMode(true);
        setActiveTile(0);
        playSound('woosh');
      }
    } else if (activeTab === 2) {
      const user = socialUsers[activeTile];
      if (user?.status === 'in-game') {
        playSound('woosh');
      }
    } else if (activeTab === 3) {
      if (!settingsCategory) {
        if (activeTile === 0) setSettingsCategory('video');
        else if (activeTile === 1) setSettingsCategory('network');
        else if (activeTile === 2) setSettingsCategory('profile');
        setActiveTile(0);
        playSound('click');
      } else {
        if (settingsCategory === 'video') {
          if (activeTile < 2) {
            const options = ['1080p', '4K'];
            saveSettings({ ...userSettings, quality: options[activeTile] } as any);
          } else {
            const bitrates = [20, 50, 100];
            saveSettings({ ...userSettings, bitrate: bitrates[activeTile - 2] } as any);
          }
        } else if (settingsCategory === 'network') {
          if (activeTile === 0) runPingTest();
        } else if (settingsCategory === 'profile') {
          if (activeTile === 1) {
            onLogout();
            return;
          }
        }
        playSound('click');
      }
    } else if (activeTab === tabs.findIndex(t => t.id === 'admin')) {
      const user = adminData.users[activeTile];
      if (user) adminToggleUser(user.id);
    }
  };

  if (loading && !status?.tailscaleIp) return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center">
      <RefreshCw className="text-accent animate-spin" size={32} />
    </div>
  );

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="min-h-screen xbox-bg text-text-main font-sans overflow-hidden relative outline-none select-none"
    >
      {/* Moving Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent/10 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full animate-float" style={{ animationDelay: '-5s' }} />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full animate-float" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Top Navigation (Metro Tabs) */}
      <div className="relative z-20 pt-16 px-24">
        <div className="flex items-end gap-12">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(idx); setActiveTile(0); playSound('woosh'); }}
              className={cn(
                "pb-2 font-display font-black uppercase tracking-tighter transition-all duration-300 border-b-4",
                activeTab === idx 
                  ? "text-5xl text-white border-accent" 
                  : "text-2xl text-text-dim border-transparent hover:text-white/60"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area (Metro Grid) */}
      <div className="relative z-10 h-[calc(100vh-240px)] flex items-center px-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            {activeTab === 1 && (
              <div className="relative w-full h-full">
                {/* Standard Home View */}
                <AnimatePresence mode="wait">
                  {!isLibraryMode ? (
                    <motion.div 
                      key="home-grid"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="grid grid-cols-12 gap-1 items-start"
                    >
                      {/* Main Large Tile (Action Center) */}
                      <div className="col-span-12 xl:col-span-6">
                        <div 
                          onClick={() => setActiveTile(0)}
                          className={cn(
                            "xbox-tile xbox-glossy aspect-video p-10 flex flex-col justify-between cursor-pointer border-2 transition-all relative overflow-hidden group",
                            activeTile === 0 ? "xbox-tile-active scale-[1.02] shadow-[0_0_50px_rgba(0,229,255,0.3)]" : "border-transparent"
                          )}
                        >
                          <img 
                            src="https://picsum.photos/seed/gaming/1200/800" 
                            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          
                          <div className="relative z-10">
                            <h2 className="text-4xl xl:text-5xl font-display font-black uppercase tracking-tighter leading-none mb-4 italic">
                              {status?.status === 'active' ? 'Continuar Jogando' : 'Pronto para Jogar'}
                            </h2>
                            <p className="text-sm font-bold text-accent uppercase tracking-widest flex items-center gap-3">
                              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                              V-CLOUD System Online
                            </p>
                          </div>
                          
                          <div className="flex items-end justify-between z-10">
                            <div className="flex items-center gap-6">
                              {(status?.status === 'active' || status?.position === 1) ? (
                                <button onClick={(e) => { e.stopPropagation(); launchGame(); }} className="vcloud-btn-primary flex items-center gap-3 group-hover:scale-105 transition-transform">
                                  <Play size={24} fill="currentColor" /> INICIAR SISTEMA
                                </button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); joinQueue(); }} className="vcloud-btn-primary flex items-center gap-3">
                                  {status?.inQueue ? `AGUARDANDO (#${status.position})` : 'ENTRAR NA FILA'}
                                </button>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-tighter text-text-dim">Host Server</p>
                              <p className="text-lg font-display font-black uppercase tracking-tighter">SÃO PAULO • BR</p>
                            </div>
                          </div>

                          {/* Decorative Icon */}
                          <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Zap size={180} />
                          </div>
                        </div>
                      </div>

                      {/* Secondary Tiles Column 1 */}
                      <div className="col-span-12 xl:col-span-3 space-y-4">
                        <div 
                          onClick={() => { setIsLibraryMode(true); setActiveTile(1); playSound('woosh'); }}
                          className={cn(
                            "xbox-tile xbox-glossy aspect-square p-6 flex flex-col justify-between cursor-pointer border-2 transition-all group",
                            activeTile === 1 ? "xbox-tile-active scale-[1.02]" : "border-transparent"
                          )}
                        >
                          <div className="w-12 h-12 bg-accent/20 rounded-sm flex items-center justify-center text-accent border border-accent/20">
                            <Library size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-black uppercase tracking-tighter leading-none mb-1">Meus Jogos</h3>
                            <p className="text-[10px] font-bold text-text-dim uppercase">{library.length} Títulos Instalados</p>
                            <div className="flex gap-2 mt-4">
                              <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]", platformStatus.steam ? "bg-accent" : "bg-white/10")} />
                              <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]", platformStatus.epic ? "bg-accent" : "bg-white/10")} />
                              <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]", platformStatus.gog ? "bg-accent" : "bg-white/10")} />
                            </div>
                          </div>
                        </div>

                        <div 
                          onClick={() => setActiveTile(2)}
                          className={cn(
                            "xbox-tile xbox-glossy aspect-[2/1] p-6 flex items-center gap-4 cursor-pointer border-2 transition-all",
                            activeTile === 2 ? "xbox-tile-active scale-[1.02]" : "border-transparent"
                          )}
                        >
                          <div className="w-10 h-10 bg-white/5 rounded-sm flex items-center justify-center">
                            <Activity size={20} className="text-accent" />
                          </div>
                          <div>
                            <h3 className="text-sm font-display font-black uppercase tracking-tighter">Fila</h3>
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">
                              {status.inQueue ? `Posição #${status.position}` : 'Status: Off'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Secondary Tiles Column 2 */}
                      <div className="col-span-12 xl:col-span-3 space-y-4">
                        <div 
                          onClick={() => setActiveTile(3)}
                          className={cn(
                            "xbox-tile xbox-glossy aspect-square p-6 flex flex-col justify-between cursor-pointer relative overflow-hidden border-2 transition-all",
                            activeTile === 3 ? "xbox-tile-active scale-[1.02]" : "border-transparent"
                          )}
                        >
                          <div className="w-12 h-12 bg-white/5 rounded-sm flex items-center justify-center">
                            <Monitor size={24} className="text-accent" />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-black uppercase tracking-tighter leading-none mb-1">Host Info</h3>
                            <p className="text-[10px] font-bold text-text-dim uppercase tracking-tighter">Nitro V • RTX 3050</p>
                            <p className="text-2xl font-display font-black text-white mt-1">{Math.round(status.hostStats?.temp || 0)}°C</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); syncLibrary(); }}
                            className="absolute bottom-4 right-4 text-[8px] font-black uppercase tracking-widest text-accent/40 hover:text-accent transition-colors"
                          >
                            Update Lib
                          </button>
                        </div>

                        {/* Projects / Integration Tile (Locked) */}
                        <div 
                          onClick={() => setActiveTile(4)}
                          className={cn(
                            "xbox-tile xbox-glossy aspect-[2/1] p-6 flex items-center gap-4 cursor-pointer border-2 transition-all opacity-50 grayscale",
                            activeTile === 4 ? "xbox-tile-active scale-[1.02]" : "border-transparent"
                          )}
                        >
                          <div className="w-10 h-10 bg-white/5 rounded-sm flex items-center justify-center">
                            <Shield size={20} className="text-text-dim" />
                          </div>
                          <div>
                            <h3 className="text-sm font-display font-black uppercase tracking-tighter text-text-dim">Projeto Delta</h3>
                            <p className="text-[8px] font-bold text-danger uppercase tracking-[0.2em]">BLOQUEADO</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="library-overlay"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 z-50 bg-[#050608]/95 backdrop-blur-3xl rounded-lg overflow-hidden flex flex-col p-8 border border-white/5 shadow-2xl"
                    >
                      <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/5">
                         <div className="flex items-center gap-8">
                            <div className="w-20 h-20 bg-accent/20 rounded-sm flex items-center justify-center border border-accent/40 shadow-[0_0_40px_rgba(0,229,255,0.2)]">
                               <Gamepad2 size={40} className="text-accent" />
                            </div>
                            <div>
                               <h2 className="text-4xl font-display font-black uppercase tracking-tighter leading-none italic">Minha Biblioteca</h2>
                               <p className="text-sm text-accent font-bold uppercase tracking-widest mt-1">{library.length} Games Installed</p>
                            </div>
                         </div>
                         <div className="flex gap-4">
                            <button 
                              onClick={() => { setIsLibraryMode(false); setActiveTile(1); }}
                              className="px-8 py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center gap-3"
                            >
                              <ArrowLeft size={16} /> Voltar
                            </button>
                            <button 
                              onClick={syncLibrary}
                              className="px-8 py-3 bg-accent text-bg text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent/80 transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)] flex items-center gap-3"
                            >
                              <RefreshCw size={16} /> Scan
                            </button>
                         </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                        <div className="grid grid-cols-4 gap-6 p-2">
                          {library.length > 0 ? (
                            library.map((game, idx) => (
                              <div 
                                key={game.id || idx}
                                onClick={() => setActiveTile(idx)}
                                className={cn(
                                  "xbox-tile xbox-glossy aspect-[3/4] group cursor-pointer border-2 transition-all duration-300 relative overflow-hidden",
                                  activeTile === idx ? "xbox-tile-active scale-[1.08] z-10 shadow-[0_0_50px_rgba(0,229,255,0.5)] border-accent" : "border-white/5 grayscale-[0.2]"
                                )}
                              >
                                <img 
                                  src={game.image || `https://picsum.photos/seed/${game.name}/600/800`} 
                                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent opacity-80" />
                                
                                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 to-transparent">
                                  <h3 className="text-sm font-display font-black uppercase tracking-tighter leading-tight mb-2 drop-shadow-lg line-clamp-1">{game.name}</h3>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-accent tracking-widest">{game.platform}</span>
                                    {activeTile === idx && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); launchLocalGame(game); }}
                                        className="bg-accent text-bg px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-xs shadow-lg"
                                      >
                                        Launch
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-full h-96 flex flex-col items-center justify-center bg-white/5 border-2 border-dashed border-white/10 rounded-lg backdrop-blur-md">
                              <Gamepad2 size={64} className="text-white/5 mb-6" />
                              <p className="text-text-dim text-xl font-display font-black uppercase tracking-widest mb-6 border-b border-white/5 pb-2 px-8">Nenhum jogo encontrado</p>
                              <button 
                                onClick={syncLibrary} 
                                className="px-12 py-4 bg-accent text-bg font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-xl"
                              >
                                Scanear PC
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 0 && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {!isBrowserMode ? (
                  <div className="w-full max-w-3xl">
                    <div className={cn(
                      "bg-white/5 border-2 p-6 flex items-center gap-6 transition-all mb-8 shadow-xl backdrop-blur-md",
                      activeTile === 0 ? "border-accent bg-white/10 shadow-[0_0_30px_rgba(0,229,255,0.2)]" : "border-transparent"
                    )}>
                      <Search className="text-accent" size={32} />
                      <input 
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const url = searchQuery.startsWith('http') ? searchQuery : `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&kp=-2`;
                            setBrowserUrl(url);
                            setIsBrowserMode(true);
                            playSound('woosh');
                          }
                        }}
                        placeholder="Pesquisar com DuckDuckGo..."
                        className="bg-transparent border-none outline-none text-3xl font-display font-black uppercase tracking-tighter w-full placeholder:text-white/20 text-white"
                      />
                    </div>
                    <div 
                      onClick={() => handleAction()}
                      className={cn(
                        "xbox-tile xbox-glossy aspect-video bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-all",
                        activeTile === 0 && "xbox-tile-active scale-[1.02]"
                      )}
                    >
                      <Globe size={80} className="text-accent/20 mb-6" />
                      <div className="text-center">
                        <p className="text-2xl font-display font-black uppercase tracking-widest text-white mb-2">Browser V-Cloud</p>
                        <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Pressione ENTER para Navegar</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col bg-bg">
                    <div className="flex justify-between items-center bg-black/50 p-3 px-6 rounded-t-lg">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-danger"></div>
                         <p className="text-[10px] font-bold text-accent uppercase tracking-widest truncate max-w-sm">{browserUrl}</p>
                      </div>
                      <button onClick={() => setIsBrowserMode(false)} className="text-[10px] font-black bg-danger/20 text-danger px-3 py-1 uppercase tracking-widest border border-danger/30 hover:bg-danger hover:text-white transition-all">Fechar (ESC)</button>
                    </div>
                    <div className="flex-1 bg-white overflow-hidden shadow-2xl border-x-4 border-b-4 border-accent/20">
                      <iframe 
                        src={browserUrl} 
                        className="w-full h-full border-none"
                        title="V-CLOUD Browser"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 2 && (
              <div className="grid grid-cols-12 gap-8 items-start h-full">
                {/* Profile Card */}
                <div className="col-span-12 xl:col-span-4">
                  <div className="xbox-tile xbox-glossy p-8 border-accent/30 bg-white/5">
                    <div className="flex items-center gap-6 mb-8">
                      <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center text-bg shadow-xl border-4 border-white/20",
                        userProfile?.avatar_color === 'red' ? "bg-red-500" : 
                        userProfile?.avatar_color === 'purple' ? "bg-purple-500" : "bg-accent"
                      )}>
                        <Users size={40} />
                      </div>
                      <div>
                        <h2 className="text-3xl font-display font-black uppercase tracking-tighter italic">{userProfile?.display_name || auth.user?.username || 'Hanak'}</h2>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">{userProfile?.role === 'admin' ? 'V-CLOUD ADMIN' : 'V-CLOUD GOLD MEMBER'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {userProfile?.bio && (
                        <div className="p-3 bg-white/5 border border-white/5 rounded-sm mb-4">
                           <p className="text-[9px] font-bold text-text-dim uppercase mb-1">Bio</p>
                           <p className="text-xs text-white italic">"{userProfile.bio}"</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Status</span>
                        <span className="text-accent font-black">Online</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">GamerScore</span>
                        <span className="text-white font-black">{userProfile?.gamerscore?.toLocaleString() || '124,530'} G</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Friends List & Search */}
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-3 h-full overflow-hidden">
                  <div className={cn(
                    "flex items-center gap-4 bg-white/5 border-2 p-4 transition-all mb-2 shadow-lg backdrop-blur-md",
                    activeTile === -1 ? "border-accent bg-white/10" : "border-transparent"
                  )}>
                    <Search size={20} className="text-accent" />
                    <input 
                      type="text" 
                      placeholder="Procurar amigos por Gamertag..."
                      value={socialSearchQuery}
                      onChange={(e) => {
                        setSocialSearchQuery(e.target.value);
                        searchSocial(e.target.value);
                      }}
                      className="bg-transparent border-none outline-none text-xl font-display font-black uppercase tracking-tighter w-full placeholder:text-white/20 text-white"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-3">
                    {/* Search Results Header */}
                    {socialSearchResults.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 px-2">Usuários Encontrados</p>
                        {socialSearchResults.map((u) => (
                           <div key={u.id} className="xbox-tile xbox-glossy flex items-center justify-between p-4 bg-accent/5 border border-accent/20 mb-2">
                              <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-black", u.avatar_color === 'red' ? 'bg-red-500' : u.avatar_color === 'purple' ? 'bg-purple-500' : 'bg-accent text-bg')}>
                                  {u.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-display font-black uppercase tracking-tighter text-md italic text-white">{u.display_name || u.username}</p>
                                  <p className="text-[8px] font-bold text-text-dim uppercase tracking-widest">@{u.username}</p>
                                </div>
                              </div>
                              <button className="px-4 py-1.5 bg-accent text-bg text-[9px] font-black uppercase tracking-widest rounded-xs hover:scale-105 transition-transform">Adicionar</button>
                           </div>
                        ))}
                        <div className="h-px bg-white/10 my-4" />
                        <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 px-2">Meus Amigos</p>
                      </div>
                    )}

                    {socialUsers.filter(u => 
                      u.username.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
                      (u.display_name && u.display_name.toLowerCase().includes(socialSearchQuery.toLowerCase()))
                    ).length > 0 ? socialUsers.filter(u => 
                      u.username.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
                      (u.display_name && u.display_name.toLowerCase().includes(socialSearchQuery.toLowerCase()))
                    ).map((u, idx) => (
                    <div 
                      key={u.id}
                      onClick={() => setActiveTile(idx)}
                      className={cn(
                        "xbox-tile xbox-glossy flex items-center justify-between p-5 transition-all cursor-pointer border-l-4",
                        activeTile === idx ? "xbox-tile-active border-l-accent bg-white/10 scale-[1.01]" : "border-l-transparent bg-white/5 hover:bg-white/8"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-sm font-black border-2",
                          u.avatar_color === 'red' ? "bg-red-500 border-red-400" : 
                          u.avatar_color === 'purple' ? "bg-purple-500 border-purple-400" : "bg-accent border-accent text-bg"
                        )}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-display font-black uppercase tracking-tighter text-xl italic">{u.display_name || u.username}</h4>
                          <div className="flex items-center gap-3">
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-[0.1em]",
                              u.status === 'online' ? "text-accent" : 
                              u.status === 'in-game' ? "text-purple-400" : "text-text-dim"
                            )}>
                              {u.status === 'in-game' ? 'Jogando Agora' : (u.status === 'online' ? 'Conectado' : 'Offline')}
                            </p>
                            {u.status === 'in-game' && (
                              <span className="px-2 py-0.5 bg-accent text-bg text-[8px] font-black rounded-xs animate-pulse">LIVE</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {u.status === 'in-game' && (
                        <div className="px-5 py-2 bg-accent/10 border border-accent/30 rounded-full text-[9px] font-black text-accent uppercase tracking-widest hover:bg-accent hover:text-bg transition-colors">
                          Unir-se
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-lg backdrop-blur-md">
                      <Users size={48} className="mx-auto text-white/5 mb-6" />
                      <p className="text-text-dim font-display font-black uppercase tracking-widest">Nenhum amigo online</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

            {activeTab === 3 && (
              <div className="grid grid-cols-12 gap-8 h-full relative">
                <div className="col-span-5 flex flex-col gap-4">
                    { [
                      { id: 'video', label: 'Vídeo', icon: Monitor, value: `${userSettings.quality} / ${userSettings.bitrate}Mbps` },
                      { id: 'network', label: 'Rede', icon: Signal, value: pingResult ? `${pingResult}ms` : 'Teste de Rede' },
                      { id: 'profile', label: 'Perfil', icon: Users, value: 'Gerenciar Conta' }
                    ].map((item, idx) => (
                      <div 
                        key={item.id}
                        onClick={() => selectSettingsCategory(item.id as any)}
                        className={cn(
                          "xbox-tile xbox-glossy p-6 flex items-center justify-between cursor-pointer transition-all border-l-4",
                          activeTile === idx && !settingsCategory ? "xbox-tile-active border-l-accent" : 
                          settingsCategory === item.id ? "bg-accent/10 border-l-accent" : "border-l-transparent bg-white/5"
                        )}
                      >
                      <div className="flex items-center gap-4">
                        <item.icon className="text-accent" size={24} />
                        <h3 className="font-display font-black uppercase tracking-tighter text-xl">{item.label}</h3>
                      </div>
                      <span className="text-xs font-bold text-text-dim uppercase tracking-widest">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="col-span-7">
                  <AnimatePresence mode="wait">
                    {settingsCategory && (
                      <motion.div
                        key={settingsCategory}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="xbox-tile xbox-glossy p-8 bg-black/60 border-accent/30 h-full"
                      >
                        <h2 className="text-3xl font-display font-black uppercase tracking-tighter mb-8 text-accent">
                          {settingsCategory === 'video' ? 'Configurações de Vídeo' : 
                           settingsCategory === 'network' ? 'Diagnóstico de Rede' : 'Perfil do Usuário'}
                        </h2>
                        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {settingsCategory === 'video' ? (
                            <>
                              <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2">Resolução</p>
                              {['1080p', '4K'].map((opt, idx) => (
                                <div 
                                  key={opt}
                                  onClick={() => { setActiveTile(idx); handleAction(); }}
                                  className={cn(
                                    "p-4 border-2 transition-all cursor-pointer font-display font-black uppercase tracking-widest text-sm",
                                    activeTile === idx ? "border-accent bg-accent text-bg" : "border-white/10 hover:border-white/30"
                                  )}
                                >
                                  {opt}
                                </div>
                              ))}
                              <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mt-4 mb-2">Bitrate</p>
                              {['20 Mbps', '50 Mbps', '100 Mbps'].map((opt, idx) => (
                                <div 
                                  key={opt}
                                  onClick={() => { setActiveTile(idx + 2); handleAction(); }}
                                  className={cn(
                                    "p-4 border-2 transition-all cursor-pointer font-display font-black uppercase tracking-widest text-sm",
                                    activeTile === (idx + 2) ? "border-accent bg-accent text-bg" : "border-white/10 hover:border-white/30"
                                  )}
                                >
                                  {opt}
                                </div>
                              ))}
                            </>
                          ) : settingsCategory === 'network' ? (
                            <>
                              <div 
                                onClick={() => { setActiveTile(0); handleAction(); }}
                                className={cn(
                                  "p-4 border-2 transition-all cursor-pointer font-display font-black uppercase tracking-widest text-sm",
                                  activeTile === 0 ? "border-accent bg-accent text-bg" : "border-white/10 hover:border-white/30"
                                )}
                              >
                                Executar Teste de Ping
                              </div>
                              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-sm">
                                <p className="text-[10px] font-bold text-text-dim uppercase mb-1">Tailscale IP</p>
                                <p className="text-lg font-mono text-white">{status.tailscaleIp || '0.0.0.0'}</p>
                              </div>
                              {window.cloudgame && (
                                <ElectronSettings />
                              )}
                            </>
                          ) : (
                            <div className="space-y-4">
                              <div 
                                className={cn(
                                  "p-4 bg-white/5 border-2 transition-all rounded-sm relative",
                                  activeTile === 0 ? "border-accent bg-accent/10" : "border-white/10"
                                )}
                              >
                                <p className="text-[8px] font-bold text-text-dim uppercase mb-1 tracking-widest">Apelido (Display Name)</p>
                                <input 
                                  type="text"
                                  value={userProfile?.display_name || ''}
                                  onChange={(e) => saveProfile({ ...userProfile, display_name: e.target.value })}
                                  className="bg-transparent border-none outline-none text-xl font-display font-black text-white italic w-full"
                                  placeholder="Como quer ser chamado..."
                                />
                              </div>

                              <div 
                                className={cn(
                                  "p-4 bg-white/5 border-2 transition-all rounded-sm relative",
                                  activeTile === 1 ? "border-accent bg-accent/10" : "border-white/10"
                                )}
                              >
                                <p className="text-[8px] font-bold text-text-dim uppercase mb-1 tracking-widest">Sobre Mim (Bio)</p>
                                <input 
                                  type="text"
                                  value={userProfile?.bio || ''}
                                  onChange={(e) => saveProfile({ ...userProfile, bio: e.target.value })}
                                  className="bg-transparent border-none outline-none text-sm text-white italic w-full"
                                  placeholder="Uma frase curta..."
                                />
                              </div>

                              <div className="flex gap-4">
                                {['cyan', 'red', 'purple'].map((color, idx) => (
                                  <div 
                                    key={color}
                                    onClick={() => { setActiveTile(idx + 2); saveProfile({ ...userProfile, avatar_color: color }); }}
                                    className={cn(
                                      "w-12 h-12 rounded-full cursor-pointer border-4 transition-all flex items-center justify-center",
                                      activeTile === (idx + 2) ? "scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "border-transparent opacity-50 shadow-none",
                                      color === 'cyan' ? "bg-accent" : color === 'red' ? "bg-red-500" : "bg-purple-500"
                                    )}
                                  >
                                    {userProfile?.avatar_color === color && <div className="w-2 h-2 bg-white rounded-full" />}
                                  </div>
                                ))}
                              </div>

                              <div 
                                onClick={() => { setActiveTile(5); onLogout(); }}
                                className={cn(
                                  "p-4 border-2 border-danger/50 text-danger transition-all cursor-pointer font-display font-black uppercase tracking-widest text-sm text-center mt-4",
                                  activeTile === 5 ? "bg-danger text-white scale-[1.02]" : "hover:bg-danger/10"
                                )}
                              >
                                Sair da Conta (Logout)
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="mt-8 text-[10px] font-bold text-text-dim uppercase tracking-widest">
                          Pressionar A para Selecionar • Pressionar B para Voltar
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {isAdmin && activeTab === tabs.findIndex(t => t.id === 'admin') && (
              <div className="grid grid-cols-12 gap-6 h-full overflow-hidden">
                {/* Left: System Stats & Quick Actions */}
                <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
                   <div className="xbox-tile xbox-glossy p-6 flex flex-col gap-4 bg-black/40">
                      <h3 className="text-sm font-display font-black uppercase tracking-widest text-accent mb-2">Estado Vital</h3>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-text-dim uppercase font-bold">Modo Manutenção</span>
                            <span className={cn("font-black uppercase px-2 py-0.5 rounded-xs", adminData.host?.is_paused ? "bg-danger text-white" : "bg-green-500 text-white")}>
                               {adminData.host?.is_paused ? 'ATIVO' : 'OFF'}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-text-dim uppercase font-bold">Fila Total</span>
                            <span className="text-white font-black">{adminData.queue?.length || 0} Usuários</span>
                         </div>
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-text-dim uppercase font-bold">Sessions Ativas</span>
                            <span className="text-accent font-black">{adminData.activeSessions?.length || 0}</span>
                         </div>
                      </div>
                      
                      <div className="mt-4 space-y-2">
                         <button 
                           onClick={adminToggleMaintenance}
                           className={cn(
                             "w-full py-3 text-[9px] font-black uppercase tracking-widest transition-all border-2",
                             adminData.host?.is_paused ? "bg-green-500 border-green-400 text-white" : "bg-danger/20 border-danger/40 text-danger"
                           )}
                         >
                            {adminData.host?.is_paused ? 'Desativar Manutenção' : 'Ativar Manutenção'}
                         </button>
                         <button 
                           onClick={adminClearQueue}
                           className="w-full py-3 bg-white/5 border-2 border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/10"
                         >
                            Limpar Todas as Filas
                         </button>
                      </div>
                   </div>

                   <div className="flex-1 xbox-tile xbox-glossy p-6 bg-black/40 flex flex-col gap-4 overflow-hidden">
                      <h3 className="text-sm font-display font-black uppercase tracking-widest text-accent">Logs do Sistema</h3>
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-[9px] font-mono space-y-2">
                         {adminData.logs?.map((log: any) => (
                           <div key={log.id} className="border-b border-white/5 pb-1">
                              <span className="text-accent">[{log.tag}]</span> {log.message}
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Center: User Management */}
                <div className="col-span-12 xl:col-span-9 flex flex-col gap-4 overflow-hidden">
                   <div className="xbox-tile xbox-glossy p-6 bg-black/40 flex flex-col flex-1 overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-4">
                            <Users className="text-accent" size={24} />
                            <h2 className="text-2xl font-display font-black uppercase tracking-tighter">Gestão de Usuários</h2>
                         </div>
                         <div className="flex gap-2">
                             <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-[10px] font-bold text-text-dim italic">
                                Total: {adminData.users?.length || 0}
                             </div>
                         </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                         <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#050608] z-10">
                               <tr className="border-b border-white/10">
                                  <th className="py-4 text-[9px] font-black uppercase tracking-widest text-text-dim">Usuário</th>
                                  <th className="py-4 text-[9px] font-black uppercase tracking-widest text-text-dim">Cargo</th>
                                  <th className="py-4 text-[9px] font-black uppercase tracking-widest text-text-dim">Status</th>
                                  <th className="py-4 text-[9px] font-black uppercase tracking-widest text-text-dim text-right">Ações</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                               {adminData.users?.map((u: any, idx: number) => (
                                 <tr key={u.id} className={cn(
                                   "transition-colors",
                                   activeTile === idx ? "bg-accent/5 border-l-2 border-l-accent" : "hover:bg-white/2"
                                 )}>
                                    <td className="py-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-[10px] font-black">
                                             {u.username[0].toUpperCase()}
                                          </div>
                                          <div>
                                             <p className="text-sm font-display font-black uppercase italic">{u.username}</p>
                                             <p className="text-[8px] font-mono text-text-dim">{u.tailscale_ip || 'Sem IP'}</p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="py-4">
                                       <select 
                                         value={u.role}
                                         onChange={(e) => adminChangeRole(u.id, e.target.value)}
                                         className="bg-white/5 border border-white/10 text-xs font-black uppercase text-accent px-2 py-1 outline-none"
                                       >
                                          <option value="player">Player</option>
                                          <option value="admin">Admin</option>
                                       </select>
                                    </td>
                                    <td className="py-4">
                                       <button 
                                         onClick={() => adminToggleUser(u.id)}
                                         className={cn(
                                           "text-[9px] font-black uppercase px-2 py-1 rounded-xs transition-all",
                                           u.is_active ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-danger/10 text-danger border border-danger/20"
                                         )}
                                       >
                                          {u.is_active ? 'Ativo' : 'Inativo'}
                                       </button>
                                    </td>
                                    <td className="py-4 text-right">
                                       <button 
                                         onClick={() => adminDeleteUser(u.id)}
                                         className="p-2 text-danger/50 hover:text-danger hover:bg-danger/10 rounded-sm transition-all"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                    </td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer (Action Hints) */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-black/40 backdrop-blur-xl border-t border-white/5 px-24 flex items-center justify-between z-30">
        <div className="flex gap-12">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]">A</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Select</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]">B</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Back</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]">Y</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Queue Status</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black text-white">G</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Guide Menu</span>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-tighter text-white">{userProfile?.display_name || auth.user?.username || 'Hanak'}</p>
            <p className="text-[8px] font-bold uppercase tracking-widest text-accent">{userProfile?.role === 'admin' ? 'V-CLOUD Admin' : 'V-CLOUD Gold Member'}</p>
          </div>
          <button onClick={onLogout} className="text-[10px] font-bold uppercase tracking-widest text-danger hover:text-white transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      {/* Xbox Guide Menu (Side Panel) */}
      <AnimatePresence>
        {showGuide && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuide(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: -450 }}
              animate={{ x: 0 }}
              exit={{ x: -450 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[420px] bg-[#0c0e12] border-r border-white/10 z-[70] shadow-[30px_0_100px_rgba(0,0,0,0.8)] flex flex-col"
            >
              <div className="p-10 bg-accent text-bg">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-bg flex items-center justify-center shadow-xl">
                    <Shield size={32} className="text-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black uppercase tracking-tighter leading-none">V-CLOUD GUIDE</h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mt-1">System Dashboard</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-dim border-b border-white/5 pb-2">Hardware Telemetry</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-sm border border-white/5">
                      <p className="text-[8px] font-bold uppercase text-text-dim mb-1">GPU Temp</p>
                      <p className="text-2xl font-display font-black text-accent">{status.hostStats?.temp || 0}°C</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-sm border border-white/5">
                      <p className="text-[8px] font-bold uppercase text-text-dim mb-1">GPU Load</p>
                      <p className="text-2xl font-display font-black text-accent">{status.hostStats?.gpu_usage || 0}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-dim border-b border-white/5 pb-2">System Logs</h3>
                  <div className="space-y-3">
                    {logs.slice(0, 8).map((log: any) => (
                      <div key={log.id} className="bg-white/5 p-4 rounded-sm border border-white/5 text-[10px] group hover:bg-white/10 transition-colors">
                        <div className="flex justify-between mb-1">
                          <span className="text-accent font-black uppercase tracking-tighter">{log.tag}</span>
                          <span className="opacity-30 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-text-dim leading-relaxed">{log.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/40">
                <button 
                  onClick={() => setShowGuide(false)}
                  className="w-full py-4 rounded-sm bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                >
                  Close Guide (ESC)
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Browser Overlay */}
      <AnimatePresence>
        {isBrowserMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="h-16 bg-[#0c0e12] border-b border-white/10 flex items-center justify-between px-8">
              <div className="flex items-center gap-6">
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ArrowLeft size={18} /></button>
                  <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10"><ArrowRight size={18} /></button>
                  <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10" onClick={() => setBrowserUrl('https://www.bing.com')}><RotateCcw size={18} /></button>
                </div>
                <div className="bg-black/40 px-6 py-2 rounded-full border border-white/5 text-xs font-mono text-text-dim min-w-[400px]">
                  {browserUrl}
                </div>
              </div>
              <button 
                onClick={() => setIsBrowserMode(false)}
                className="px-6 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
              >
                Exit Browser (B)
              </button>
            </div>
            <div className="flex-1 bg-white">
              <iframe 
                src={browserUrl} 
                className="w-full h-full border-none"
                title="V-CLOUD Browser"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [auth, setAuth] = useState<any>(() => {
    const saved = localStorage.getItem('vcloud_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (data: any) => {
    setAuth(data);
    localStorage.setItem('vcloud_auth', JSON.stringify(data));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('vcloud_auth');
  };

  if (!auth) return <Login onLogin={handleLogin} />;

  return <PlayerLauncher token={auth.token} onLogout={handleLogout} />;
}


