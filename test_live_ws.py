import asyncio
import json
import base64
import struct
import urllib.request
import websockets

async def test_full_session_flow():
    payloads = json.load(open('samples/sample_payloads.json'))
    
    # 1. Start Session with CFO Claimed Identity and High-Value Context
    start_req = urllib.request.Request(
        'http://127.0.0.1:8000/api/session/start',
        data=json.dumps({
            'claimedIdentity': 'vp_8938d26a31d1',
            'context': {
                'callType': 'fund_transfer_approval',
                'amount': 5000000,
                'callerNumber': '+91 98765 43210'
            }
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    with urllib.request.urlopen(start_req) as res:
        session_info = json.loads(res.read())
        session_id = session_info['sessionId']
        ws_url = session_info['websocketUrl'].replace('http://', 'ws://').replace('0.0.0.0', '127.0.0.1')
        print(f"Session Created: {session_id}")
        print(f"WebSocket URL: {ws_url}")

    cfo_genuine_bytes = base64.b64decode(payloads['cfo_genuine_live_chunk.wav'])
    cfo_clone_bytes = base64.b64decode(payloads['cfo_ai_clone_attack_chunk.wav'])
    attacker_bytes = base64.b64decode(payloads['attacker_different_voice_chunk.wav'])

    async with websockets.connect(ws_url) as ws:
        # Stream 1: Genuine CFO Chunk
        frame1 = struct.pack('>I', 1) + cfo_genuine_bytes
        await ws.send(frame1)
        res1 = json.loads(await ws.recv())
        print('\n=== [SCENARIO 1: Genuine CFO Calling] ===')
        print(f"WavLM Synthetic: {res1['syntheticScore']*100:.1f}%")
        print(f"ECAPA Speaker Match: {res1['speakerMatchScore']*100:.1f}%")
        print(f"Running Risk Score: {res1['runningRisk']*100:.1f}%")
        print(f"Risk Level: {res1['riskLevel']}")
        print(f"Operator Protocol: {res1['recommendation']}")
        print(f"Inference Latency: {res1['latencyMs']:.1f}ms")

        # Stream 2: AI Voice Clone Attack Chunk
        frame2 = struct.pack('>I', 2) + cfo_clone_bytes
        await ws.send(frame2)
        res2 = json.loads(await ws.recv())
        print('\n=== [SCENARIO 2: AI Clone Deepfake Attack] ===')
        print(f"WavLM Synthetic: {res2['syntheticScore']*100:.1f}%")
        print(f"ECAPA Speaker Match: {res2['speakerMatchScore']*100:.1f}%")
        print(f"Running Risk Score: {res2['runningRisk']*100:.1f}%")
        print(f"Risk Level: {res2['riskLevel']}")
        print(f"Operator Protocol: {res2['recommendation']}")
        print(f"Alert Triggered: {res2['alertTriggered']}")
        print(f"Inference Latency: {res2['latencyMs']:.1f}ms")

        # Stream 3: Unknown Attacker Voice Chunk
        frame3 = struct.pack('>I', 3) + attacker_bytes
        await ws.send(frame3)
        res3 = json.loads(await ws.recv())
        print('\n=== [SCENARIO 3: Impersonator (Unknown Voice)] ===')
        print(f"WavLM Synthetic: {res3['syntheticScore']*100:.1f}%")
        print(f"ECAPA Speaker Match: {res3['speakerMatchScore']*100:.1f}%")
        print(f"Running Risk Score: {res3['runningRisk']*100:.1f}%")
        print(f"Risk Level: {res3['riskLevel']}")
        print(f"Operator Protocol: {res3['recommendation']}")
        print(f"Inference Latency: {res3['latencyMs']:.1f}ms")

if __name__ == '__main__':
    asyncio.run(test_full_session_flow())
