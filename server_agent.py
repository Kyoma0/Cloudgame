import psutil
import requests
import time
import os
import subprocess
import json
import glob

# Configurações
API_URL = "https://ais-dev-6g5uyvx5zcgrxngbey7cj2-50070616867.us-west2.run.app/api"
UPDATE_INTERVAL = 3  # segundos
GAME_PROCESS_NAME = "Sunshine.exe"
LIBRARY_FILE = "library.json"

def scan_library():
    """Varre o sistema em busca de jogos instalados (Steam, Epic, GOG)."""
    games = []
    
    # --- STEAM SCAN ---
    steam_paths = [
        "C:/Program Files (x86)/Steam/steamapps",
        "D:/SteamLibrary/steamapps",
        "E:/SteamLibrary/steamapps"
    ]
    for path in steam_paths:
        if os.path.exists(path):
            for acf in glob.glob(os.path.join(path, "*.acf")):
                try:
                    with open(acf, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        name = ""
                        app_id = ""
                        for line in content.split('\n'):
                            if '"name"' in line: name = line.split('"')[-2]
                            if '"appid"' in line: app_id = line.split('"')[-2]
                        if name and app_id:
                            games.append({
                                "id": f"steam_{app_id}",
                                "name": name,
                                "platform": "Steam",
                                "path": f"steam://run/{app_id}",
                                "image": f"https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg"
                            })
                except: pass

    # --- EPIC SCAN ---
    epic_manifest = "C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests"
    if os.path.exists(epic_manifest):
        for item in glob.glob(os.path.join(epic_manifest, "*.item")):
            try:
                with open(item, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    games.append({
                        "id": f"epic_{data['AppName']}",
                        "name": data['DisplayName'],
                        "platform": "Epic",
                        "path": f"com.epicgames.launcher://apps/{data['AppName']}?action=launch&silent=true",
                        "image": "https://picsum.photos/seed/epic/400/225"
                    })
            except: pass

    # Mock games if on non-windows or empty
    if not games:
        games = [
            {"id": "mock_1", "name": "Cyberpunk 2077", "platform": "Steam", "path": "path/to/game", "image": "https://picsum.photos/seed/cp77/400/225"},
            {"id": "mock_2", "name": "Fortnite", "platform": "Epic", "path": "path/to/fortnite", "image": "https://picsum.photos/seed/fortnite/400/225"},
            {"id": "mock_3", "name": "The Witcher 3", "platform": "GOG", "path": "path/to/tw3", "image": "https://picsum.photos/seed/tw3/400/225"}
        ]

    with open(LIBRARY_FILE, 'w') as f:
        json.dump(games, f)
    return games

def get_platform_status():
    """Verifica se os launchers estão rodando."""
    platforms = {
        "steam": False,
        "epic": False,
        "gog": False
    }
    for proc in psutil.process_iter(['name']):
        try:
            name = proc.info['name'].lower()
            if "steam.exe" in name or "steam" == name: platforms["steam"] = True
            if "epicgameslauncher.exe" in name or "epicgames" in name: platforms["epic"] = True
            if "galaxyclient.exe" in name or "gog" in name: platforms["gog"] = True
        except: pass
    return platforms

def get_gpu_stats():
    """Tenta obter dados reais da GPU usando nvidia-smi."""
    try:
        cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"
        output = subprocess.check_output(cmd, shell=True).decode('utf-8').strip()
        gpu_util, mem_used, mem_total, temp = output.split(', ')
        
        gpu_usage = float(gpu_util)
        vram_usage = (float(mem_used) / float(mem_total)) * 100
        return gpu_usage, vram_usage, float(temp)
    except Exception as e:
        cpu = psutil.cpu_percent()
        return cpu, psutil.virtual_memory().percent, 45 + (cpu / 2)

def get_stats():
    try:
        gpu_usage, vram_usage, temp = get_gpu_stats()
        
        return {
            "temp": temp,
            "gpu_usage": gpu_usage,
            "memory_usage": vram_usage,
            "encoder": "NVENC (H.265)",
            "tailscale_ip": "100.64.0.1",
            "uptime_seconds": int(time.time() - psutil.boot_time()),
            "is_charging": 1 if not hasattr(psutil, "sensors_battery") or psutil.sensors_battery() is None or psutil.sensors_battery().power_plugged else 0,
            "platform_status": get_platform_status()
        }
    except Exception as e:
        print(f"Erro ao coletar stats: {e}")
        return None

def kill_game_process():
    print(f"Encerrando processos de streaming e jogo...")
    targets = ["sunshine.exe", "nvstreamer.exe", "Moonlight.exe"]
    for target in targets:
        try:
            if os.name == 'nt': subprocess.run(["taskkill", "/F", "/IM", target], capture_output=True)
            else: subprocess.run(["pkill", "-f", target], capture_output=True)
        except: pass

def main():
    print("V-Cloud Host Agent (Nitro V) Iniciado...")
    print(f"Monitorando API: {API_URL}")
    
    # Scan inicial
    scan_library()
    
    while True:
        stats = get_stats()
        if stats:
            try:
                # Inclui biblioteca no update ocasional ou se solicitado
                res = requests.post(f"{API_URL}/host/update", json=stats)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("sync_library"):
                        library = scan_library()
                        requests.post(f"{API_URL}/host/library", json={"library": library})
                    if data.get("kill_session"):
                        kill_game_process()
            except Exception as e:
                print(f"Erro ao enviar stats: {e}")
        
        time.sleep(UPDATE_INTERVAL)

if __name__ == "__main__":
    main()
