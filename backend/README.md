# Voice Cloning Detection — Backend

## Tech Stack

Python 3.11+ | FastAPI | Uvicorn

---

## Setup

### 1. Create and activate a virtual environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Run the server

**Run from inside the `backend/` directory.**

```bash
uvicorn app.main:app --reload
```

The server starts at `http://127.0.0.1:8000`.

---

## Endpoints

### REST

| Method | Path    | Description  |
|--------|---------|--------------|
| GET    | /health | Health check |
| GET    | /docs   | Swagger UI   |
| GET    | /redoc  | ReDoc UI     |

Health check response:

```json
{"status": "ok"}
```

### WebSocket

```
ws://127.0.0.1:8000/ws/session/{session_id}
```

- The client sends **raw binary audio bytes** (target: 3-second chunks).
- The server replies with a **JSON acknowledgement** for every chunk.

**ACK example:**

```json
{
    "sessionId": "sess_123",
    "chunkSeq": 1,
    "status": "RECEIVED",
    "audioBytes": 48000
}
```

**On unexpected text frame:**

```json
{
    "sessionId": "sess_123",
    "status": "ERROR",
    "message": "Expected binary audio data; received text frame."
}
```

---

## Quick WebSocket test

Start the server first, then in a second terminal:

```bash
python tests/test_ws_manual.py
```

Expected output:

```
ACK 1: {"sessionId": "sess_test", "chunkSeq": 1, "status": "RECEIVED", "audioBytes": 48000}
ACK 2: {"sessionId": "sess_test", "chunkSeq": 2, "status": "RECEIVED", "audioBytes": 48000}
```

---

## Project structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app creation + router registration
│   ├── api/                  # Future: REST routers
│   ├── websocket/
│   │   ├── __init__.py
│   │   └── session_ws.py     # /ws/session/{session_id}
│   ├── services/             # Future: business logic
│   ├── risk/                 # Future: risk scoring engine
│   ├── database/             # Future: PostgreSQL / SQLAlchemy
│   ├── models/               # Future: ORM models
│   ├── schemas/              # Future: Pydantic schemas
│   ├── cache/                # Future: Redis caching
│   └── config/               # Future: settings / env vars
├── tests/
│   ├── __init__.py
│   └── test_ws_manual.py     # Manual WebSocket smoke test
├── requirements.txt
└── README.md
```
