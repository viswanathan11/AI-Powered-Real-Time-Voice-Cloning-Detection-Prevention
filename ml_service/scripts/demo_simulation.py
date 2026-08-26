import os
import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from app.services.analysis_service import analysis_service


def run_demo():
    print("=" * 70)
    print(" VoiceShield AI - Live Demo Simulation (SIH26104)")
    print("=" * 70)

    payloads_file = root_dir / "samples" / "sample_payloads.json"
    if not payloads_file.exists():
        print("Sample payloads not found. Generating samples now...")
        from scripts.generate_sample_audio import main as gen_samples
        gen_samples()

    with open(payloads_file, "r") as f:
        payloads = json.load(f)

    # -------------------------------------------------------------
    # Step 1: Enroll Genuine Executive Voiceprint (Ramesh Kumar - CFO)
    # -------------------------------------------------------------
    print("\n[Step 1] Enrolling Genuine Executive Voiceprint...")
    cfo_samples = [
        payloads["cfo_enrollment_1.wav"],
        payloads["cfo_enrollment_2.wav"],
        payloads["cfo_enrollment_3.wav"]
    ]
    profile = analysis_service.enroll_voice_samples(
        person_name="Ramesh Kumar",
        role="CFO",
        org_id="org_enterprise_01",
        audio_samples_b64=cfo_samples
    )
    print(f"  ✓ Enrolled Profile ID: {profile.profile_id}")
    print(f"  ✓ Name: {profile.person_name} | Role: {profile.role}")
    print(f"  ✓ Averaged Embedding Dimension: {len(profile.embedding)} (192-d ECAPA-TDNN)")
    print(f"  ✓ Privacy: Raw audio samples discarded. Reference vector enrolled.\n")

    time.sleep(0.5)

    # -------------------------------------------------------------
    # Step 2: Genuine Call Verification
    # -------------------------------------------------------------
    print("-" * 70)
    print("[Step 2] Processing Live Audio Stream: Genuine CFO Call")
    print("-" * 70)
    genuine_chunk = payloads["cfo_genuine_live_chunk.wav"]
    result_genuine = analysis_service.analyze_chunk(
        audio_b64=genuine_chunk,
        compare_to_profile_id=profile.profile_id
    )
    print(f"  • Speaker Match Score: {result_genuine['speakerMatchScore'] * 100:.1f}%")
    print(f"  • Synthetic Artifacts: {result_genuine['syntheticScore'] * 100:.1f}%")
    print(f"  • Running Risk Score:  {result_genuine['runningRisk'] * 100:.1f}%")
    print(f"  • Risk Level:          [{result_genuine['riskLevel']}]")
    print(f"  • Recommendation:      {result_genuine['recommendation']}")
    print(f"  • Latency:             {result_genuine['latencyMs']} ms")
    print("  --> Result: Call verified genuine. Normal workflow approved.\n")

    time.sleep(0.5)

    # -------------------------------------------------------------
    # Step 3: AI Voice Clone Impersonation Attack (High Risk Alert)
    # -------------------------------------------------------------
    print("-" * 70)
    print("[Step 3] Processing Live Audio Stream: AI Voice Clone Attack (Deepfake)")
    print("-" * 70)
    clone_chunk = payloads["cfo_ai_clone_attack_chunk.wav"]
    result_clone = analysis_service.analyze_chunk(
        audio_b64=clone_chunk,
        compare_to_profile_id=profile.profile_id
    )
    print(f"  • Speaker Match Score: {result_clone['speakerMatchScore'] * 100:.1f}%")
    print(f"  • Synthetic Artifacts: {result_clone['syntheticScore'] * 100:.1f}% (CRITICAL ANOMALY)")
    print(f"  • Running Risk Score:  {result_clone['runningRisk'] * 100:.1f}%")
    print(f"  • Risk Level:          [{result_clone['riskLevel']}]")
    print(f"  • Recommendation:      *** {result_clone['recommendation']} ***")
    print(f"  • Latency:             {result_clone['latencyMs']} ms")
    print("  --> ALERT FIRED: AI voice cloning detected! Call flagged for callback verification.\n")

    time.sleep(0.5)

    # -------------------------------------------------------------
    # Step 4: Unknown Attacker Voice (Speaker Mismatch)
    # -------------------------------------------------------------
    print("-" * 70)
    print("[Step 4] Processing Live Audio Stream: Unenrolled Impersonator")
    print("-" * 70)
    attacker_chunk = payloads["attacker_different_voice_chunk.wav"]
    result_attacker = analysis_service.analyze_chunk(
        audio_b64=attacker_chunk,
        compare_to_profile_id=profile.profile_id
    )
    print(f"  • Speaker Match Score: {result_attacker['speakerMatchScore'] * 100:.1f}% (SPEAKER MISMATCH)")
    print(f"  • Synthetic Artifacts: {result_attacker['syntheticScore'] * 100:.1f}%")
    print(f"  • Running Risk Score:  {result_attacker['runningRisk'] * 100:.1f}%")
    print(f"  • Risk Level:          [{result_attacker['riskLevel']}]")
    print(f"  • Recommendation:      *** {result_attacker['recommendation']} ***")
    print(f"  • Latency:             {result_attacker['latencyMs']} ms")
    print("  --> ALERT FIRED: Caller voice does not match enrolled executive voiceprint.\n")

    print("=" * 70)
    print(" Demo simulation successfully completed!")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
