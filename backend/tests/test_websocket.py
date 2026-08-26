import struct
import json
from starlette.testclient import TestClient
from backend.main import app
from backend.models.db_models import VoiceProfile
from backend.database import sync_engine, Base, SyncSessionLocal


def test_websocket_streaming_binary_frames(generate_raw_wav_bytes):
    """
    Tests WebSocket audio streaming with 4-byte sequence header binary frames.
    Matches task_backend.md & Plane.md specifications.
    """
    # Prepare tables in sync engine for TestClient
    Base.metadata.create_all(bind=sync_engine)

    with TestClient(app) as client:
        session_id = "sess_test_ws_123"
        with client.websocket_connect(f"/ws/session/{session_id}") as websocket:
            # Generate 3-second audio chunk
            raw_audio = generate_raw_wav_bytes(freq=350.0, duration=3.0)

            # Build binary frame: [4 bytes sequence number: big-endian][remaining bytes: audio WAV]
            chunk_seq = 1
            seq_bytes = struct.pack(">I", chunk_seq)
            binary_payload = seq_bytes + raw_audio

            # Send binary frame
            websocket.send_bytes(binary_payload)

            # Receive JSON response
            data = websocket.receive_json()

            assert data["sessionId"] == session_id
            assert data["chunkSeq"] == 1
            assert "syntheticScore" in data
            assert "speakerMatchScore" in data
            assert "runningRisk" in data
            assert "riskLevel" in data
            assert "recommendation" in data
            assert isinstance(data["runningRisk"], float)
            assert data["riskLevel"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
            assert data["recommendation"] in ("ALLOW", "MONITOR", "VERIFY_CALLBACK", "ESCALATE")


def test_websocket_streaming_json_frames(generate_b64_audio):
    """
    Tests WebSocket streaming with JSON payload.
    """
    Base.metadata.create_all(bind=sync_engine)

    with TestClient(app) as client:
        session_id = "sess_test_json_456"
        with client.websocket_connect(f"/ws/session/{session_id}") as websocket:
            b64_audio = generate_b64_audio(freq=400.0, duration=2.0)
            payload = {
                "chunkSeq": 5,
                "audio": b64_audio
            }

            websocket.send_text(json.dumps(payload))
            data = websocket.receive_json()

            assert data["sessionId"] == session_id
            assert data["chunkSeq"] == 5
            assert "runningRisk" in data
            assert "recommendation" in data
