import base64
import json
from pathlib import Path
import sys
import unittest

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx

from app.services.ml_service_client import (
    MLServiceClient,
    MLServiceError,
    MLServiceConnectionError,
    MLServiceTimeoutError,
    MLServiceResponseError,
)


class TestMLServiceClient(unittest.IsolatedAsyncioTestCase):

    async def test_analyze_chunk_success_with_all_fields(self):
        recorded_request = None

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal recorded_request
            recorded_request = request
            data = json.loads(request.content.decode("utf-8"))
            self.assertEqual(request.url.path, "/ml/analyze-chunk")
            self.assertIn("audio", data)
            self.assertEqual(data["compareToProfileId"], "vp_test123")
            self.assertEqual(data["profileEmbedding"], [0.1, 0.2, 0.3])
            self.assertEqual(data["sessionId"], "sess_abc")
            self.assertEqual(data["chunkSeq"], 5)

            return httpx.Response(
                status_code=200,
                json={
                    "syntheticScore": 0.15,
                    "speakerMatchScore": 0.92,
                    "runningRisk": 0.115,
                    "riskLevel": "LOW",
                    "recommendation": "ALLOW",
                    "latencyMs": 35.4,
                    "audioDurationSec": 3.0,
                    "isSilent": False,
                    "details": {"synthetic": {"is_synthetic": False}},
                },
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            raw_audio = b"\x00\x01\x02\x03" * 1000

            result = await client.analyze_chunk(
                audio_bytes=raw_audio,
                profile_embedding=[0.1, 0.2, 0.3],
                compare_to_profile_id="vp_test123",
                session_id="sess_abc",
                chunk_seq=5,
            )

            self.assertEqual(result["syntheticScore"], 0.15)
            self.assertEqual(result["speakerMatchScore"], 0.92)
            self.assertEqual(result["riskLevel"], "LOW")
            self.assertEqual(result["recommendation"], "ALLOW")

            expected_b64 = base64.b64encode(raw_audio).decode("utf-8")
            body = json.loads(recorded_request.content.decode("utf-8"))
            self.assertEqual(body["audio"], expected_b64)

    async def test_analyze_chunk_omits_optional_fields_when_none(self):
        recorded_data = None

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal recorded_data
            recorded_data = json.loads(request.content.decode("utf-8"))
            return httpx.Response(
                status_code=200,
                json={
                    "syntheticScore": 0.05,
                    "speakerMatchScore": 1.0,
                    "runningRisk": 0.05,
                    "riskLevel": "LOW",
                    "recommendation": "ALLOW",
                    "latencyMs": 20.0,
                    "audioDurationSec": 3.0,
                    "isSilent": False,
                },
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            raw_audio = b"dummy_audio_bytes"

            result = await client.analyze_chunk(audio_bytes=raw_audio)

            self.assertIn("audio", recorded_data)
            self.assertNotIn("profileEmbedding", recorded_data)
            self.assertNotIn("compareToProfileId", recorded_data)
            self.assertNotIn("sessionId", recorded_data)
            self.assertNotIn("chunkSeq", recorded_data)
            self.assertEqual(result["syntheticScore"], 0.05)

    async def test_analyze_chunk_empty_audio_raises_value_error(self):
        client = MLServiceClient()
        with self.assertRaises(ValueError):
            await client.analyze_chunk(audio_bytes=b"")

    async def test_extract_embedding_success(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/ml/extract-embedding")
            data = json.loads(request.content.decode("utf-8"))
            self.assertEqual(len(data["audioSamples"]), 3)
            return httpx.Response(
                status_code=200,
                json={
                    "embedding": [0.05] * 192,
                    "dimension": 192,
                    "sampleCount": 3,
                },
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            samples = ["sample1_b64", "sample2_b64", "sample3_b64"]

            result = await client.extract_embedding(audio_samples=samples)
            self.assertEqual(len(result["embedding"]), 192)
            self.assertEqual(result["dimension"], 192)
            self.assertEqual(result["sampleCount"], 3)

    async def test_extract_embedding_empty_samples_raises_value_error(self):
        client = MLServiceClient()
        with self.assertRaises(ValueError):
            await client.extract_embedding(audio_samples=[])

    async def test_http_400_error_raises_ml_service_response_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=400,
                json={"detail": "Invalid audio format payload"},
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            with self.assertRaises(MLServiceResponseError) as ctx:
                await client.analyze_chunk(audio_bytes=b"invalid_bytes")

            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("Invalid audio format payload", str(ctx.exception))

    async def test_http_500_error_raises_ml_service_response_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=500,
                json={"detail": "CUDA out of memory during WavLM inference"},
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            with self.assertRaises(MLServiceResponseError) as ctx:
                await client.analyze_chunk(audio_bytes=b"some_audio")

            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("CUDA out of memory", str(ctx.exception))

    async def test_timeout_raises_ml_service_timeout_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("Read timed out")

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", timeout=1.0, client=mock_client)
            with self.assertRaises(MLServiceTimeoutError):
                await client.analyze_chunk(audio_bytes=b"audio_timeout_test")

    async def test_connection_error_raises_ml_service_connection_error(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("Connection refused to 127.0.0.1:8001")

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://test-ml:8001") as mock_client:
            client = MLServiceClient(base_url="http://test-ml:8001", client=mock_client)
            with self.assertRaises(MLServiceConnectionError) as ctx:
                await client.analyze_chunk(audio_bytes=b"audio_bytes")

            self.assertIn("Connection refused", str(ctx.exception))

    async def test_context_manager_lifecycle(self):
        async with MLServiceClient(base_url="http://127.0.0.1:8001") as client:
            self.assertEqual(client.base_url, "http://127.0.0.1:8001")
            self.assertIsNotNone(client)

    async def test_trailing_slash_stripped(self):
        client = MLServiceClient(base_url="http://127.0.0.1:8001/")
        self.assertEqual(client.base_url, "http://127.0.0.1:8001")


if __name__ == "__main__":
    unittest.main()
