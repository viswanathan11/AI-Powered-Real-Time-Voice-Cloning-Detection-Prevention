import unittest
import base64
import io
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
import sys
from pathlib import Path

ml_service_dir = Path(__file__).resolve().parent.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))

from app.main import app
from app.services.profile_store import profile_store


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        profile_store.clear()

    def _generate_b64_audio(self, freq=300.0, duration=1.0, sr=16000, amp=0.5):
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)
        byte_io = io.BytesIO()
        sf.write(byte_io, audio, sr, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        return base64.b64encode(byte_io.read()).decode("utf-8")

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("service", data)
        self.assertIn("endpoints", data)

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(data["status"], ["ready", "initializing", "ok"])
        self.assertIn("models", data)

    def test_extract_embedding_endpoint(self):
        audio_b64 = self._generate_b64_audio(freq=440.0, duration=1.5)
        response = self.client.post("/ml/extract-embedding", json={"audio": audio_b64})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("embedding", data)
        self.assertEqual(data["dimension"], 192)
        self.assertEqual(data["sampleCount"], 1)

    def test_enroll_profile_endpoint(self):
        samples = [
            self._generate_b64_audio(freq=200.0, duration=1.0),
            self._generate_b64_audio(freq=205.0, duration=1.0),
            self._generate_b64_audio(freq=210.0, duration=1.0),
        ]
        payload = {
            "personName": "Ramesh Kumar",
            "role": "CFO",
            "orgId": "org_sih_123",
            "audioSamples": samples
        }
        response = self.client.post("/ml/enroll-profile", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("profileId", data)
        self.assertEqual(data["personName"], "Ramesh Kumar")
        self.assertEqual(data["role"], "CFO")
        self.assertEqual(data["sampleCount"], 3)
        self.assertEqual(len(data["embedding"]), 192)

        # Verify retrieval
        get_res = self.client.get(f"/ml/profiles/{data['profileId']}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["personName"], "Ramesh Kumar")

    def test_analyze_chunk_without_profile(self):
        audio_b64 = self._generate_b64_audio(freq=350.0, duration=2.0)
        payload = {
            "audio": audio_b64
        }
        response = self.client.post("/ml/analyze-chunk", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("syntheticScore", data)
        self.assertIn("speakerMatchScore", data)
        self.assertIn("runningRisk", data)
        self.assertIn("riskLevel", data)
        self.assertIn("recommendation", data)
        self.assertIn("latencyMs", data)

    def test_analyze_chunk_with_enrolled_profile(self):
        # 1. Enroll speaker A
        samples = [self._generate_b64_audio(freq=250.0, duration=1.5)]
        enroll_res = self.client.post("/ml/enroll-profile", json={
            "personName": "Alice CFO",
            "role": "CFO",
            "audioSamples": samples
        })
        profile_id = enroll_res.json()["profileId"]

        # 2. Analyze matching audio from speaker A
        match_chunk = self._generate_b64_audio(freq=250.0, duration=3.0)
        response = self.client.post("/ml/analyze-chunk", json={
            "audio": match_chunk,
            "compareToProfileId": profile_id
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["speakerMatchScore"], 0.50)
        self.assertIn("runningRisk", data)

    def test_verify_speaker_direct(self):
        audio_a = self._generate_b64_audio(freq=400.0, duration=1.5)
        audio_b = self._generate_b64_audio(freq=400.0, duration=1.5)
        response = self.client.post("/ml/verify-speaker", json={
            "audio": audio_a,
            "referenceAudio": audio_b
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("speakerMatchScore", data)
        self.assertIn("cosineSimilarity", data)
        self.assertIn("isMatch", data)

    def test_detect_synthetic_direct(self):
        audio = self._generate_b64_audio(freq=500.0, duration=2.0)
        response = self.client.post("/ml/detect-synthetic", json={"audio": audio})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("syntheticScore", data)
        self.assertIn("isSynthetic", data)
        self.assertIn("details", data)

    def test_get_voiceprints_api(self):
        # 1. Enroll a test profile
        samples = [self._generate_b64_audio(freq=220.0, duration=1.0)]
        self.client.post("/api/enroll-profile", json={
            "personName": "Test Executive",
            "role": "CEO",
            "audioSamples": samples
        })

        # 2. Call GET /api/voiceprints
        response = self.client.get("/api/voiceprints")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]["personName"], "Test Executive")
        self.assertEqual(data[0]["role"], "CEO")

    def test_start_session_api(self):
        payload = {
            "profileId": "vp_test123456",
            "context": {"callType": "HIGH_VALUE_WIRE"}
        }
        response = self.client.post("/api/session/start", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("sessionId", data)
        self.assertTrue(data["sessionId"].startswith("sess_"))
        self.assertEqual(data["status"], "STARTED")
        self.assertEqual(data["profileId"], "vp_test123456")
        self.assertIn("startedAt", data)

    def test_invalid_audio_returns_400(self):
        response = self.client.post("/ml/analyze-chunk", json={"audio": "not_valid_base64!!!"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

