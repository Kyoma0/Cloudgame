import sys
import requests
import subprocess
import time

# Configuration
API_URL = "https://ais-dev-6g5uyvx5zcgrxngbey7cj2-50070616867.us-west2.run.app/api"

def login(username, password):
    try:
        res = requests.post(f"{API_URL}/auth/login", json={"username": username, "password": password})
        if res.status_code == 200:
            return res.json()
        return None
    except:
        return None

def get_status(token):
    try:
        res = requests.get(f"{API_URL}/queue/status", headers={"Authorization": f"Bearer {token}"})
        return res.json()
    except:
        return None

def join_queue(token):
    try:
        requests.post(f"{API_URL}/queue/join", headers={"Authorization": f"Bearer {token}"})
    except:
        pass

def launch_moonlight(ip):
    print(f"Launching Moonlight to {ip}...")
    # Example command: moonlight-qt stream <ip> <app_name>
    try:
        subprocess.Popen(["moonlight-qt", "stream", ip, "Desktop", "--fullscreen"])
    except Exception as e:
        print(f"Failed to launch Moonlight: {e}")

def main():
    print("V-Cloud Gaming Launcher")
    username = input("Username: ")
    password = input("Password: ")
    
    auth = login(username, password)
    if not auth:
        print("Login failed.")
        return

    token = auth['token']
    print(f"Logged in as {auth['user']['username']}")

    while True:
        status = get_status(token)
        if not status:
            print("Failed to get status.")
            time.sleep(5)
            continue

        if not status['inQueue']:
            print("Not in queue. Joining...")
            join_queue(token)
            continue

        print(f"Status: {status['status']} | Position: {status['position']}")

        if status['status'] == 'active':
            print("ACCESS GRANTED!")
            launch_moonlight(status['tailscaleIp'])
            break
        
        time.sleep(5)

if __name__ == "__main__":
    main()
