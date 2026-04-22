import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).with_name("thouse.db")
TOKEN_TTL_HOURS = 24 * 7

app = FastAPI(title="T-House API", version="1.0.0")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def ensure_schema() -> None:
    conn = db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('tenant', 'landlord')),
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            landlord_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            district TEXT NOT NULL,
            price INTEGER NOT NULL,
            area INTEGER NOT NULL,
            description TEXT NOT NULL,
            image_url TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(landlord_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(property_id) REFERENCES properties(id),
            FOREIGN KEY(sender_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )
        """
    )
    conn.commit()
    conn.close()


def seed_properties() -> None:
    conn = db()
    cur = conn.cursor()
    existing = cur.execute("SELECT COUNT(*) as c FROM properties").fetchone()["c"]
    if existing > 0:
        conn.close()
        return

    landlord = cur.execute(
        "SELECT id FROM users WHERE role='landlord' ORDER BY id LIMIT 1"
    ).fetchone()
    if landlord is None:
        now = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO users(name, phone, password_hash, role, created_at)
            VALUES(?, ?, ?, 'landlord', ?)
            """,
            ("系統業主", "90000000", hash_password("demo1234"), now),
        )
        landlord_id = cur.lastrowid
    else:
        landlord_id = landlord["id"]

    now = datetime.now(timezone.utc).isoformat()
    cur.executemany(
        """
        INSERT INTO properties(landlord_id, title, district, price, area, description, image_url, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                landlord_id,
                "油麻地雅賓大廈精緻套房",
                "油麻地",
                3450,
                74,
                "近港鐵站，適合一人入住，樓下便利店與食肆齊全。",
                "https://images.unsplash.com/photo-1502672023488-70e25813eb80",
                now,
            ),
            (
                landlord_id,
                "荃灣村屋實用套房",
                "荃灣",
                3200,
                102,
                "空間方正，採光好，附近有巴士站直達市區。",
                "https://images.unsplash.com/photo-1493809842364-78817add7ffb",
                now,
            ),
        ],
    )
    conn.commit()
    conn.close()


@app.on_event("startup")
def startup() -> None:
    ensure_schema()
    seed_properties()


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=6, max_length=64)
    role: str


class LoginInput(BaseModel):
    phone: str
    password: str


class PropertyInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    district: str = Field(min_length=1, max_length=40)
    price: int = Field(gt=0)
    area: int = Field(gt=0)
    description: str = Field(min_length=3, max_length=500)
    image_url: str = Field(min_length=5, max_length=300)


class MessageInput(BaseModel):
    property_id: int
    receiver_id: int
    content: str = Field(min_length=1, max_length=500)


def create_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)).isoformat()
    conn = db()
    conn.execute(
        "INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)",
        (token, user_id, expires_at),
    )
    conn.commit()
    conn.close()
    return token


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> sqlite3.Row:
    conn = db()
    row = conn.execute(
        """
        SELECT u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (credentials.credentials,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    expiry = conn.execute(
        "SELECT expires_at FROM sessions WHERE token = ?",
        (credentials.credentials,),
    ).fetchone()["expires_at"]
    if datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
        conn.execute("DELETE FROM sessions WHERE token = ?", (credentials.credentials,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")

    conn.close()
    return row


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(payload: RegisterInput) -> dict:
    if payload.role not in {"tenant", "landlord"}:
        raise HTTPException(status_code=400, detail="Invalid role.")

    now = datetime.now(timezone.utc).isoformat()
    conn = db()
    try:
        cur = conn.execute(
            """
            INSERT INTO users(name, phone, password_hash, role, created_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (payload.name, payload.phone, hash_password(payload.password), payload.role, now),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Phone is already registered.")

    token = create_token(cur.lastrowid)
    user = conn.execute(
        "SELECT id, name, phone, role FROM users WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return {"token": token, "user": dict(user)}


@app.post("/api/auth/login")
def login(payload: LoginInput) -> dict:
    conn = db()
    user = conn.execute(
        """
        SELECT id, name, phone, role
        FROM users
        WHERE phone = ? AND password_hash = ?
        """,
        (payload.phone, hash_password(payload.password)),
    ).fetchone()
    conn.close()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid phone or password.")
    token = create_token(user["id"])
    return {"token": token, "user": dict(user)}


@app.get("/api/properties")
def list_properties(district: Optional[str] = None, max_price: Optional[int] = None) -> list[dict]:
    conn = db()
    query = """
        SELECT p.*, u.name AS landlord_name, u.id AS landlord_id
        FROM properties p
        JOIN users u ON u.id = p.landlord_id
        WHERE 1=1
    """
    args: list = []
    if district:
        query += " AND p.district = ?"
        args.append(district)
    if max_price:
        query += " AND p.price <= ?"
        args.append(max_price)
    query += " ORDER BY p.id DESC"
    rows = conn.execute(query, args).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/properties")
def create_property(payload: PropertyInput, current_user: sqlite3.Row = Depends(get_current_user)) -> dict:
    if current_user["role"] != "landlord":
        raise HTTPException(status_code=403, detail="Only landlord can create property.")
    now = datetime.now(timezone.utc).isoformat()
    conn = db()
    cur = conn.execute(
        """
        INSERT INTO properties(landlord_id, title, district, price, area, description, image_url, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            current_user["id"],
            payload.title,
            payload.district,
            payload.price,
            payload.area,
            payload.description,
            payload.image_url,
            now,
        ),
    )
    conn.commit()
    row = conn.execute(
        """
        SELECT p.*, u.name AS landlord_name
        FROM properties p
        JOIN users u ON u.id = p.landlord_id
        WHERE p.id = ?
        """,
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return dict(row)


@app.post("/api/messages")
def send_message(payload: MessageInput, current_user: sqlite3.Row = Depends(get_current_user)) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    conn = db()
    property_exists = conn.execute(
        "SELECT id FROM properties WHERE id = ?",
        (payload.property_id,),
    ).fetchone()
    receiver_exists = conn.execute(
        "SELECT id FROM users WHERE id = ?",
        (payload.receiver_id,),
    ).fetchone()
    if property_exists is None or receiver_exists is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Property or receiver not found.")

    cur = conn.execute(
        """
        INSERT INTO messages(property_id, sender_id, receiver_id, content, created_at)
        VALUES(?, ?, ?, ?, ?)
        """,
        (payload.property_id, current_user["id"], payload.receiver_id, payload.content, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


@app.get("/api/messages/inbox")
def inbox(current_user: sqlite3.Row = Depends(get_current_user)) -> list[dict]:
    conn = db()
    rows = conn.execute(
        """
        SELECT m.*, p.title AS property_title, sender.name AS sender_name
        FROM messages m
        JOIN properties p ON p.id = m.property_id
        JOIN users sender ON sender.id = m.sender_id
        WHERE m.receiver_id = ?
        ORDER BY m.id DESC
        """,
        (current_user["id"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
