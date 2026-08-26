import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.db_models import VoiceProfile, Session, SessionChunk, Alert


@pytest.mark.asyncio
async def test_voice_profile_crud(db_session: AsyncSession):
    """Tests creating, retrieving, and verifying voice profiles in database."""
    sample_embedding = [0.05 * i for i in range(192)]

    profile = VoiceProfile(
        person_name="Ramesh Kumar",
        role="CFO",
        org_id="org_sih_123",
        embedding=sample_embedding,
        sample_count=3
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    assert profile.id.startswith("vp_")
    assert profile.person_name == "Ramesh Kumar"
    assert profile.role == "CFO"
    assert len(profile.embedding) == 192
    assert profile.sample_count == 3

    # Verify Privacy: There should NOT be an 'audio' or 'raw_audio' column in VoiceProfile
    assert not hasattr(profile, "raw_audio")
    assert not hasattr(profile, "audio")


@pytest.mark.asyncio
async def test_session_lifecycle_and_relationships(db_session: AsyncSession):
    """Tests session creation, chunks logging, alerts, and relations."""
    # 1. Create Profile
    profile = VoiceProfile(
        person_name="Alice CFO",
        role="CFO",
        embedding=[0.1] * 192,
        sample_count=2
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)

    # 2. Create Session
    session = Session(
        claimed_profile_id=profile.id,
        call_type="fund_transfer_approval",
        amount=2500000.0,
        caller_number="+919876543210",
        final_risk=0.0
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    assert session.id.startswith("sess_")
    assert session.status == "ACTIVE"

    # 3. Add Session Chunks
    chunk1 = SessionChunk(
        session_id=session.id,
        chunk_seq=1,
        synthetic_score=0.10,
        speaker_match_score=0.90,
        running_risk=0.10
    )
    chunk2 = SessionChunk(
        session_id=session.id,
        chunk_seq=2,
        synthetic_score=0.85,
        speaker_match_score=0.35,
        running_risk=0.75
    )
    db_session.add_all([chunk1, chunk2])
    await db_session.commit()

    # 4. Add Alert
    alert = Alert(
        session_id=session.id,
        chunk_seq=2,
        alert_type="VERIFY_CALLBACK",
        risk_score=0.75,
        reason="AI Voice clone detected"
    )
    db_session.add(alert)
    await db_session.commit()

    # 5. Query session
    stmt = select(Session).where(Session.id == session.id)
    res = await db_session.execute(stmt)
    loaded_session = res.scalars().first()

    assert loaded_session is not None
    assert loaded_session.claimed_profile_id == profile.id
