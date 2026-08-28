import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Numeric,
    DateTime,
    ForeignKey,
    Index
)
from sqlalchemy.orm import relationship

from backend.database import Base, EmbeddingType


def generate_uuid() -> str:
    return str(uuid.uuid4())


def generate_profile_id() -> str:
    return f"vp_{uuid.uuid4().hex[:12]}"


def generate_session_id() -> str:
    return f"sess_{uuid.uuid4().hex[:12]}"


def generate_chunk_id() -> str:
    return f"chk_{uuid.uuid4().hex[:12]}"


def generate_alert_id() -> str:
    return f"alt_{uuid.uuid4().hex[:12]}"


def utc_now():
    return datetime.now(timezone.utc)


class VoiceProfile(Base):
    """
    Stores enrolled voiceprint reference embeddings.
    CRITICAL PRIVACY GUARANTEE: Raw audio is NEVER stored in database.
    Only the mathematical 192-dimensional ECAPA-TDNN vector is retained.
    """
    __tablename__ = "voice_profiles"

    id = Column(String(64), primary_key=True, default=generate_profile_id)
    person_name = Column(Text, nullable=False, index=True)
    role = Column(Text, nullable=True)
    org_id = Column(Text, nullable=True, index=True)
    embedding = Column(EmbeddingType, nullable=False)  # 192-dim ECAPA-TDNN vector, averaged
    sample_count = Column(Integer, default=1)
    enrolled_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    sessions = relationship("Session", back_populates="claimed_profile", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<VoiceProfile(id={self.id}, person_name={self.person_name}, role={self.role})>"


class Session(Base):
    """
    Represents an ongoing or completed call monitoring session.
    """
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True, default=generate_session_id)
    claimed_profile_id = Column(String(64), ForeignKey("voice_profiles.id", ondelete="SET NULL"), nullable=True)
    call_type = Column(Text, nullable=True)  # e.g., fund_transfer_approval, wire_transfer
    amount = Column(Float, nullable=True)     # Transaction amount if applicable
    caller_number = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    final_risk = Column(Float, nullable=True)
    status = Column(Text, default="ACTIVE")  # ACTIVE, COMPLETED, TERMINATED

    # Relationships
    claimed_profile = relationship("VoiceProfile", back_populates="sessions")
    chunks = relationship("SessionChunk", back_populates="session", cascade="all, delete-orphan", order_by="SessionChunk.chunk_seq")
    alerts = relationship("Alert", back_populates="session", cascade="all, delete-orphan", order_by="Alert.created_at")

    def __repr__(self):
        return f"<Session(id={self.id}, claimed_profile_id={self.claimed_profile_id}, status={self.status}, final_risk={self.final_risk})>"


class SessionChunk(Base):
    """
    Stores sequential 3-second audio analysis results per session.
    """
    __tablename__ = "session_chunks"

    id = Column(String(64), primary_key=True, default=generate_chunk_id)
    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_seq = Column(Integer, nullable=False)
    synthetic_score = Column(Float, nullable=False)
    speaker_match_score = Column(Float, nullable=False)
    running_risk = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    session = relationship("Session", back_populates="chunks")

    __table_args__ = (
        Index("idx_session_chunk_seq", "session_id", "chunk_seq"),
    )

    def __repr__(self):
        return f"<SessionChunk(session_id={self.session_id}, seq={self.chunk_seq}, risk={self.running_risk})>"


class Alert(Base):
    """
    Logs fraud prevention alerts fired during a call session (VERIFY_CALLBACK, ESCALATE).
    """
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, default=generate_alert_id)
    session_id = Column(String(64), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_seq = Column(Integer, nullable=False)
    alert_type = Column(Text, nullable=False)  # e.g., VERIFY_CALLBACK, ESCALATE
    risk_score = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    session = relationship("Session", back_populates="alerts")

    def __repr__(self):
        return f"<Alert(id={self.id}, session_id={self.session_id}, type={self.alert_type}, chunk_seq={self.chunk_seq})>"
