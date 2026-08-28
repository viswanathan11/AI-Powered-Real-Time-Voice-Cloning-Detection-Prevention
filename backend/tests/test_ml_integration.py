import json
from pathlib import Path
import pytest
from httpx import AsyncClient
from backend.services.ml_bridge import ml_bridge
from backend.services.risk_engine import risk_engine

root_dir = Path(__file__).resolve().parent.parent.parent


def test_ml_bridge_direct_extraction(generate_b64_audio):
    """Tests ML bridge embedding extraction."""
    samples = [
        generate_b64_audio(freq=200.0, duration=1.0),
        generate_b64_audio(freq=210.0, duration=1.0)
    ]
    embedding, count = ml_bridge.extract_embedding_from_samples(samples)
    assert count == 2
    assert len(embedding) == 192
    assert isinstance(embedding[0], float)


def test_ml_bridge_chunk_analysis(generate_raw_wav_bytes):
    """Tests ML bridge chunk analysis with reference embedding."""
    ref_embedding = [0.05] * 192
    audio_bytes = generate_raw_wav_bytes(freq=200.0, duration=3.0)

    result = ml_bridge.analyze_audio_chunk(
        audio_input=audio_bytes,
        profile_embedding=ref_embedding
    )

    assert "syntheticScore" in result
    assert "speakerMatchScore" in result
    assert "latencyMs" in result
    assert 0.0 <= result["syntheticScore"] <= 1.0
    assert 0.0 <= result["speakerMatchScore"] <= 1.0


@pytest.mark.asyncio
async def test_end_to_end_fraud_detection_flow(async_client: AsyncClient):
    """
    End-to-End Test:
    1. Enroll CFO Profile
    2. Start Session for Fund Transfer Approval (High Value)
    3. Query history
    """
    payloads_file = root_dir / "samples" / "sample_payloads.json"
    if not payloads_file.exists():
        pytest.skip("Sample audio files not found")

    with open(payloads_file, "r") as f:
        payloads = json.load(f)

    # 1. Enroll
    cfo_samples = [
        payloads["cfo_enrollment_1.wav"],
        payloads["cfo_enrollment_2.wav"],
        payloads["cfo_enrollment_3.wav"]
    ]
    enroll_res = await async_client.post("/api/voiceprint/enroll", json={
        "personName": "Ramesh Kumar",
        "role": "CFO",
        "orgId": "org_sih_demo",
        "audioSamples": cfo_samples
    })
    assert enroll_res.status_code == 201
    profile_id = enroll_res.json()["profileId"]

    # 2. Start Session
    session_res = await async_client.post("/api/session/start", json={
        "claimedIdentity": profile_id,
        "context": {
            "callType": "fund_transfer_approval",
            "amount": 5000000.0,
            "callerNumber": "+919876543210"
        }
    })
    assert session_res.status_code == 201
    session_id = session_res.json()["sessionId"]

    # 3. Check Session History
    hist_res = await async_client.get(f"/api/session/{session_id}/history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert hist_data["claimedIdentity"] == profile_id
    assert hist_data["personName"] == "Ramesh Kumar"
    assert hist_data["amount"] == 5000000.0
