import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_start_session(async_client: AsyncClient, generate_b64_audio):
    """
    Tests POST /api/session/start (Plane.md Section 4 contract).
    """
    # 1. Enroll profile
    sample = generate_b64_audio(freq=250.0, duration=1.0)
    p_res = await async_client.post("/api/voiceprint/enroll", json={
        "personName": "Ramesh Kumar",
        "role": "CFO",
        "audioSamples": [sample]
    })
    profile_id = p_res.json()["profileId"]

    # 2. Start Session
    payload = {
        "claimedIdentity": profile_id,
        "context": {
            "callType": "fund_transfer_approval",
            "amount": 5000000.0,
            "callerNumber": "+919876543210"
        }
    }

    res = await async_client.post("/api/session/start", json=payload)
    assert res.status_code == 201

    data = res.json()
    assert "sessionId" in data
    assert data["sessionId"].startswith("sess_")
    assert "websocketUrl" in data
    assert "/ws/session/" in data["websocketUrl"]
    assert data["claimedIdentity"] == profile_id
    assert "startedAt" in data


@pytest.mark.asyncio
async def test_session_history_and_end(async_client: AsyncClient):
    """
    Tests GET /api/session/{sessionId}/history and POST /api/session/{sessionId}/end.
    """
    # Start session without claimed identity
    start_res = await async_client.post("/api/session/start", json={
        "context": {"callType": "general_inquiry"}
    })
    assert start_res.status_code == 201
    session_id = start_res.json()["sessionId"]

    # Get history
    hist_res = await async_client.get(f"/api/session/{session_id}/history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert hist_data["sessionId"] == session_id
    assert hist_data["status"] == "ACTIVE"
    assert isinstance(hist_data["chunks"], list)
    assert isinstance(hist_data["alertsFired"], list)

    # End session
    end_res = await async_client.post(f"/api/session/{session_id}/end")
    assert end_res.status_code == 200
    end_data = end_res.json()
    assert end_data["status"] == "COMPLETED"
    assert "finalRisk" in end_data
    assert "endedAt" in end_data


@pytest.mark.asyncio
async def test_list_active_sessions(async_client: AsyncClient):
    """Tests GET /api/session/active."""
    start_res = await async_client.post("/api/session/start", json={
        "context": {"callType": "wire_transfer", "amount": 100000.0}
    })
    session_id = start_res.json()["sessionId"]

    active_res = await async_client.get("/api/session/active")
    assert active_res.status_code == 200
    active_data = active_res.json()
    assert active_data["total"] >= 1
    assert any(s["sessionId"] == session_id for s in active_data["sessions"])


@pytest.mark.asyncio
async def test_alerts_endpoint(async_client: AsyncClient):
    """Tests GET /api/alerts."""
    res = await async_client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data
    assert "total" in data
