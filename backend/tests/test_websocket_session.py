from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.services.ml_service_client import (
    MLServiceTimeoutError,
    MLServiceConnectionError,
    MLServiceResponseError,
)


class TestWebSocketSession(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    @patch("app.websocket.session_ws.ml_service_client.analyze_chunk", new_callable=AsyncMock)
    def test_binary_audio_calls_ml_and_returns_analyzed_result(self, mock_analyze):
        mock_analyze.return_value = {
            "syntheticScore": 0.73,
            "speakerMatchScore": 0.41,
            "latencyMs": 42.15,
            "audioDurationSec": 3.0,
            "isSilent": False,
        }

        with self.client.websocket_connect("/ws/session/sess_test_101") as ws:
            audio_frame = b"\x00\x01\x02\x03" * 500
            ws.send_bytes(audio_frame)

            response = ws.receive_json()

            self.assertEqual(response["sessionId"], "sess_test_101")
            self.assertEqual(response["chunkSeq"], 1)
            self.assertEqual(response["status"], "ANALYZED")
            self.assertEqual(response["syntheticScore"], 0.73)
            self.assertEqual(response["speakerMatchScore"], 0.41)
            self.assertEqual(response["latencyMs"], 42.15)
            self.assertEqual(response["audioDurationSec"], 3.0)
            self.assertFalse(response["isSilent"])

            mock_analyze.assert_called_once_with(
                audio_bytes=audio_frame,
                session_id="sess_test_101",
                chunk_seq=1,
            )

    @patch("app.websocket.session_ws.ml_service_client.analyze_chunk", new_callable=AsyncMock)
    def test_ml_timeout_returns_proper_error_response_without_disconnecting(self, mock_analyze):
        mock_analyze.side_effect = MLServiceTimeoutError("Request to ML service timed out after 10.0s")

        with self.client.websocket_connect("/ws/session/sess_timeout") as ws:
            ws.send_bytes(b"dummy_audio_chunk")
            response = ws.receive_json()

            self.assertEqual(response["sessionId"], "sess_timeout")
            self.assertEqual(response["chunkSeq"], 1)
            self.assertEqual(response["status"], "ERROR")
            self.assertEqual(response["error"], "ML_SERVICE_TIMEOUT")
            self.assertIn("timed out", response["message"])

            # Verify connection remains usable
            mock_analyze.side_effect = None
            mock_analyze.return_value = {
                "syntheticScore": 0.10,
                "speakerMatchScore": 0.95,
                "isSilent": False,
            }
            ws.send_bytes(b"next_audio_chunk")
            response2 = ws.receive_json()
            self.assertEqual(response2["chunkSeq"], 2)
            self.assertEqual(response2["status"], "ANALYZED")

    @patch("app.websocket.session_ws.ml_service_client.analyze_chunk", new_callable=AsyncMock)
    def test_ml_connection_error_returns_proper_error_response(self, mock_analyze):
        mock_analyze.side_effect = MLServiceConnectionError("Failed to connect to ML service at http://127.0.0.1:8001")

        with self.client.websocket_connect("/ws/session/sess_conn_err") as ws:
            ws.send_bytes(b"dummy_audio_chunk")
            response = ws.receive_json()

            self.assertEqual(response["sessionId"], "sess_conn_err")
            self.assertEqual(response["chunkSeq"], 1)
            self.assertEqual(response["status"], "ERROR")
            self.assertEqual(response["error"], "ML_SERVICE_UNAVAILABLE")
            self.assertIn("Failed to connect", response["message"])

    @patch("app.websocket.session_ws.ml_service_client.analyze_chunk", new_callable=AsyncMock)
    def test_ml_response_error_returns_proper_error_response(self, mock_analyze):
        mock_analyze.side_effect = MLServiceResponseError(500, "CUDA out of memory", detail="CUDA out of memory")

        with self.client.websocket_connect("/ws/session/sess_resp_err") as ws:
            ws.send_bytes(b"dummy_audio_chunk")
            response = ws.receive_json()

            self.assertEqual(response["sessionId"], "sess_resp_err")
            self.assertEqual(response["chunkSeq"], 1)
            self.assertEqual(response["status"], "ERROR")
            self.assertEqual(response["error"], "ML_SERVICE_RESPONSE_ERROR")

    def test_text_frame_returns_proper_error_response(self):
        with self.client.websocket_connect("/ws/session/sess_text") as ws:
            ws.send_text("unexpected text frame")
            response = ws.receive_json()

            self.assertEqual(response["sessionId"], "sess_text")
            self.assertEqual(response["status"], "ERROR")
            self.assertIn("Expected binary audio data", response["message"])

    @patch("app.websocket.session_ws.ml_service_client.analyze_chunk", new_callable=AsyncMock)
    def test_multiple_chunks_increment_chunk_seq_correctly(self, mock_analyze):
        mock_analyze.side_effect = [
            {"syntheticScore": 0.10, "speakerMatchScore": 0.90},
            {"syntheticScore": 0.20, "speakerMatchScore": 0.85},
            {"syntheticScore": 0.75, "speakerMatchScore": 0.30},
        ]

        with self.client.websocket_connect("/ws/session/sess_seq_test") as ws:
            for seq in (1, 2, 3):
                ws.send_bytes(f"audio_chunk_{seq}".encode("utf-8"))
                response = ws.receive_json()

                self.assertEqual(response["sessionId"], "sess_seq_test")
                self.assertEqual(response["chunkSeq"], seq)
                self.assertEqual(response["status"], "ANALYZED")

            self.assertEqual(mock_analyze.call_count, 3)


if __name__ == "__main__":
    unittest.main()
