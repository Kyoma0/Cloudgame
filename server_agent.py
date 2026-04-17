import os
import sys
import time
import json
import glob
import logging
import subprocess
from typing import Optional, List, Dict, Any

import requests
import psutil

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('agent.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

API_URL = os.environ.get('API_URL', 'http://localhost:3000/api')
UPDATE_INTERVAL = int(os.environ.get('UPDATE_INTERVAL', '3'))
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2

LIBRARY_FILE = "library.json"
GAME_PROCESS_NAME = "Sunshine.exe"


def retry_request(func, max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY):
    """Executa função com retry exponencial."""
    for attempt in range(max_retries):
        try:
            return func()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                logger.error(f"Falhou após {max_retries} tentativas: {e}")
                raise
            delay = base_delay * (2 ** attempt)
            logger.warning(f"Tentativa {attempt + 1} falhou, retry em {delay}s: {e}")
            time.sleep(delay)


def get_tailscale_ip() -> Optional[str]:
    """Obtém IP do Tailscale."""
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                ['tailscale', 'ip', '-4'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return result.stdout.strip()
    except FileNotFoundError:
        logger.debug("Tailscale não instalado")
    except subprocess.TimeoutExpired:
        logger.warning("Timeout ao buscar IP do Tailscale")
    except Exception as e:
        logger.error(f"Erro ao buscar IP do Tailscale: {e}")
    return None


def scan_library() -> List[Dict[str, Any]]:
    """Varre o sistema em busca de jogos instalados (Steam, Epic, GOG)."""
    games = []
    
    if sys.platform != 'win32':
        logger.info("Não é Windows, retornando lista vazia")
        return games
    
    steam_paths = [
        "C:/Program Files (x86)/Steam/steamapps",
        "D:/SteamLibrary/steamapps",
        "E:/SteamLibrary/steamapps"
    ]
    
    for path in steam_paths:
        if not os.path.exists(path):
            continue
        logger.info(f"Escaneando Steam: {path}")
        for acf in glob.glob(os.path.join(path, "*.acf")):
            try:
                with open(acf, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    name = ""
                    app_id = ""
                    for line in content.split('\n'):
                        if '"name"' in line:
                            parts = line.split('"')
                            if len(parts) >= 4:
                                name = parts[3]
                        if '"appid"' in line:
                            parts = line.split('"')
                            if len(parts) >= 4:
                                app_id = parts[3]
                    if name and app_id:
                        games.append({
                            "id": f"steam_{app_id}",
                            "name": name,
                            "platform": "Steam",
                            "path": f"steam://run/{app_id}",
                            "image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg"
                        })
            except Exception as e:
                logger.warning(f"Erro ao ler {acf}: {e}")

    epic_manifest = "C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests"
    if os.path.exists(epic_manifest):
        logger.info(f"Escaneando Epic: {epic_manifest}")
        for item in glob.glob(os.path.join(epic_manifest, "*.item")):
            try:
                with open(item, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    games.append({
                        "id": f"epic_{data.get('AppName', '')}",
                        "name": data.get('DisplayName', 'Unknown'),
                        "platform": "Epic",
                        "path": f"com.epicgames.launcher://apps/{data.get('AppName', '')}?action=launch&silent=true",
                        "image": data.get('ImageTile', {}).get('tall', '') or f"https://picsum.photos/seed/{data.get('AppName', 'epic')}/400/225"
                    })
            except Exception as e:
                logger.warning(f"Erro ao ler {item}: {e}")

    if not games:
        logger.warning("Nenhum jogo encontrado, usando lista mock")
        games = [
            {"id": "mock_1", "name": "Cyberpunk 2077", "platform": "Steam", "path": "steam://run/1091500", "image": "https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg"},
            {"id": "mock_2", "name": "The Witcher 3", "platform": "GOG", "path": "gog://run/1999181629", "image": "https://picsum.photos/seed/tw3/400/225"}
        ]

    try:
        with open(LIBRARY_FILE, 'w') as f:
            json.dump(games, f, indent=2)
    except Exception as e:
        logger.error(f"Erro ao salvar library.json: {e}")
    
    logger.info(f"Biblioteca escaneada: {len(games)} jogos")
    return games


def get_platform_status() -> Dict[str, bool]:
    """Verifica se os launchers estão rodando."""
    platforms = {"steam": False, "epic": False, "gog": False}
    process_names = {
        "steam": ["steam.exe", "steamwebhelper.exe"],
        "epic": ["epicgameslauncher.exe", "EpicGamesLauncher.exe"],
        "gog": ["galaxyclient.exe", "GOGGalaxy.exe"]
    }
    
    for proc in psutil.process_iter(['name']):
        try:
            name = proc.info.get('name', '').lower()
            if any(n in name for n in process_names["steam"]):
                platforms["steam"] = True
            if any(n in name for n in process_names["epic"]):
                platforms["epic"] = True
            if any(n in name for n in process_names["gog"]):
                platforms["gog"] = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    return platforms


def get_battery_status() -> Dict[str, Any]:
    """Obtém status da bateria."""
    try:
        battery = psutil.sensors_battery()
        if battery is None:
            return {"present": False, "plugged": True, "percent": 100}
        return {
            "present": True,
            "plugged": battery.power_plugged,
            "percent": battery.percent
        }
    except Exception as e:
        logger.debug(f"Erro ao obter status da bateria: {e}")
        return {"present": False, "plugged": True, "percent": 100}


def get_gpu_stats() -> tuple:
    """Obtém dados da GPU usando nvidia-smi."""
    try:
        if sys.platform != 'win32':
            raise Exception("Não é Windows")
        
        cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            shell=True
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            gpu_util, mem_used, mem_total, temp = output.split(', ')
            gpu_usage = float(gpu_util.strip())
            vram_usage = (float(mem_used.strip()) / float(mem_total.strip())) * 100
            return gpu_usage, vram_usage, float(temp.strip())
        
        raise Exception("nvidia-smi retornou erro")
        
    except FileNotFoundError:
        logger.warning("nvidia-smi não encontrado")
    except Exception as e:
        logger.debug(f"Erro ao obter stats da GPU: {e}")
    
    cpu = psutil.cpu_percent(interval=1)
    return cpu, psutil.virtual_memory().percent, 45 + (cpu / 2)


def get_stats() -> Optional[Dict[str, Any]]:
    """Coleta estatísticas do sistema."""
    try:
        gpu_usage, vram_usage, temp = get_gpu_stats()
        battery = get_battery_status()
        tailscale_ip = get_tailscale_ip()
        
        return {
            "temp": temp,
            "gpu_usage": gpu_usage,
            "memory_usage": vram_usage,
            "encoder": "NVENC (H.265)",
            "tailscale_ip": tailscale_ip or "0.0.0.0",
            "uptime_seconds": int(time.time() - psutil.boot_time()),
            "is_charging": 1 if battery.get("plugged", True) else 0,
            "battery_percent": battery.get("percent", 100),
            "platform_status": get_platform_status()
        }
    except Exception as e:
        logger.error(f"Erro ao coletar stats: {e}")
        return None


def kill_game_process() -> None:
    """Encerra processos de streaming (Sunshine, NVENC)."""
    logger.info("Encerrando processos de streaming...")
    
    targets = ["sunshine.exe", "nvstreamer.exe"]
    
    for target in targets:
        try:
            if sys.platform == 'win32':
                result = subprocess.run(
                    ["taskkill", "/F", "/IM", target],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    logger.info(f"Processo {target} encerrado")
                elif result.returncode != 128:
                    logger.debug(f"Processo {target} não encontrado ou já encerrado")
            else:
                subprocess.run(["pkill", "-f", target], capture_output=True)
        except Exception as e:
            logger.warning(f"Erro ao encerrar {target}: {e}")


def send_stats(stats: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Envia estatísticas para a API."""
    def _request():
        response = requests.post(
            f"{API_URL}/host/update",
            json=stats,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    
    return retry_request(_request)


def sync_library() -> None:
    """Sincroniza biblioteca com API."""
    library = scan_library()
    
    def _request():
        response = requests.post(
            f"{API_URL}/host/library",
            json={"library": library},
            timeout=30
        )
        response.raise_for_status()
    
    retry_request(_request)


def main():
    logger.info(f"Cloudgame Host Agent Started (API: {API_URL})")
    logger.info(f"Update interval: {UPDATE_INTERVAL}s")
    
    initial_library = scan_library()
    initial_sync = True
    
    while True:
        stats = get_stats()
        
        if stats:
            try:
                logger.debug(f"Stats: GPU={stats['gpu_usage']:.1f}%, Temp={stats['temp']:.0f}°C")
                
                result = send_stats(stats)
                
                if result:
                    if result.get("sync_library"):
                        logger.info("Solicitado sync da biblioteca")
                        sync_library()
                    
                    if result.get("kill_session"):
                        logger.info("Solicitado kill da sessão")
                        kill_game_process()
                        
            except Exception as e:
                logger.error(f"Erro ao enviar stats: {e}")
        
        time.sleep(UPDATE_INTERVAL)


if __name__ == "__main__":
    main()