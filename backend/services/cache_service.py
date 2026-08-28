import json
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from backend.config import settings

logger = logging.getLogger("VoiceShield-Backend")


class InMemorySessionCache:
    """
    Thread-safe and async-safe in-memory cache fallback.
    Used when Redis is not running or disabled.
    """
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def set(self, key: str, value: Dict[str, Any], ttl: int = 86400):
        async with self._lock:
            self._store[key] = {
                "data": value,
                "expires_at": datetime.now(timezone.utc).timestamp() + ttl
            }

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if datetime.now(timezone.utc).timestamp() > entry["expires_at"]:
                del self._store[key]
                return None
            return entry["data"]

    async def delete(self, key: str):
        async with self._lock:
            if key in self._store:
                del self._store[key]

    async def get_all(self, prefix: str = "sess:") -> List[Dict[str, Any]]:
        async with self._lock:
            now = datetime.now(timezone.utc).timestamp()
            results = []
            expired_keys = []
            for k, entry in self._store.items():
                if entry["expires_at"] < now:
                    expired_keys.append(k)
                elif k.startswith(prefix):
                    results.append(entry["data"])
            for k in expired_keys:
                del self._store[k]
            return results


class CacheService:
    """
    Redis Cache Service for live ongoing phone call sessions.
    Stores rolling risk scores and active session states with microsecond latency.
    Seamlessly falls back to in-memory cache if Redis is unavailable.
    """

    def __init__(self):
        self.redis_client = None
        self.use_redis = False
        self.fallback = InMemorySessionCache()
        self._initialized = False

    async def initialize(self):
        """Attempts to connect to Redis, or falls back to in-memory store."""
        if self._initialized:
            return

        if settings.REDIS_ENABLED:
            try:
                import redis.asyncio as aioredis
                self.redis_client = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1.5
                )
                # Ping test
                await self.redis_client.ping()
                self.use_redis = True
                logger.info(f"Connected to Redis cache at {settings.REDIS_URL}")
            except Exception as e:
                logger.warning(f"Redis unavailable ({e}). Falling back to fast In-Memory session cache.")
                self.use_redis = False
                self.redis_client = None
        else:
            logger.info("Redis disabled in settings. Using In-Memory session cache.")
            self.use_redis = False

        self._initialized = True

    async def close(self):
        """Closes Redis connections on server shutdown."""
        if self.use_redis and self.redis_client:
            try:
                await self.redis_client.aclose()
            except Exception:
                pass

    def _key(self, session_id: str) -> str:
        return f"sess:{session_id}"

    async def set_session_state(self, session_id: str, data: Dict[str, Any], ttl: Optional[int] = None) -> None:
        """Saves live session state."""
        if not self._initialized:
            await self.initialize()

        ttl_sec = ttl or settings.SESSION_CACHE_TTL_SEC
        key = self._key(session_id)

        if self.use_redis and self.redis_client:
            try:
                await self.redis_client.setex(key, ttl_sec, json.dumps(data, default=str))
                return
            except Exception as e:
                logger.warning(f"Redis write error ({e}), writing to in-memory fallback.")

        await self.fallback.set(key, data, ttl_sec)

    async def get_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves live session state."""
        if not self._initialized:
            await self.initialize()

        key = self._key(session_id)
        if self.use_redis and self.redis_client:
            try:
                raw = await self.redis_client.get(key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.warning(f"Redis read error ({e}), reading from in-memory fallback.")

        return await self.fallback.get(key)

    async def update_running_risk(
        self,
        session_id: str,
        running_risk: float,
        chunk_seq: int,
        synthetic_score: float,
        speaker_match_score: float,
        risk_level: str,
        recommendation: str
    ) -> Dict[str, Any]:
        """Updates live risk metrics for an active session."""
        state = await self.get_session_state(session_id) or {
            "sessionId": session_id,
            "chunkCount": 0,
            "currentRisk": 0.0,
            "status": "ACTIVE"
        }

        state["chunkCount"] = chunk_seq
        state["currentRisk"] = running_risk
        state["lastSyntheticScore"] = synthetic_score
        state["lastSpeakerMatchScore"] = speaker_match_score
        state["riskLevel"] = risk_level
        state["recommendation"] = recommendation
        state["lastUpdatedAt"] = datetime.now(timezone.utc).isoformat()

        await self.set_session_state(session_id, state)
        return state

    async def delete_session_state(self, session_id: str) -> None:
        """Deletes session cache upon completion."""
        if not self._initialized:
            await self.initialize()

        key = self._key(session_id)
        if self.use_redis and self.redis_client:
            try:
                await self.redis_client.delete(key)
            except Exception:
                pass

        await self.fallback.delete(key)

    async def get_all_active_sessions(self) -> List[Dict[str, Any]]:
        """Returns all currently cached active sessions."""
        if not self._initialized:
            await self.initialize()

        if self.use_redis and self.redis_client:
            try:
                keys = await self.redis_client.keys("sess:*")
                if keys:
                    items = await self.redis_client.mget(keys)
                    return [json.loads(it) for it in items if it]
            except Exception as e:
                logger.warning(f"Redis keys error ({e}), using in-memory fallback.")

        return await self.fallback.get_all("sess:")


cache_service = CacheService()
