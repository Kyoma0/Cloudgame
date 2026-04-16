from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import time

app = FastAPI()
DB_PATH = "gaming.db"

class UserSettings(BaseModel):
    quality: str
    fps: int
    bitrate: int

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- SOCIAL ---
@app.get("/api/social/users")
def get_social_users(authorization: str = Header(None)):
    # In a real app, verify JWT here
    db = get_db()
    cursor = db.cursor()
    
    # Update last seen for the requesting user (mocked ID 1)
    db.execute("UPDATE users SET last_seen = datetime('now') WHERE id = 1")
    db.commit()
    
    users = db.execute("""
        SELECT id, username, last_seen,
        (SELECT status FROM queue WHERE user_id = users.id AND status = 'active') as active_status
        FROM users 
        WHERE is_active = 1
    """).fetchall()
    
    now = time.time()
    result = []
    for u in users:
        # Simple string parsing for sqlite datetime
        # This is a simplified version of the Node logic
        status = "offline"
        # ... logic to check last_seen diff ...
        result.append({
            "id": u["id"],
            "username": u["username"],
            "status": "online" if u["active_status"] else "online" # Mocked
        })
    return result

# --- SETTINGS ---
@app.get("/api/user/settings")
def get_settings(authorization: str = Header(None)):
    db = get_db()
    settings = db.execute("SELECT * FROM user_settings WHERE user_id = 1").fetchone()
    if not settings:
        return {"quality": "1080p", "fps": 60, "bitrate": 50}
    return dict(settings)

@app.post("/api/user/settings")
def save_settings(settings: UserSettings, authorization: str = Header(None)):
    db = get_db()
    db.execute("""
        INSERT OR REPLACE INTO user_settings (user_id, quality, fps, bitrate) 
        VALUES (1, ?, ?, ?)
    """, (settings.quality, settings.fps, settings.bitrate))
    db.commit()
    return {"success": True}

# --- NETWORK ---
@app.get("/api/network/ping")
def ping():
    import random
    return {"latency": random.randint(10, 40), "status": "stable"}
