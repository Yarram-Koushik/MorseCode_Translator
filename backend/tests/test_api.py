import pytest
from fastapi.testclient import TestClient
from app.main import app as fastapi_app
from app.database import Base, engine
from app import models as app_models

# Ensure database tables exist for testing
Base.metadata.create_all(bind=engine)

client = TestClient(fastapi_app)

def test_root_and_health():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"

    res_h = client.get("/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "healthy"

def test_morse_encode_api():
    payload = {"text": "SOS", "wpm": 15.0}
    res = client.post("/api/morse/encode", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["morse_code"] == "...---..."
    assert data["confidence"] == 1.0
    assert "timing" in data

def test_morse_decode_api():
    payload = {"morse_code": "... --- ..."}
    res = client.post("/api/morse/decode", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decoded_text"] == "SOS"
    assert data["confidence"] == 1.0

def test_timing_reconstruction_api():
    payload = {
        "intervals": [
            {"type": "pulse", "duration_ms": 100, "timestamp_ms": 0},
            {"type": "gap", "duration_ms": 90, "timestamp_ms": 100},
            {"type": "pulse", "duration_ms": 300, "timestamp_ms": 190}
        ],
        "dot_duration_ms": 100.0,
        "dash_duration_ms": 300.0
    }
    res = client.post("/api/morse/reconstruct-timing", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["morse_sequence"] == ".-"
    assert data["decoded_text"] == "A"
    assert data["overall_confidence"] > 0.8

def test_ambiguity_analyze_api():
    payload = {"morse_symbol": ".-"}
    res = client.post("/api/morse/analyze-ambiguity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidates"]) > 0
    assert data["candidates"][0]["char"] == "A"

def test_auth_and_protected_flow():
    import uuid
    rand_str = str(uuid.uuid4())[:8]
    username = f"user_{rand_str}"
    email = f"user_{rand_str}@example.com"
    password = "SuperSecretPassword123!"

    # Register
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    token = reg_data["access_token"]
    assert token is not None

    # Login
    login_res = client.post("/api/auth/login", json={
        "username_or_email": username,
        "password": password
    })
    assert login_res.status_code == 200
    assert login_res.json()["access_token"] is not None

    # Get /me with header
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username

def test_room_creation_and_message_api():
    # Create room
    room_res = client.post("/api/rooms/", json={"name": "Signal Lab Alpha"})
    assert room_res.status_code == 201
    room_data = room_res.json()
    code = room_data["code"]
    room_id = room_data["id"]

    # Get room by code
    get_res = client.get(f"/api/rooms/{code}")
    assert get_res.status_code == 200
    assert get_res.json()["code"] == code

    # Post message
    msg_res = client.post("/api/messages/", json={
        "room_id": room_id,
        "sender_name": "Operator Alpha",
        "text": "RADAR ONLINE",
        "morse_code": ".-. .- -.. .- .-. / --- -. .-.. .. -. .",
        "input_mode": "tap",
        "confidence": 0.98,
        "signal_quality": 0.95
    })
    assert msg_res.status_code == 201
    msg_data = msg_res.json()
    assert msg_data["text"] == "RADAR ONLINE"

    # Fetch messages
    hist_res = client.get(f"/api/messages/?room_id={room_id}")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1
