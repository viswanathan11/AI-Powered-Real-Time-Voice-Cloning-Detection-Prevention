"""
ML Service HTTP Client.

Provides asynchronous HTTP communication with the VoiceShield Python ML Service.
Responsible ONLY for serialization, network transport, error handling, and
deserialization of ML service requests and responses.
"""

import base64
import logging
from typing import Any, List, Optional
import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)


class MLServiceError(Exception):
    """Base exception for all ML service communication errors."""
    pass


class MLServiceConnectionError(MLServiceError):
    """Raised when the client fails to connect to the ML service."""
    pass


class MLServiceTimeoutError(MLServiceError):
    """Raised when an HTTP request to the ML service times out."""
    pass


class MLServiceResponseError(MLServiceError):
    """Raised when the ML service responds with an HTTP error status (4xx/5xx)."""

    def __init__(self, status_code: int, message: str, detail: Any = None):
        super().__init__(f"ML service returned HTTP {status_code}: {message}")
        self.status_code = status_code
        self.detail = detail


class MLServiceClient:
    """
    Asynchronous client for the VoiceShield ML Service API.

    Handles communication with:
    - POST /ml/analyze-chunk: Live 3-second audio chunk deepfake & speaker analysis.
    - POST /ml/extract-embedding: Extraction of 192-dim speaker vectors for enrollment.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        """
        Initialize the ML service client.

        Args:
            base_url: Base URL of the ML service (defaults to settings.ML_SERVICE_URL).
            timeout: Request timeout in seconds (defaults to settings.ML_SERVICE_TIMEOUT_SEC).
            client: Optional external httpx.AsyncClient instance for connection pooling / testing.
        """
        self.base_url = (base_url or settings.ML_SERVICE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.ML_SERVICE_TIMEOUT_SEC
        self._external_client = client
        self._internal_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Returns the active httpx.AsyncClient instance."""
        if self._external_client is not None:
            return self._external_client
        if self._internal_client is None or self._internal_client.is_closed:
            self._internal_client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._internal_client

    async def close(self) -> None:
        """Closes internal HTTP client if one was created."""
        if self._internal_client is not None and not self._internal_client.is_closed:
            await self._internal_client.aclose()
            self._internal_client = None

    async def __aenter__(self) -> "MLServiceClient":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    async def analyze_chunk(
        self,
        audio_bytes: bytes,
        profile_embedding: Optional[List[float]] = None,
        compare_to_profile_id: Optional[str] = None,
        session_id: Optional[str] = None,
        chunk_seq: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Submits an audio chunk to the ML service for deepfake detection and speaker verification.

        Args:
            audio_bytes: Raw 16kHz audio data bytes (WAV container or PCM).
            profile_embedding: Optional 192-dim reference speaker embedding.
            compare_to_profile_id: Optional ID of enrolled voice profile.
            session_id: Optional session identifier for tracking.
            chunk_seq: Optional chunk sequence number.

        Returns:
            Dict containing ML service analysis results:
            - syntheticScore (float): Deepfake probability [0.0, 1.0].
            - speakerMatchScore (float): Speaker match probability [0.0, 1.0].
            - runningRisk (float): Composite risk score [0.0, 1.0].
            - riskLevel (str): Severity classification (LOW, MEDIUM, HIGH, CRITICAL).
            - recommendation (str): Actionable advice (ALLOW, MONITOR, VERIFY_CALLBACK, ESCALATE).
            - latencyMs (float): ML inference time.
            - isSilent (bool): True if chunk is silent.
            - details (dict): Diagnostic acoustic breakdown.

        Raises:
            MLServiceTimeoutError: If the request times out.
            MLServiceConnectionError: If connection to ML service fails.
            MLServiceResponseError: If ML service returns HTTP 4xx or 5xx.
        """
        if not audio_bytes:
            raise ValueError("audio_bytes cannot be empty")

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        payload: dict[str, Any] = {
            "audio": audio_b64,
        }

        if profile_embedding is not None:
            payload["profileEmbedding"] = profile_embedding
        if compare_to_profile_id is not None:
            payload["compareToProfileId"] = compare_to_profile_id
        if session_id is not None:
            payload["sessionId"] = session_id
        if chunk_seq is not None:
            payload["chunkSeq"] = chunk_seq

        return await self._post("/ml/analyze-chunk", payload)

    async def extract_embedding(
        self,
        audio_samples: List[str],
    ) -> dict[str, Any]:
        """
        Submits genuine audio samples to extract/average a 192-dim ECAPA-TDNN speaker embedding.

        Args:
            audio_samples: List of base64-encoded audio clips (typically 3-5 clips).

        Returns:
            Dict containing:
            - embedding (List[float]): 192-dimensional unit-normalized vector.
            - dimension (int): Vector dimension (192).
            - sampleCount (int): Number of audio samples averaged.

        Raises:
            MLServiceTimeoutError: If the request times out.
            MLServiceConnectionError: If connection to ML service fails.
            MLServiceResponseError: If ML service returns HTTP 4xx or 5xx.
        """
        if not audio_samples:
            raise ValueError("audio_samples list cannot be empty")

        payload: dict[str, Any] = {
            "audioSamples": audio_samples,
        }

        return await self._post("/ml/extract-embedding", payload)

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Helper to send POST request and handle errors cleanly."""
        client = await self._get_client()
        url = f"{self.base_url}{path}" if not path.startswith("http") else path

        try:
            response = await client.post(
                url,
                json=payload,
                timeout=self.timeout,
            )
        except httpx.TimeoutException as exc:
            logger.error("ML service request timed out  url=%s  timeout=%ss", url, self.timeout)
            raise MLServiceTimeoutError(
                f"Request to ML service at {url} timed out after {self.timeout}s"
            ) from exc
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            logger.error("ML service connection failed  url=%s  error=%s", url, exc)
            raise MLServiceConnectionError(
                f"Failed to connect to ML service at {self.base_url}: {exc}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("ML service request error  url=%s  error=%s", url, exc)
            raise MLServiceConnectionError(
                f"Network communication error with ML service at {self.base_url}: {exc}"
            ) from exc

        if response.is_error:
            detail: Any = None
            try:
                error_body = response.json()
                detail = error_body.get("detail", response.text)
            except Exception:
                detail = response.text

            logger.error(
                "ML service returned error  status=%s  url=%s  detail=%s",
                response.status_code,
                url,
                detail,
            )
            raise MLServiceResponseError(
                status_code=response.status_code,
                message=str(detail),
                detail=detail,
            )

        try:
            return response.json()
        except Exception as exc:
            logger.error("Failed to parse ML service response JSON  url=%s", url)
            raise MLServiceError(f"Invalid JSON response from ML service: {exc}") from exc


# Global singleton instance for convenient reuse
ml_service_client = MLServiceClient()
