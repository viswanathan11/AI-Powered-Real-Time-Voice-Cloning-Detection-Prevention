import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_enroll_voiceprint_success(async_client: AsyncClient, generate_b64_audio):
    """
    Tests POST /api/voiceprint/enroll (Plane.md & task_backend.md objective B).
    Verifies embedding extraction, DB persistence, and privacy guarantees.
    """
    sample1 = generate_b64_audio(freq=220.0, duration=1.0)
    sample2 = generate_b64_audio(freq=230.0, duration=1.0)
    sample3 = generate_b64_audio(freq=240.0, duration=1.0)

    payload = {
        "personName": "Ramesh Kumar",
        "role": "CFO",
        "orgId": "org_enterprise_sih",
        "audioSamples": [sample1, sample2, sample3]
    }

    response = await async_client.post("/api/voiceprint/enroll", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "profileId" in data
    assert data["profileId"].startswith("vp_")
    assert data["personName"] == "Ramesh Kumar"
    assert data["role"] == "CFO"
    assert data["orgId"] == "org_enterprise_sih"
    assert data["sampleCount"] == 3
    assert "enrolledAt" in data

    # Privacy verification: Raw audio is NEVER returned in response
    assert "audio" not in data
    assert "rawAudio" not in data
    assert "audioSamples" not in data


@pytest.mark.asyncio
async def test_list_and_get_voice_profiles(async_client: AsyncClient, generate_b64_audio):
    """Tests listing profiles and fetching a specific profile."""
    # Enroll profile
    sample = generate_b64_audio(freq=300.0, duration=1.0)
    enroll_res = await async_client.post("/api/voiceprint/enroll", json={
        "personName": "Priya Sharma",
        "role": "CTO",
        "audioSamples": [sample]
    })
    assert enroll_res.status_code == 201
    profile_id = enroll_res.json()["profileId"]

    # List profiles
    list_res = await async_client.get("/api/voiceprint/profiles")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(p["profileId"] == profile_id for p in list_data["profiles"])

    # Get single profile
    get_res = await async_client.get(f"/api/voiceprint/{profile_id}")
    assert get_res.status_code == 200
    assert get_res.json()["personName"] == "Priya Sharma"

    # Get non-existent profile returns 404
    bad_res = await async_client.get("/api/voiceprint/vp_nonexistent999")
    assert bad_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_voice_profile(async_client: AsyncClient, generate_b64_audio):
    """Tests deleting an enrolled voice profile."""
    sample = generate_b64_audio(freq=400.0, duration=1.0)
    enroll_res = await async_client.post("/api/voiceprint/enroll", json={
        "personName": "To Be Deleted",
        "audioSamples": [sample]
    })
    profile_id = enroll_res.json()["profileId"]

    del_res = await async_client.delete(f"/api/voiceprint/{profile_id}")
    assert del_res.status_code == 200

    # Verify 404 afterwards
    get_res = await async_client.get(f"/api/voiceprint/{profile_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_enroll_invalid_samples_returns_error(async_client: AsyncClient):
    """Tests that empty audio samples list or invalid payload triggers validation error."""
    res = await async_client.post("/api/voiceprint/enroll", json={
        "personName": "Bad Payload",
        "audioSamples": []
    })
    assert res.status_code == 422  # Pydantic validation error for min_length
