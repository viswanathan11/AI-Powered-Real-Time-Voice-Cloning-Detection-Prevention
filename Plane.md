# AI-Powered Real-Time Voice Cloning Detection & Prevention
### SIH26104 (AICTE) — Project Plan

---

## 1. Problem Statement (plain summary)

Attackers use AI voice cloning to impersonate CXOs / government officials on
calls (VoIP, telephony, enterprise collaboration platforms), tricking
employees into approving fraudulent transactions or leaking sensitive info.
Existing verification (caller ID, "I recognize the voice") can't detect a
cloned voice.

**Goal:** Analyze a live call in near real time, compute a continuously
updating impersonation risk score, and alert the user (recommend callback
verification / escalate) **before** a risky action is taken — not after the
call ends.

**Scope is enterprise/institutional fraud prevention** — not general
deepfake/misinformation detection, not personal family-scam protection.
The "victim" is an employee; the "impersonated person" is a known,
enrollable, high-privilege individual (CXO/official).

Required by the official problem statement:
- Real-time risk scoring during the call
- Multilingual / Indian-accent support
- Privacy-preserving (no raw audio retention ideally; on-device/edge option)
- REST/gRPC APIs & SDK for integration with banking/enterprise/telecom systems

---

## 2. Architecture Overview

```text
[Attacker/Caller audio]                     [Employee/Dashboard]
        |                                            ^
        v                                            |
  React /simulator                          React /dashboard
  (Web Audio API,                          (live risk gauge,
   16kHz PCM capture,                       alert banner)
   3s overlapping chunks)                            ^
        |                                            |
        |  WebSocket (binary audio frames)   WebSocket (JSON scores)
        v                                            |
  ====== Unified Python Backend & ML Service (FastAPI) =======
  - WebSocket session handler & REST APIs
  - ECAPA-TDNN: speaker verification vs enrolled profile
  - WavLM-based classifier: synthetic/deepfake artifact score
  - Risk Scoring Engine (combines scores + context)
  - Session/alert persistence (Postgres) + live cache (Redis)
  =============================================================
```

**Why this architecture:** By combining the ML inference and backend logic into a single Python FastAPI service, we eliminate network overhead (no internal REST hops) and dramatically simplify the tech stack, enabling rapid iteration for the hackathon timeline.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite, Web Audio API, native WebSocket | Raw PCM capture, not `MediaRecorder` (avoids compression artifacts) |
| Backend & ML | Python + FastAPI, HuggingFace `transformers` (WavLM), SpeechBrain (ECAPA-TDNN) | Unified backend handling WebSockets, APIs, and AI inference |
| DB | PostgreSQL (profiles, sessions, alerts) | Store embeddings only, never raw audio |
| Cache | Redis | Live/rolling session risk score |
| Datasets | ASVspoof2019/2021, WaveFake | For fine-tuning the synthetic-detection head |
| Dev acceleration | AI coding tools (e.g. Claude Code) for boilerplate across all 3 codebases | Does NOT replace real iteration on model accuracy — budget real human time there |

Audio format standard: **16kHz mono PCM WAV** per chunk (resample
server-side if the mic captures at 44.1/48kHz).

---

## 4. API Contract

### Enroll a genuine voice profile
`POST /api/voiceprint/enroll`
```json
// Request
{
  "personName": "Ramesh Kumar",
  "role": "CFO",
  "orgId": "org_123",
  "audioSamples": ["<base64 wav>", "<base64 wav>", "<base64 wav>"]
}
// Response
{ "profileId": "vp_9a3f...", "personName": "Ramesh Kumar", "sampleCount": 4, "enrolledAt": "2026-08-26T10:15:00Z" }
```
Backend calls the ML service to extract embeddings per sample, averages
them into one reference vector, discards the raw audio.

### Start a session
`POST /api/session/start`
```json
// Request
{
  "claimedIdentity": "vp_9a3f...",
  "context": { "callType": "fund_transfer_approval", "amount": 5000000, "callerNumber": "+91XXXXXXXXXX" }
}
// Response
{ "sessionId": "sess_7b21...", "websocketUrl": "wss://.../ws/session/sess_7b21..." }
```

### Streaming (WebSocket)
Client → Server (binary frame per chunk):
```
[4 bytes: chunk sequence number][remaining bytes: 16kHz mono PCM WAV]
```
Server → Client (JSON, after each chunk is scored):
```json
{
  "sessionId": "sess_7b21...",
  "chunkSeq": 12,
  "syntheticScore": 0.73,
  "speakerMatchScore": 0.41,
  "runningRisk": 0.68,
  "riskLevel": "HIGH",
  "recommendation": "VERIFY_CALLBACK"
}
```

*(Internal note: Analysis is now done in-memory within the FastAPI service, completely eliminating the need for a separate internal REST hop!)*

