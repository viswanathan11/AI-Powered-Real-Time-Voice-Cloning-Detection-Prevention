import sys
import io
import base64
import numpy as np
import soundfile as sf
import pytest
import pytest_asyncio
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.database import Base, get_db
from backend.main import app
from httpx import AsyncClient, ASGITransport


from sqlalchemy.pool import StaticPool

# Test in-memory SQLite database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_async_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides a fresh database schema and session for each test."""
    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestAsyncSessionLocal() as session:
        yield session

    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provides an async HTTP test client with database dependency override."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def generate_b64_audio():
    """Helper fixture to generate base64-encoded synthetic sine WAV audio clips."""
    def _generator(freq: float = 300.0, duration: float = 1.0, sr: int = 16000, amp: float = 0.5) -> str:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)
        byte_io = io.BytesIO()
        sf.write(byte_io, audio, sr, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        return base64.b64encode(byte_io.read()).decode("utf-8")
    return _generator


@pytest.fixture
def generate_raw_wav_bytes():
    """Helper fixture to generate raw WAV bytes."""
    def _generator(freq: float = 300.0, duration: float = 1.0, sr: int = 16000, amp: float = 0.5) -> bytes:
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)
        byte_io = io.BytesIO()
        sf.write(byte_io, audio, sr, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        return byte_io.read()
    return _generator
