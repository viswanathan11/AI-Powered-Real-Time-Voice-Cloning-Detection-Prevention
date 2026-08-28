import sys
import json
import asyncio
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.database import init_db, AsyncSessionLocal
from backend.services.voiceprint_service import voiceprint_service
from backend.services.session_service import session_service
from backend.schemas.voiceprint import EnrollVoiceprintRequest


async def seed_data():
    print("=" * 70)
    print(" VoiceShield Backend - Seeding Demo Voiceprint & Sessions")
    print("=" * 70)

    # 1. Initialize DB tables
    await init_db()
    print("[+] Database tables verified/initialized.")

    payloads_file = root_dir / "samples" / "sample_payloads.json"
    if not payloads_file.exists():
        print("[*] Sample payloads not found. Generating sample audio files...")
        from ml_service.scripts.generate_sample_audio import main as gen_audio
        gen_audio()

    with open(payloads_file, "r") as f:
        payloads = json.load(f)

    # 2. Enroll CFO Voiceprint
    print("\n[Step 1] Enrolling CFO Voice Profile (Ramesh Kumar)...")
    cfo_samples = [
        payloads["cfo_enrollment_1.wav"],
        payloads["cfo_enrollment_2.wav"],
        payloads["cfo_enrollment_3.wav"]
    ]

    async with AsyncSessionLocal() as db:
        # Check if already enrolled
        existing_profiles, _ = await voiceprint_service.list_profiles(db, limit=5)
        cfo_profile = None
        for p in existing_profiles:
            if p.person_name == "Ramesh Kumar":
                cfo_profile = p
                print(f"  [i] Found existing profile: ID={p.id}")
                break

        if not cfo_profile:
            req = EnrollVoiceprintRequest(
                personName="Ramesh Kumar",
                role="CFO",
                orgId="org_enterprise_01",
                audioSamples=cfo_samples
            )
            cfo_profile = await voiceprint_service.enroll_voiceprint(db, req)
            print(f"  [+] Enrolled New Voice Profile:")
            print(f"      Profile ID:   {cfo_profile.id}")
            print(f"      Name:         {cfo_profile.person_name} ({cfo_profile.role})")
            print(f"      Sample Count: {cfo_profile.sample_count}")
            print(f"      Privacy:      Numerical embedding saved (192-d), raw audio discarded.")

        # 3. Create Sample Monitoring Session
        print("\n[Step 2] Creating Sample Monitoring Session...")
        context = {
            "callType": "fund_transfer_approval",
            "amount": 5000000.0,
            "callerNumber": "+919876543210"
        }
        session, ws_url = await session_service.start_session(
            db=db,
            claimed_profile_id=cfo_profile.id,
            context=context,
            host_url="http://localhost:8000"
        )
        print(f"  [+] Created Session:")
        print(f"      Session ID:     {session.id}")
        print(f"      Claimed Identity: {session.claimed_profile_id}")
        print(f"      Transaction:    {session.call_type} (INR {session.amount:,.2f})")
        print(f"      WebSocket URL:  {ws_url}")

    print("\n" + "=" * 70)
    print(" Database seeding completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(seed_data())