### Session history
`GET /api/session/{sessionId}/history`
```json
{
  "sessionId": "sess_7b21...",
  "chunks": [ { "chunkSeq": 1, "syntheticScore": 0.12, "speakerMatchScore": 0.88, "runningRisk": 0.15 } ],
  "finalRisk": 0.68,
  "alertsFired": [ { "chunkSeq": 12, "type": "VERIFY_CALLBACK" } ]
}
```

**Risk formula (starting point — tune after real testing):**
```
runningRisk = 0.5 * syntheticScore + 0.5 * (1 - speakerMatchScore)
```
Expect to weight speaker-mismatch higher once real numbers come in —
it's the more reliable of the two signals.

---

## 5. Database Schema

```sql
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY,
  person_name TEXT NOT NULL,
  role TEXT,
  org_id TEXT,
  embedding FLOAT8[] NOT NULL,   -- 192-dim ECAPA-TDNN vector, averaged
  sample_count INT,
  enrolled_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  claimed_profile_id UUID REFERENCES voice_profiles(id),
  call_type TEXT,
  amount NUMERIC,
  caller_number TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  final_risk FLOAT8
);

CREATE TABLE session_chunks (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  chunk_seq INT,
  synthetic_score FLOAT8,
  speaker_match_score FLOAT8,
  running_risk FLOAT8,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  chunk_seq INT,
  alert_type TEXT,   -- e.g. VERIFY_CALLBACK, ESCALATE
  created_at TIMESTAMPTZ DEFAULT now()
);
```
No raw audio table, by design — this directly satisfies the privacy/
compliance requirement in the problem statement. Redis holds only the
live rolling-score cache per active session (ephemeral, not persisted).

---

## 6. Team Split (4-6 people)

- **Backend & ML (2-3 people):** WavLM fine-tuning, ECAPA-TDNN integration, FastAPI WebSocket handler, risk engine, Postgres/Redis wiring, and REST endpoints.
- **Frontend (2-3 people):** `/simulator` + `/dashboard` split-screen React
  app, Web Audio API capture/chunking, live risk gauge + alert UI.

---

## 7. Build Timeline

- **Week 1:** ML models (WavLM & ECAPA-TDNN) integrated into FastAPI with basic REST endpoints.
- **Week 2:** Add WebSocket handlers, risk engine, Postgres DB schema, and Redis caching to the FastAPI backend.
- **Week 3:** React frontend, end-to-end chunk streaming, risk engine tuning.
- **Week 4:** Demo polish, generate clone samples for the live demo, deck, bug buffer

---

## 8. Demo Script

1. Enroll a "CFO" voiceprint from a real recorded sample (3-5 clips)
2. Play a genuine clip of that person → risk stays low, call proceeds
3. Play an AI-cloned clip of the same person (generated ahead of time with
   a free TTS tool) requesting a wire transfer approval → risk climbs
   **live, chunk by chunk, while the clip is still playing** → alert fires
   ("VERIFY_CALLBACK") before the clip finishes
4. Briefly show the enrollment/compliance screen (embeddings only, no raw
   audio stored) to address the privacy requirement explicitly

Input method for the demo: feed audio **directly into the capture pipeline**
(file → same Web Audio API path as a live mic) rather than relying on
phone-speaker-to-laptop-mic — cleaner audio, no live-demo failure risk.
Real live-mic input can be kept as an optional bonus moment after the
core demo.

---

## 9. Known Risks — Be Honest About These

- **Short-chunk (3s) synthetic-voice detection accuracy is not a solved
  research problem.** Even strong academic detectors struggle to generalize
  to cloning tools they weren't trained on. Don't overclaim precision;
  lean on speaker-verification as the primary signal, synthetic-detection
  as supporting.
- **Latency vs. accuracy is a real trade-off.** Two models per 3s chunk on
  CPU realistically costs hundreds of ms to ~1-2s, not "milliseconds."
  Measure and report a real number in the pitch.
- **Team skill vs. timeline is the biggest wildcard.** If nobody has done
  audio ML fine-tuning before, this is where time disappears unpredictably.
  Scope the ML claim honestly in the pitch: "continuously-updating risk
  score combining speaker verification and synthetic-artifact detection,"
  not "we detect all voice clones with high accuracy."
- **Multilingual/Indian-accent coverage** is explicitly required but most
  public deepfake datasets are English/Western-voice heavy. Use a
  multilingual backbone (WavLM/XLS-R) and be upfront that full accent
  coverage is a roadmap item, not a solved feature, if time runs short.

---

## 10. Open Decisions

- Caller-identity known in advance (check against one claimed profile) vs.
  search across all enrolled profiles — **recommended: known in advance**,
  matches the real threat model and avoids unnecessary complexity.
- Database ORM choice for FastAPI — **recommended: SQLAlchemy** or standard `asyncpg` raw queries for performance.