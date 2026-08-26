import sys
import json
import struct
import base64
import time
import asyncio
from pathlib import Path
import httpx
import websockets

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.config import settings


async def run_websocket_demo():
    print("=" * 75)
    print(" VoiceShield AI - Real-Time WebSocket Streaming Client Demo")
    print("=" * 75)

    base_http = f"http://localhost:{settings.PORT}"
    base_ws = f"ws://localhost:{settings.PORT}"

    # Load audio samples
    payloads_file = root_dir / "samples" / "sample_payloads.json"
    if not payloads_file.exists():
        print("Sample payloads not found.")
        return

    with open(payloads_file, "r") as f:
        payloads = json.load(f)

    async with httpx.AsyncClient(base_url=base_http, timeout=10.0) as http_client:
        # Step 1: Health check
        try:
            health = await http_client.get("/health")
            print(f"[+] Backend status: {health.json()['status']}")
        except Exception as e:
            print(f"[-] Backend server is not running on {base_http}. Start it with 'python backend/scripts/run_backend.py'. Error: {e}")
            return

        # Step 2: Enroll CFO voice profile
        print("\n[Step 1] Enrolling CFO Voiceprint via REST API (POST /api/voiceprint/enroll)...")
        cfo_samples = [
            payloads["cfo_enrollment_1.wav"],
            payloads["cfo_enrollment_2.wav"],
            payloads["cfo_enrollment_3.wav"]
        ]
        enroll_res = await http_client.post("/api/voiceprint/enroll", json={
            "personName": "Ramesh Kumar",
            "role": "CFO",
            "orgId": "org_enterprise_01",
            "audioSamples": cfo_samples
        })
        profile_data = enroll_res.json()
        profile_id = profile_data["profileId"]
        print(f"  [+] Enrolled Profile: {profile_id} ({profile_data['personName']} - {profile_data['role']})")
        print(f"  [+] Privacy: Raw audio discarded, 192-d ECAPA-TDNN embedding vector saved.")

        # Step 3: Start Monitoring Session
        print("\n[Step 2] Initializing Monitoring Session (POST /api/session/start)...")
        session_res = await http_client.post("/api/session/start", json={
            "claimedIdentity": profile_id,
            "context": {
                "callType": "fund_transfer_approval",
                "amount": 5000000.0,
                "callerNumber": "+919876543210"
            }
        })
        session_data = session_res.json()
        session_id = session_data["sessionId"]
        ws_url = session_data["websocketUrl"]
        print(f"  [+] Session ID:    {session_id}")
        print(f"  [+] WebSocket URL: {ws_url}")

        # Step 4: Stream 3-second audio chunks over WebSocket
        print("\n[Step 3] Connecting to WebSocket and streaming 3-second audio chunks...")
        test_chunks = [
            ("Genuine CFO Voice (Chunk 1)", payloads["cfo_genuine_live_chunk.wav"]),
            ("Genuine CFO Voice (Chunk 2)", payloads["cfo_genuine_live_chunk.wav"]),
            ("AI-Cloned Voice Attack (Chunk 3)", payloads["cfo_ai_clone_attack_chunk.wav"]),
            ("Unknown Attacker Voice (Chunk 4)", payloads["attacker_different_voice_chunk.wav"])
        ]

        async with websockets.connect(f"{base_ws}/ws/session/{session_id}") as ws:
            for seq, (label, b64_audio) in enumerate(test_chunks, start=1):
                raw_audio = base64.b64decode(b64_audio)
                
                # Format binary frame: [4 bytes sequence number: big-endian][remaining bytes: audio]
                seq_bytes = struct.pack(">I", seq)
                binary_frame = seq_bytes + raw_audio

                print(f"\n  ---> Sending Chunk {seq}: [{label}] ({len(binary_frame)} bytes)")
                t_start = time.perf_counter()
                await ws.send(binary_frame)

                # Receive JSON evaluation
                resp_json = await ws.recv()
                t_end = time.perf_counter()
                result = json.loads(resp_json)

                latency = round((t_end - t_start) * 1000, 2)
                risk_pct = result["runningRisk"] * 100
                synth_pct = result["syntheticScore"] * 100
                spk_pct = result["speakerMatchScore"] * 100

                print(f"  <--- Received Scoring Response ({latency} ms):")
                print(f"       * Speaker Match:   {spk_pct:5.1f}%")
                print(f"       * Synthetic Score: {synth_pct:5.1f}%")
                print(f"       * Running Risk:    {risk_pct:5.1f}% -> [{result['riskLevel']}]")
                print(f"       * Recommendation:  *** {result['recommendation']} ***")
                if result.get("alertTriggered"):
                    print(f"       * [ALERT FIRED] Actionable security alert logged!")

                await asyncio.sleep(0.3)

        # Step 5: Query Session History & Alerts via REST API
        print("\n" + "-" * 75)
        print("[Step 4] Querying Session History & Logged Alerts from Database...")
        hist_res = await http_client.get(f"/api/session/{session_id}/history")
        hist_data = hist_res.json()
        print(f"  [+] Chunks Logged in DB: {len(hist_data['chunks'])}")
        print(f"  [+] Final Session Risk:  {hist_data['finalRisk'] * 100:.1f}%")
        print(f"  [+] Alerts Triggered:    {len(hist_data['alertsFired'])}")
        for alt in hist_data["alertsFired"]:
            print(f"      - Chunk {alt['chunkSeq']}: {alt['type']} (Reason: {alt.get('reason')})")

        # Step 6: End Session
        print("\n[Step 5] Ending Monitoring Session (POST /api/session/{sessionId}/end)...")
        end_res = await http_client.post(f"/api/session/{session_id}/end")
        end_data = end_res.json()
        print(f"  [+] Status: {end_data['status']} | Final Risk: {end_data['finalRisk'] * 100:.1f}% [{end_data['riskLevel']}]")

    print("\n" + "=" * 75)
    print(" WebSocket Client Demo completed successfully!")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(run_websocket_demo())
