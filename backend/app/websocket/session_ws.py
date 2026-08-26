import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ml_service_client import (
    ml_service_client,
    MLServiceTimeoutError,
    MLServiceConnectionError,
    MLServiceResponseError,
    MLServiceError,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/session/{session_id}")
async def session_websocket(websocket: WebSocket, session_id: str) -> None:
    """
    WebSocket endpoint for a voice-cloning detection session.

    Clients stream raw audio as binary frames (target: 3-second chunks).
    For each binary frame, the chunk is forwarded to the ML service via MLServiceClient,
    and the analysis result (synthetic score, speaker match score, etc.) is returned over the WebSocket.

    URL: ws://<host>/ws/session/{session_id}
    """
    await websocket.accept()
    logger.info("WebSocket connected  session_id=%s", session_id)

    chunk_seq: int = 0

    try:
        while True:
            message = await websocket.receive()

            # Client initiated a clean disconnect
            if message["type"] == "websocket.disconnect":
                logger.info("WebSocket disconnect  session_id=%s", session_id)
                break

            # Binary frame (expected path: raw audio bytes)
            if message.get("bytes") is not None:
                audio_data: bytes = message["bytes"]
                chunk_seq += 1

                try:
                    ml_result = await ml_service_client.analyze_chunk(
                        audio_bytes=audio_data,
                        session_id=session_id,
                        chunk_seq=chunk_seq,
                    )

                    response_payload: Dict[str, Any] = {
                        "sessionId": session_id,
                        "chunkSeq": chunk_seq,
                        "status": "ANALYZED",
                        "syntheticScore": ml_result.get("syntheticScore", 0.0),
                        "speakerMatchScore": ml_result.get("speakerMatchScore", 1.0),
                    }

                    if "latencyMs" in ml_result:
                        response_payload["latencyMs"] = ml_result["latencyMs"]
                    if "audioDurationSec" in ml_result:
                        response_payload["audioDurationSec"] = ml_result["audioDurationSec"]
                    if "isSilent" in ml_result:
                        response_payload["isSilent"] = ml_result["isSilent"]

                    await websocket.send_text(json.dumps(response_payload))

                except MLServiceTimeoutError as err:
                    logger.warning(
                        "ML service timeout for session %s chunk %d: %s",
                        session_id,
                        chunk_seq,
                        err,
                    )
                    error_payload = {
                        "sessionId": session_id,
                        "chunkSeq": chunk_seq,
                        "status": "ERROR",
                        "error": "ML_SERVICE_TIMEOUT",
                        "message": str(err),
                    }
                    await websocket.send_text(json.dumps(error_payload))

                except MLServiceConnectionError as err:
                    logger.warning(
                        "ML service unavailable for session %s chunk %d: %s",
                        session_id,
                        chunk_seq,
                        err,
                    )
                    error_payload = {
                        "sessionId": session_id,
                        "chunkSeq": chunk_seq,
                        "status": "ERROR",
                        "error": "ML_SERVICE_UNAVAILABLE",
                        "message": str(err),
                    }
                    await websocket.send_text(json.dumps(error_payload))

                except MLServiceResponseError as err:
                    logger.warning(
                        "ML service error response for session %s chunk %d: %s",
                        session_id,
                        chunk_seq,
                        err,
                    )
                    error_payload = {
                        "sessionId": session_id,
                        "chunkSeq": chunk_seq,
                        "status": "ERROR",
                        "error": "ML_SERVICE_RESPONSE_ERROR",
                        "message": str(err),
                    }
                    await websocket.send_text(json.dumps(error_payload))

                except Exception as err:
                    logger.exception(
                        "Unexpected error processing chunk %d for session %s: %s",
                        chunk_seq,
                        session_id,
                        err,
                    )
                    error_payload = {
                        "sessionId": session_id,
                        "chunkSeq": chunk_seq,
                        "status": "ERROR",
                        "error": "PROCESSING_ERROR",
                        "message": str(err),
                    }
                    await websocket.send_text(json.dumps(error_payload))

            # Text frame (unexpected; return a descriptive error)
            elif message.get("text") is not None:
                error_msg = {
                    "sessionId": session_id,
                    "status": "ERROR",
                    "error": "INVALID_FRAME_TYPE",
                    "message": "Expected binary audio data; received text frame.",
                }
                await websocket.send_text(json.dumps(error_msg))

    except WebSocketDisconnect:
        logger.info("WebSocket closed  session_id=%s", session_id)
    except Exception as exc:  # pragma: no cover
        logger.error("WebSocket error  session_id=%s  error=%s", session_id, exc)
