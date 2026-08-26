import time
import asyncio
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import AsyncSessionLocal
from backend.services.audio_utils import parse_websocket_frame
from backend.services.ml_bridge import ml_bridge
from backend.services.risk_engine import risk_engine
from backend.services.session_service import session_service
from backend.services.cache_service import cache_service
from backend.services.voiceprint_service import voiceprint_service
from backend.schemas.chunk import ChunkAnalysisResult

logger = logging.getLogger("VoiceShield-Backend")
router = APIRouter(tags=["WebSocket Streaming"])


@router.websocket("/ws/session/{session_id}")
async def websocket_session_stream(websocket: WebSocket, session_id: str):
    """
    Real-Time WebSocket Audio Streaming Endpoint.
    Accepts continuous 3-second 16kHz mono audio frames from the React frontend,
    executes dual ML inference (WavLM & ECAPA-TDNN), computes composite running risk,
    and returns immediate JSON risk evaluations.

    Contract:
      Client -> Server: Binary frame [4-byte seq][16kHz PCM/WAV] or JSON text frame
      Server -> Client: JSON scoring payload
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected to session '{session_id}'.")

    # Local state for streaming session
    chunk_counter = 0
    previous_running_risk: Optional[float] = None
    claimed_embedding: Optional[List[float]] = None
    context_data: Dict[str, Any] = {}
    has_enrolled_profile = False

    # 1. Fetch Session and Enrolled Profile Reference Embedding
    async with AsyncSessionLocal() as db:
        session = await session_service.get_session_by_id(db, session_id)
        if not session:
            # If session was not pre-created via POST /api/session/start, create it automatically
            session, _ = await session_service.start_session(db=db, host_url="", session_id=session_id)
            session_id = session.id
            logger.info(f"Auto-initialized session '{session_id}'.")

        context_data = {
            "callType": session.call_type,
            "amount": session.amount,
            "callerNumber": session.caller_number
        }

        if session.claimed_profile_id:
            profile = await voiceprint_service.get_profile_by_id(db, session.claimed_profile_id)
            if profile and profile.embedding:
                claimed_embedding = profile.embedding
                has_enrolled_profile = True
                logger.info(f"Loaded reference voiceprint for '{profile.person_name}' ({len(claimed_embedding)}-d).")
            else:
                logger.warning(f"Voice profile '{session.claimed_profile_id}' has no stored embedding.")

    # 2. Main Chunk Streaming Loop
    try:
        while True:
            # Receive binary or text frame
            message = await websocket.receive()

            if "bytes" in message and message["bytes"]:
                raw_data = message["bytes"]
            elif "text" in message and message["text"]:
                raw_data = message["text"]
            else:
                continue

            chunk_counter += 1
            t0 = time.perf_counter()

            # Parse frame to extract sequence number and raw audio bytes
            try:
                chunk_seq, audio_bytes = parse_websocket_frame(raw_data, default_seq=chunk_counter)
            except Exception as parse_err:
                logger.error(f"Error parsing frame: {parse_err}")
                await websocket.send_json({
                    "sessionId": session_id,
                    "chunkSeq": chunk_counter,
                    "error": str(parse_err)
                })
                continue

            # Step A: Run ML Inference (WavLM synthetic detection & ECAPA-TDNN speaker verification)
            try:
                ml_result = ml_bridge.analyze_audio_chunk(
                    audio_input=audio_bytes,
                    profile_embedding=claimed_embedding
                )
                synthetic_score = float(ml_result.get("syntheticScore", 0.0))
                speaker_match_score = float(ml_result.get("speakerMatchScore", 1.0 if not has_enrolled_profile else 0.0))
                is_silent = bool(ml_result.get("isSilent", False))
                inference_latency = float(ml_result.get("latencyMs", 0.0))
            except Exception as ml_err:
                logger.error(f"ML inference error on chunk {chunk_seq}: {ml_err}")
                synthetic_score = 0.50
                speaker_match_score = 0.50
                is_silent = False
                inference_latency = 0.0

            # Step B: Calculate Running Risk & Tactical Recommendation via Risk Engine
            risk_eval = risk_engine.calculate_running_risk(
                synthetic_score=synthetic_score,
                speaker_match_score=speaker_match_score,
                previous_running_risk=previous_running_risk,
                context=context_data,
                has_enrolled_profile=has_enrolled_profile,
                is_silent=is_silent
            )

            running_risk = risk_eval["runningRisk"]
            risk_level = risk_eval["riskLevel"]
            recommendation = risk_eval["recommendation"]
            alert_triggered = risk_eval["alertTriggered"]
            alert_type = risk_eval["alertType"]
            alert_reason = risk_eval["reason"]

            previous_running_risk = running_risk
            total_latency = round((time.perf_counter() - t0) * 1000, 2)

            # Step C: Prepare JSON Response according to Plane.md contract
            response_payload = {
                "sessionId": session_id,
                "chunkSeq": chunk_seq,
                "syntheticScore": round(synthetic_score, 4),
                "speakerMatchScore": round(speaker_match_score, 4),
                "runningRisk": round(running_risk, 4),
                "riskLevel": risk_level,
                "recommendation": recommendation,
                "latencyMs": total_latency,
                "isSilent": is_silent,
                "alertTriggered": alert_triggered
            }

            # Step D: Asynchronous Database and Cache Persistence
            try:
                # Update Redis/In-Memory Cache
                await cache_service.update_running_risk(
                    session_id=session_id,
                    running_risk=running_risk,
                    chunk_seq=chunk_seq,
                    synthetic_score=synthetic_score,
                    speaker_match_score=speaker_match_score,
                    risk_level=risk_level,
                    recommendation=recommendation
                )

                # Persist chunk to Postgres / SQLite
                async with AsyncSessionLocal() as db:
                    await session_service.record_chunk(
                        db=db,
                        session_id=session_id,
                        chunk_seq=chunk_seq,
                        synthetic_score=synthetic_score,
                        speaker_match_score=speaker_match_score,
                        running_risk=running_risk
                    )

                    # If alert fired, record to alerts table
                    if alert_triggered and alert_type:
                        await session_service.record_alert(
                            db=db,
                            session_id=session_id,
                            chunk_seq=chunk_seq,
                            alert_type=alert_type,
                            risk_score=running_risk,
                            reason=alert_reason
                        )
            except Exception as db_err:
                logger.error(f"Error persisting chunk {chunk_seq} for session {session_id}: {db_err}")

            # Step E: Send JSON immediately back over WebSocket
            await websocket.send_json(response_payload)

    except (WebSocketDisconnect, asyncio.CancelledError):
        logger.info(f"WebSocket client disconnected from session '{session_id}' after {chunk_counter} chunks.")
        # Mark session ended with final risk
        if previous_running_risk is not None:
            try:
                async with AsyncSessionLocal() as db:
                    await session_service.end_session(db, session_id, final_risk=previous_running_risk)
            except Exception:
                pass
    except Exception as e:
        logger.error(f"WebSocket error in session '{session_id}': {e}", exc_info=True)
        try:
            await websocket.close()
        except Exception:
            pass
