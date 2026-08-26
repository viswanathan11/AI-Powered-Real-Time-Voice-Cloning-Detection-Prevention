import json
from typing import AsyncGenerator, List, Any
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine, TypeDecorator, Text, Float
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY

from backend.config import settings

Base = declarative_base()


class EmbeddingType(TypeDecorator):
    """
    Cross-database compatible type for 192-dimensional speaker embeddings.
    Uses PostgreSQL native FLOAT8[] (ARRAY of Floats) when on PostgreSQL,
    and falls back to JSON-serialized text on SQLite.
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_ARRAY(Float))
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            # For PostgreSQL ARRAY, ensure it's a list of floats
            if isinstance(value, list):
                return [float(x) for x in value]
            return value
        else:
            # For SQLite, serialize list to JSON string
            if isinstance(value, (list, tuple)):
                return json.dumps([float(x) for x in value])
            elif isinstance(value, str):
                return value
            return json.dumps(list(value))

    def process_result_value(self, value: Any, dialect) -> List[float]:
        if value is None:
            return []
        if dialect.name == "postgresql":
            if isinstance(value, list):
                return [float(x) for x in value]
            return value
        else:
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                    return [float(x) for x in parsed]
                except Exception:
                    return []
            elif isinstance(value, list):
                return [float(x) for x in value]
            return []


from sqlalchemy.pool import NullPool, StaticPool

# Async Engine & Session
is_sqlite = "sqlite" in settings.DATABASE_URL
is_memory = ":memory:" in settings.DATABASE_URL
async_pool = StaticPool if is_memory else (NullPool if is_sqlite else None)

engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
if async_pool:
    engine_kwargs["poolclass"] = async_pool

async_engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Synchronous Engine & Session (for migrations / CLI utilities)
sync_engine = create_engine(
    settings.SYNC_DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in settings.SYNC_DATABASE_URL else {}
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False
)


async def init_db():
    """Initializes all database tables defined in Plane.md."""
    async with async_engine.begin() as conn:
        # Import models to ensure they are registered on Base.metadata
        import backend.models.db_models  # noqa
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
