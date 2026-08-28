# 🛡️ VoiceShield AI: Project Overview & Technical Blueprint
### AI-Powered Real-Time Voice Cloning Detection & Executive Fraud Prevention Framework
**Problem Statement ID:** SIH26104 (AICTE / Smart India Hackathon)  
**System Version:** 1.0.0 (Unified In-Process Architecture)  
**Core Domain:** Enterprise Cybersecurity, Digital Signal Processing (DSP), Deepfake Detection, Biometric Speaker Verification  

---

## 1. Project Overview

### 1.1 What the Project Does
**VoiceShield AI** is an enterprise-grade, real-time telephony security system designed to intercept, analyze, and flag AI-synthesized voices, neural voice clones, and impersonation attacks during live voice calls. Operating in continuous **3.0-second sliding windows**, the system combines deep neural speech representations with acoustic vocoder artifact analysis and biometric speaker verification to calculate an updating **Composite Impersonation Risk Score** within **sub-50 milliseconds** per chunk.

### 1.2 The Problem It Solves
Recent breakthroughs in generative neural text-to-speech (TTS) and voice conversion models (e.g., ElevenLabs, HiFi-GAN, VITS, Tortoise, XTTS) allow attackers to clone high-privilege individuals (CEOs, CFOs, government officials) using only 3 to 10 seconds of publicly harvested audio. 

Threat actors deploy these AI clones over VoIP, GSM, and enterprise collaboration channels (Zoom, Teams, Google Meet) to execute high-pressure **Social Engineering & CEO Fraud** (e.g., emergency fund transfers, credential resets, vendor account overrides).
* **Why Traditional Defenses Fail:** Conventional verification (Caller ID spoofing checks, manual callback, or human ear familiarity) is incapable of detecting neural vocoder artifacts under pressure.
* **Why Post-Call Analysis Fails:** Detecting a deepfake after a call has concluded is useless when funds have already left the account.
* **VoiceShield's Solution:** Real-time, continuous chunk-by-chunk verification with pre-transaction tactical alerts (**ALLOW**, **MONITOR**, **VERIFY_CALLBACK**, **ESCALATE**) before sensitive actions are executed.

### 1.3 Main Features
1. **Real-Time Streaming Verification:** Processes uncompressed 16kHz 16-bit mono PCM audio in continuous 3.0-second sliding windows over low-latency binary WebSockets.
2. **Dual-Layer Neural AI Inference:**
   * **Microsoft WavLM + Spectral Vocoder Head:** Inspects phase consistency, high-frequency dispersion (>3.8 kHz), and temporal velocity to detect synthetic vocoders.
   * **SpeechBrain ECAPA-TDNN:** Extracts 192-dimensional biometric speaker embeddings to verify caller identity against pre-enrolled executive voiceprints.
3. **3-Way Real-Time Triage Engine:** Mathematically differentiates between:
   * **Authentic Executive:** Matched voiceprint ($Cosine \ge 0.74$) + Organic speech $\rightarrow$ **LOW RISK / ALLOW**.
   * **Human Imposter:** Natural human speech, but divergent voiceprint ($Cosine < 0.58$) $\rightarrow$ **HIGH RISK / VERIFY_CALLBACK**.
   * **AI Voice Clone / Deepfake:** Synthesized vocoder artifacts detected ($\ge 0.60$) $\rightarrow$ **CRITICAL RISK / ESCALATE**.
4. **Context-Aware Adaptive Risk Scoring:** Evaluates financial transaction amounts (e.g., $\ge ₹5,00,000$) and high-risk intents (`wire_transfer`, `credential_reset`) to dynamically weight risk thresholds.
5. **Zero Raw Audio Storage Guarantee (DPDP & GDPR Compliant):** Raw audio chunks are processed in volatile memory and immediately wiped. Only non-invertible 192-dimensional numerical vectors are stored.
6. **Phonetically Balanced Single-Take Enrollment:** Uses *The Rainbow Passage* to capture complete phonetic coverage across vowel formants and consonant transitions.
7. **Comprehensive SOC Telephony Dashboard:** Real-time animated risk gauge, live oscilloscope/spectrum visualizer, temporal chunk progression timeline, active session manager, and historical audit logs.

### 1.4 Target Users
* **Enterprise Security Operations Centers (SOC):** Real-time monitoring of corporate communication gateways.
* **Banking & Financial Institutions:** Call-center verification for high-value fund transfers, loan authorizations, and wire approvals.
* **Telecom Operators & VoIP Providers:** Embedded carrier-grade voice integrity verification layers.
* **Government & Critical Infrastructure:** Identity verification for high-privilege executive communications.

---

## 2. Tech Stack & Engineering Rationale

| Layer | Technologies Used | Version | Why This Technology Was Chosen |
|---|---|---|---|
| **Frontend Framework** | React + TypeScript + Vite | React 19, Vite 8, TS 6 | High rendering performance, static type safety, lightning-fast HMR, and ultra-lean production bundle. |
| **Styling & UI** | Tailwind CSS + Lucide Icons | v4.0.0 | Modern dark-mode SOC aesthetics, hardware-accelerated animations, and responsive split-screen layouts. |
| **Audio Processing (Client)** | Web Audio API (`AudioContext`, `ScriptProcessorNode`, `AnalyserNode`) | Native Browser API | Direct raw PCM audio capture at 16,000 Hz with custom linear resampling; completely avoids `MediaRecorder` compression artifacts. |
| **Backend Framework** | Python + FastAPI + Uvicorn | Python 3.13, FastAPI 0.115+ | High-throughput asynchronous execution, native WebSocket support, automatic OpenAPI docs, and clean dependency injection. |
| **Deep Learning & ML** | PyTorch, Torchaudio, SpeechBrain, HuggingFace Transformers | PyTorch 2.5+, Transformers 4.49+ | State-of-the-art architectures for speech processing: ECAPA-TDNN (x-vector embeddings) and WavLM (transformer speech backbone). |
| **Digital Signal Processing** | SciPy (`scipy.signal`), NumPy, SoundFile | SciPy 1.15+, NumPy 2.2+ | Butterworth bandpass filtering, STFT extraction, adaptive noise-floor estimation, and pitch autocorrelation. |
| **Database & ORM** | SQLAlchemy (AsyncIO) + SQLite / PostgreSQL | SQLAlchemy 2.0+ | Unified async ORM supporting zero-setup local SQLite development with drop-in PostgreSQL (`asyncpg`) production scalability. |
| **Live Cache & State** | Redis / In-Memory Fallback | Redis 7+ | Ephemeral rolling-score caching and sub-millisecond session lookup. |
| **Transport Protocols** | Binary WebSockets + REST JSON | WSS / HTTPS | Binary frame streaming (`[4B sequence][PCM payload]`) eliminates base64 transmission overhead. |

---

## 3. Project Structure & Entry Points

```text
AI-Powered-Real-Time-Voice-Cloning-Detection-Prevention/
│
├── backend/                              # Unified FastAPI Backend & Gateway
│   ├── api/                              # REST & WebSocket API Route Controllers
│   │   ├── deps.py                       # Database session dependencies
│   │   ├── routes_alerts.py              # Security alerts listing & audit endpoints
│   │   ├── routes_session.py             # Session lifecycle management (start, active, history, end)
│   │   ├── routes_voiceprint.py          # Executive voiceprint enrollment & profile CRUD
│   │   └── routes_websocket.py          # Real-time WebSocket streaming audio endpoint (/ws/session/{id})
│   ├── models/
│   │   └── db_models.py                  # SQLAlchemy Database Schema (VoiceProfile, Session, Chunk, Alert)
│   ├── schemas/                          # Pydantic Request/Response validation schemas
│   │   ├── alert.py
│   │   ├── chunk.py
│   │   ├── session.py
│   │   └── voiceprint.py
│   ├── services/                         # Core Business Logic & Engine Services
│   │   ├── audio_utils.py                # Binary WebSocket frame unpacker & base64 codecs
│   │   ├── cache_service.py              # Redis / In-Memory ephemeral session state cache
│   │   ├── ml_bridge.py                  # In-process bridge to PyTorch ML inference models
│   │   ├── risk_engine.py                # 3-Way Triage, contextual modifiers & EMA risk calculation
│   │   ├── session_service.py            # Session persistence & query operations
│   │   └── voiceprint_service.py         # Voiceprint vault operations & embedding averaging
│   ├── config.py                         # Application configuration & threshold settings
│   ├── database.py                       # Async SQLAlchemy engine, session maker & EmbeddingType
│   ├── main.py                           # FastAPI application entry point, lifecycle & CORS setup
│   └── scripts/
│       ├── run_backend.py                # Standalone script to launch FastAPI via Uvicorn
│       ├── seed_data.py                  # Database seeder utility
│       └── ws_client_demo.py             # CLI simulation client
│
├── ml_service/                           # Deep Learning & Signal Processing Inference Engine
│   └── app/
│       ├── api/                          # Standalone ML REST routes (when run in microservice mode)
│       │   ├── routes.py
│       │   └── schemas.py
│       ├── models/                       # PyTorch Deep Learning Models
│       │   ├── ecapa_verifier.py         # SpeechBrain ECAPA-TDNN 192-d speaker verification model
│       │   ├── model_manager.py          # Singleton lifecycle, device manager & model warmup
│       │   └── wavlm_detector.py         # WavLM + AcousticArtifactAnalyzer vocoder detection head
│       ├── services/
│       │   ├── analysis_service.py       # ML coordination pipeline & 3-way triage logic
│       │   ├── audio_processor.py        # Base64 decoder, RMS energy & silence/VAD detector
│       │   └── profile_store.py          # In-memory profile storage (for standalone ML testing)
│       └── config.py                     # ML inference hyperparameter settings
│
├── frontend/                             # React + Vite SOC Web Application
│   ├── src/
│   │   ├── components/                   # Modular UI Components
│   │   │   ├── AlertBanner.tsx           # Dynamic contextual warning banners
│   │   │   ├── ArchitectureView.tsx      # System architecture blueprint & connectivity test
│   │   │   ├── EnrollmentView.tsx        # Voiceprint enrollment with Rainbow Passage prompt
│   │   │   ├── Navbar.tsx                # Top navigation & system health badge
│   │   │   ├── RiskGauge.tsx             # Animated SVG semi-circle risk gauge
│   │   │   ├── SecurityDashboard.tsx     # Live defense SOC panel & dual-model metrics
│   │   │   ├── SessionHistoryView.tsx    # Session audit log & chunk timeline drill-down
│   │   │   ├── ThreatSimulator.tsx       # Live call initiator (Preset, Mic, Audio File)
│   │   │   └── WaveformVisualizer.tsx    # Canvas oscilloscope & frequency spectrum analyzer
│   │   ├── data/
│   │   │   ├── demoAudio.ts              # Preset attack scenarios & base64 sample loaders
│   │   │   └── passage.ts                # The Rainbow Passage reading prompt
│   │   ├── services/
│   │   │   ├── api.ts                    # REST client for backend communication
│   │   │   ├── audioCapture.ts           # Web Audio API 16kHz PCM streamer & auto-chunker
│   │   │   └── webSocketClient.ts        # Robust WebSocket client with auto-reconnect
│   │   ├── types/
│   │   │   └── index.ts                  # Shared TypeScript interfaces & types
│   │   ├── App.tsx                       # Root layout & state coordination
│   │   └── main.tsx                      # React DOM entry point
│   ├── package.json                      # Frontend dependencies
│   └── vite.config.ts                    # Vite build configuration
│
├── samples/                              # Reference WAV Audio Samples & Payloads
│   ├── attacker_different_voice_chunk.wav
│   ├── cfo_ai_clone_attack_chunk.wav
│   ├── cfo_enrollment_1.wav
│   ├── cfo_enrollment_2.wav
│   ├── cfo_enrollment_3.wav
│   ├── cfo_genuine_live_chunk.wav
│   └── sample_payloads.json              # Pre-encoded base64 audio clips
│
├── startup_Commands.txt                  # Quickstart terminal run guide
├── requirements.txt                      # Python dependencies
└── voiceshield.db                        # SQLite local development database
```

### Entry Points & Startup Flow
1. **Backend Entry Point (`backend/scripts/run_backend.py` $ightarrow$ `backend/main.py`):**
   * Spawns Uvicorn ASGI server on `http://0.0.0.0:8000`.
   * Executes FastAPI `lifespan`: Initializes database schema, prepares cache, preloads/warms up ML models in PyTorch memory, and auto-seeds the default CFO voiceprint (*Ramesh Kumar*).
2. **Frontend Entry Point (`frontend/src/main.tsx` $ightarrow$ `frontend/src/App.tsx`):**
   * Mounts React 19 application on `http://localhost:5173`.
   * Fetches enrolled voiceprints and health check status from `GET /api/voiceprint/profiles` and `GET /health`.

---

## 4. Architecture & End-to-End Data Flow

### 4.1 Architectural Blueprint

```text
+-----------------------------------------------------------------------------------------+
|                                    CLIENT LAYER (React 19)                              |
|                                                                                         |
|  +---------------------------+                           +---------------------------+  |
|  |     ThreatSimulator       |                           |     SecurityDashboard     |  |
|  |  • Web Audio API (16kHz)  |                           |  • Live Animated Gauge    |  |
|  |  • 3s Window Slicing      |                           |  • Dual-Model Breakdown   |  |
|  |  • Binary Frame Formatter |                           |  • Tactical SOC Protocols |  |
|  +-------------+-------------+                           +-------------^-------------+  |
+----------------|-------------------------------------------------------|----------------+
                 | Binary Frame [4B Seq + 16kHz PCM]                     | JSON Risk Telemetry
                 v                                                       |
+------------------------------------------------------------------------|----------------+
|                        UNIFIED BACKEND & ML GATEWAY (FastAPI / PyTorch)                 |
|                                                                        |                |
|  +---------------------------------------------------------------------+-------------+  |
|  | WebSocket Session Handler (/ws/session/{id})                                      |  |
|  |  1. Unpacks 4-byte big-endian sequence number and audio bytes                     |  |
|  |  2. Retrieves claimed profile 192-d embedding from DB / Cache                     |  |
|  +-------------------------------------+---------------------------------------------+  |
|                                        | In-Process Direct Call (~15ms)                 |
|                                        v                                                |
|  +-----------------------------------------------------------------------------------+  |
|  | ML Inference Engine (PyTorch / SpeechBrain / Transformers)                        |  |
|  |                                                                                   |  |
|  |   [Sub-Model A: WavLM + Spectral Head]      [Sub-Model B: ECAPA-TDNN Biometrics]  |  |
|  |   • 80Hz - 7.5kHz Bandpass Filter           • Multi-scale Conv1D + Dilation       |  |
|  |   • Adaptive Noise-Floor Subtraction        • Statistical Pooling (Mean + Std)    |  |
|  |   • High-Frequency (>4kHz) Vocoder Ratio    • 192-d L2-Normalized Embedding       |  |
|  |   • Layer 3 & Layer 12 Transition Entropy   • Calibrated Cosine Similarity Score  |  |
|  |                |                                         |                        |  |
|  |                +--------------------+--------------------+                        |  |
|  |                                     v                                             |  |
|  |                          [Analysis Orchestration]                                 |  |
|  +-------------------------------------+---------------------------------------------+  |
|                                        |                                                |
|                                        v                                                |
|  +-----------------------------------------------------------------------------------+  |
|  | Risk Scoring Engine (risk_engine.py)                                              |  |
|  |  • 3-Way Triage (Clone vs Imposter vs Executive)                                  |  |
|  |  • Contextual Modifiers (Transaction Amount >= 5L, Critical Call Intent)          |  |
|  |  • Exponential Moving Average Smoothing (alpha = 0.70)                            |  |
|  |  • Tactical Action: ALLOW | MONITOR | VERIFY_CALLBACK | ESCALATE                  |  |
|  +-------------------------------------+---------------------------------------------+  |
|                                        |                                                |
|                   +--------------------+--------------------+                           |
|                   | Asynchronous Save                       | Live Score Broadcast      |
|                   v                                         v                           |
|  +--------------------------------+       +------------------------------------------+  |
|  | Storage Layer                  |       | WebSocket Push to React Client           |  |
|  | • PostgreSQL / SQLite (Chunks) |       +------------------------------------------+  |
|  | • Redis (Ephemeral Cache)      |                                                     |
|  +--------------------------------+                                                     |
+-----------------------------------------------------------------------------------------+
```

### 4.2 Step-by-Step Data Flow
1. **Audio Ingestion:** Microphone or uploaded file stream is captured by the browser. The Web Audio API resamples the audio stream to **16,000 Hz, 1 Channel (Mono), 16-bit PCM WAV**.
2. **Chunk Packaging:** Every **3.0 seconds** (48,000 samples = 96,000 raw PCM bytes + 44B WAV header), `AudioCaptureEngine` packs a 4-byte big-endian sequence integer header onto the binary buffer.
3. **WebSocket Transmission:** The binary frame is sent over `ws://localhost:8000/ws/session/{sessionId}` to the backend.
4. **Unpacking & Profile Lookup:** `routes_websocket.py` parses the sequence number, grabs the 192-dimensional reference embedding for the target executive from the database, and passes both to `MLBridge`.
5. **Dual Neural Inference (In-Process ~15-30ms):**
   * **Acoustic Vocoder Analysis:** Bandpass filters the signal, estimates the stationary noise floor, suppresses background mic hiss, and calculates active voiced high-frequency ratio ($> 4\text{ kHz}$) and WavLM layer velocity.
   * **Biometric Identity Verification:** Computes the 192-d embedding of the 3-second chunk and evaluates cosine similarity against the enrolled executive profile.
6. **Risk Computation:** `RiskEngine` applies the 3-way triage formula, adds financial/call-type weightings, and applies an Exponential Moving Average ($\alpha=0.70$) across preceding chunks.
7. **Immediate Dispatch:** Within **$< 40\text{ ms}$**, the calculated telemetry JSON is broadcast back to the frontend to update the Risk Gauge and fire security alerts if required.
8. **Asynchronous Persistence:** Concurrently, the chunk result and any fired alerts are written to the database without blocking the WebSocket stream.

---

## 5. Frontend Deep-Dive

### 5.1 Key Components

#### `ThreatSimulator.tsx`
* **Purpose:** The operator's testing and telephony simulator panel.
* **Modes:**
  1. *Preset Attacks:* One-click simulation of pre-recorded attack vectors (AI Clone Attack, Genuine Executive Call, Human Imposter Call).
  2. *Live Mic:* Captures user's physical microphone in real time with noise suppression.
  3. *Audio File:* Uploads any `.wav` or `.mp3` file, auto-slices it into 3-second chunks, and simulates the call sequentially.
* **Context Controls:** Configures Call Intent (`fund_transfer_approval`, `wire_transfer`, `credential_reset`), Transaction Amount ($	ext{INR}$), and Caller ID.

#### `SecurityDashboard.tsx`
* **Purpose:** The Security Operations Center (SOC) defense station.
* **Elements:**
  * **3-Way Classification Hero Card:** Displays dynamic verdicts: `AUTHENTIC_EXECUTIVE` (Green), `IMPOSTER_MISMATCH` (Amber), `CRITICAL_AI_CLONE` (Red).
  * **Dual AI Telemetry Cards:** Real-time progress bars showing individual WavLM Synthesis Percentage and ECAPA-TDNN Speaker Match Percentage.
  * **Temporal Progression Timeline:** Histogram of all sequential 3-second chunks analyzed during the active session.
  * **Security Alert Ticker:** Chronological list of high-risk threshold breaches.

#### `EnrollmentView.tsx`
* **Purpose:** Executive voiceprint registration interface.
* **Phonetically Balanced Prompt:** Renders *The Rainbow Passage* with both full-paragraph and sentence-by-sentence view modes.
* **Continuous Single-Take Recording:** Allows the executive to read at their natural pace; upon stopping, the engine automatically slices the recording into 3-second chunks and extracts an averaged 192-d vector.

#### `WaveformVisualizer.tsx`
* **Purpose:** High-framerate HTML5 Canvas oscilloscope and frequency spectrum visualizer linked directly to the Web Audio `AnalyserNode`.

#### `RiskGauge.tsx`
* **Purpose:** Animated SVG semi-circle gauge rendering the composite risk score with dynamic color gradients ($0\% \text{ Green} \rightarrow 50\% \text{ Amber} \rightarrow 100\% \text{ Red}$).

### 5.2 Client-Side Audio Engineering (`audioCapture.ts`)
* **Avoidance of `MediaRecorder`:** Standard browser `MediaRecorder` compresses audio into lossy Opus/WebM formats, introducing phase distortion that tricks AI detectors. `AudioCaptureEngine` uses `ScriptProcessorNode` / `AudioContext` to access raw 32-bit floating-point PCM buffers directly from the hardware.
* **Linear Interpolation Resampling:** Converts arbitrary hardware sample rates (44.1 kHz, 48 kHz) into clean 16,000 Hz audio.
* **44-Byte RIFF WAV Header Generation:** Injects standard PCM format headers dynamically in browser memory.
* **Binary Frame Packing:**
  $$\text{Payload} = [\text{4-Byte Big-Endian Sequence Number}] + [\text{44-Byte WAV Header}] + [\text{96,000 Bytes Raw PCM}]$$

---

## 6. Backend & Machine Learning Deep-Dive

### 6.1 REST & WebSocket API Specification

| Method | Endpoint | Description | Request Payload | Response Payload |
|---|---|---|---|---|
| `POST` | `/api/voiceprint/enroll` | Enrolls executive voiceprint | `personName`, `role`, `orgId`, `audioSamples[]` (base64) | `profileId`, `sampleCount`, `enrolledAt` |
| `GET` | `/api/voiceprint/profiles` | Lists all enrolled executive profiles | Query: `skip`, `limit`, `orgId` | `profiles[]`, `total` |
| `DELETE` | `/api/voiceprint/{id}` | Deletes an enrolled voice profile | URL Param: `id` | `status`, `message` |
| `POST` | `/api/session/start` | Initializes a monitoring session | `claimedIdentity`, `context: { callType, amount, callerNumber }` | `sessionId`, `websocketUrl`, `startedAt` |
| `GET` | `/api/session/active` | Lists currently active sessions | None | `sessions[]`, `total` |
| `GET` | `/api/session/{id}/history` | Retrieves full chunk timeline & alerts | URL Param: `id` | `sessionId`, `chunks[]`, `alertsFired[]`, `finalRisk` |
| `POST` | `/api/session/{id}/end` | Concludes active call session | URL Param: `id` | `sessionId`, `status`, `finalRisk` |
| `GET` | `/api/alerts` | Lists security fraud alerts | Query: `sessionId`, `limit` | `alerts[]`, `total` |
| `WS` | `/ws/session/{id}` | Real-time audio streaming gateway | Binary frame: `[4B seq][WAV bytes]` | JSON risk score telemetry |
| `GET` | `/health` | Health & subsystem readiness check | None | `status`, `database`, `cache`, `mlBridgeMode` |

### 6.2 The Dual-Model ML Inference Engine

#### Model 1: SpeechBrain ECAPA-TDNN (`ecapa_verifier.py`)
* **Role:** Biometric Speaker Verification.
* **Architecture:** 1-D Emphasized Channel Attention, Propagation, and Aggregation Time-Delay Neural Network.
* **Feature Representation:** Computes 80-dimensional log Mel-filterbank energies and compresses temporal dynamics into a unit-normalized **192-dimensional vector**.
* **Mathematical Similarity:** Cosine similarity between enrolled reference $\vec{u}$ and incoming chunk $\vec{v}$:
  $$\text{CosineSim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\|_2 \|\vec{v}\|_2}$$
* **Calibrated Match Probability:** Sigmoidal calibration based on VoxCeleb benchmark decision boundaries:
  $$P(\text{Speaker Match}) = \frac{1}{1 + e^{-14.0 \cdot (\text{CosineSim} - 0.67)}}$$

#### Model 2: WavLM + Acoustic Artifact Analyzer (`wavlm_detector.py`)
* **Role:** Synthetic Speech & Neural Vocoder Detection.
* **Acoustic Defense:** Standard laptop microphones introduce high-frequency room hiss and fan noise that can fool naive spectral classifiers. VoiceShield incorporates:
  1. **80 Hz – 7500 Hz Bandpass Filtering:** Removes DC offset rumble and out-of-band electrical hiss.
  2. **Adaptive Noise Floor Subtraction:** Identifies non-speech stationary noise frames and subtracts $1.4\times$ the noise spectrum.
  3. **Pitch Autocorrelation Periodicity:** Restricts artifact evaluation exclusively to active voiced speech formants ($200\text{ Hz} - 3400\text{ Hz}$).
  4. **Neural Vocoder Energy Ratio:** Neural vocoders (HiFi-GAN, MelGAN, BigVGAN) generate high unvoiced energy and phase dispersion in upper frequencies ($4000\text{ Hz} - 7500\text{ Hz}$). Ratio $> 0.0140$ signals synthetic synthesis.
  5. **WavLM Multi-Layer Dynamic Velocity:** Evaluates frame-to-frame feature transitions across Layer 3 (acoustic fine structure) and Layer 12 (prosodic dynamics). Overly smooth transitions indicate AI text-to-speech generation.

### 6.3 Real-Time Risk Scoring Engine (`risk_engine.py`)

#### 1. Three-Way Triage Evaluation
* **Condition 1 (AI Clone Detected):** $\text{SyntheticScore} \ge 0.60$
  $$\text{RawRisk} = \max(0.85, \text{SyntheticScore}) \quad \longrightarrow \quad \text{Verdict: } \textbf{CRITICAL\_AI\_CLONE}$$
* **Condition 2 (Human Imposter / Divergent Speaker):** $\text{SpeakerMatch} < 0.50$
  $$\text{RawRisk} = \max\left(0.70, \, 0.85 \times (1.0 - \text{SpeakerMatch})\right) \quad \longrightarrow \quad \text{Verdict: } \textbf{IMPOSTER\_MISMATCH}$$
* **Condition 3 (Authentic Executive Verified):** $\text{SpeakerMatch} \ge 0.50 \text{ and } \text{SyntheticScore} < 0.35$
  $$\text{RawRisk} = \max\left(0.05, \, 0.25 \times \text{SyntheticScore} + 0.20 \times (1.0 - \text{SpeakerMatch})\right) \quad \longrightarrow \quad \text{Verdict: } \textbf{AUTHENTIC\_EXECUTIVE}$$

#### 2. Contextual Risk Modifiers
* High-Value Transaction Penalty: If $\text{Amount} \ge ₹500,000$ and base risk $\ge 0.35$, $\text{Risk} \leftarrow \min(1.0, \text{Risk} + 0.08)$.
* High-Risk Intent Penalty: If Call Type is `wire_transfer`, `fund_transfer_approval`, or `credential_reset`, $\text{Risk} \leftarrow \min(1.0, \text{Risk} + 0.06)$.

#### 3. Temporal Exponential Moving Average (EMA) Smoothing
To prevent transient audio glitches from causing jittery alerts, risk is smoothed over consecutive chunks:
$$\text{RunningRisk}_t = \alpha \cdot \text{AdjustedRisk}_t + (1 - \alpha) \cdot \text{RunningRisk}_{t-1}$$
*(where default $\alpha = 0.70$, with dynamic boost to $\alpha = 0.85$ during critical threat spikes).*

#### 4. Operational Protocol Thresholds
* $\text{Risk} < 0.30 \implies \textbf{LOW} \quad (\text{Protocol: } \textbf{ALLOW})$
* $0.30 \le \text{Risk} < 0.60 \implies \textbf{MEDIUM} \quad (\text{Protocol: } \textbf{MONITOR})$
* $0.60 \le \text{Risk} < 0.80 \implies \textbf{HIGH} \quad (\text{Protocol: } \textbf{VERIFY\_CALLBACK})$
* $\text{Risk} \ge 0.80 \implies \textbf{CRITICAL} \quad (\text{Protocol: } \textbf{ESCALATE})$

---

## 7. Database Schema & Privacy Architecture

```sql
-- 1. Voice Vault Table (Stores 192-d vectors only; NEVER raw audio)
CREATE TABLE voice_profiles (
    id VARCHAR(64) PRIMARY KEY,           -- e.g. "vp_cfo_ramesh"
    person_name TEXT NOT NULL,            -- e.g. "Ramesh Kumar"
    role TEXT,                            -- e.g. "CFO"
    org_id TEXT,                          -- e.g. "org_hdfc_bank"
    embedding FLOAT8[] NOT NULL,          -- 192-dimensional ECAPA-TDNN vector
    sample_count INTEGER DEFAULT 1,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Call Sessions Table
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,           -- e.g. "sess_7b21e89a"
    claimed_profile_id VARCHAR(64) REFERENCES voice_profiles(id) ON DELETE SET NULL,
    call_type TEXT,                       -- e.g. "fund_transfer_approval"
    amount NUMERIC,                       -- e.g. 5000000.00
    caller_number TEXT,                   -- e.g. "+91 98765 43210"
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    final_risk FLOAT8,
    status TEXT DEFAULT 'ACTIVE'          -- "ACTIVE", "COMPLETED", "TERMINATED"
);

-- 3. Sequential 3-Second Chunks Telemetry Table
CREATE TABLE session_chunks (
    id VARCHAR(64) PRIMARY KEY,           -- e.g. "chk_9a41b2c3"
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    chunk_seq INTEGER NOT NULL,
    synthetic_score FLOAT8 NOT NULL,
    speaker_match_score FLOAT8 NOT NULL,
    running_risk FLOAT8 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_session_chunk_seq ON session_chunks(session_id, chunk_seq);

-- 4. Fraud Alerts Table
CREATE TABLE alerts (
    id VARCHAR(64) PRIMARY KEY,           -- e.g. "alt_33a1f890"
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    chunk_seq INTEGER NOT NULL,
    alert_type TEXT NOT NULL,             -- "VERIFY_CALLBACK", "ESCALATE"
    risk_score FLOAT8,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Privacy & Compliance Guarantees
1. **Mathematical Feature Vault:** Only 192 floating-point values are retained per executive profile. Reconstructing speech from an ECAPA-TDNN embedding is mathematically infeasible, preventing privacy leakage.
2. **Volatile Buffer Cleansing:** Audio buffers passed through WebSockets are held exclusively in RAM during the 20ms forward pass and immediately garbage-collected.
3. **Data Protection Regulation Alignment:** Directly satisfies the Digital Personal Data Protection (DPDP) Act and GDPR Article 9 by enforcing zero raw biometric audio storage.

---

## 8. Setup & Local Deployment Guide

### Prerequisites
* **Operating System:** Windows 10/11, macOS, or Linux
* **Python:** Python 3.10, 3.11, 3.12, or 3.13
* **Node.js:** Node 18+ and npm

---

### Step 1: Clone Repository & Set Up Virtual Environment

```bash
# Open terminal in project root
cd D:\AI-Powered-Real-Time-Voice-Cloning-Detection-Prevention

# Create and activate Python virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

---

### Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

---

### Step 3: Start the Unified FastAPI Backend

```bash
python backend/scripts/run_backend.py
```
* **Backend Running At:** `http://localhost:8000`
* **Swagger API Docs:** `http://localhost:8000/docs`
* **WebSocket Endpoint:** `ws://localhost:8000/ws/session/{sessionId}`
* *(On startup, the system will automatically initialize the database schema and auto-seed the default CFO voiceprint)*.

---

### Step 4: Start the React Frontend

Open a **second terminal window**:

```bash
cd frontend

# Install Node modules
npm install

# Start Vite development server
npm run dev
```
* **Frontend Running At:** `http://localhost:5173`

---

### Step 5: Verify via Live Demonstration
1. Navigate to `http://localhost:5173`.
2. On the **Live Defense** tab, select **Preset Attacks**.
3. Choose **1. AI Clone Attack** $\rightarrow$ Click **Start Scenario Simulation**.
4. Watch the gauge spike into **RED (CRITICAL RISK > 85%)** and fire a `VERIFY_CALLBACK` / `ESCALATE` alert.
5. Choose **2. Genuine Executive** $\rightarrow$ Click **Start Scenario Simulation**.
6. Watch the gauge remain solid **GREEN (LOW RISK < 15%)** with protocol `ALLOW`.

---

## 9. Code Audit: Current Gaps & Improvements

| Priority | Component | Issue / Risk Identified | Practical Recommended Improvement |
|---|---|---|---|
| **HIGH** | `audioCapture.ts` | Uses deprecated `ScriptProcessorNode` for microphone PCM capture. | Migrate to modern `AudioWorkletNode` for audio processing on a dedicated browser audio thread. |
| **HIGH** | `config.py` | CORS policy allows wildcard `*` by default. | Restrict `CORS_ORIGINS` strictly to explicit enterprise domain and trusted internal IP ranges in production. |
| **MEDIUM** | `routes_websocket.py` | State is managed per WebSocket connection object. | For distributed horizontal scaling across multiple backend nodes, integrate Redis Pub/Sub for cross-pod event broadcasting. |
| **MEDIUM** | `wavlm_detector.py` | Pre-trained models are predominantly trained on Western English accents. | Fine-tune the WavLM classifier on multilingual datasets (IndicTTS, Kathbath, ASVspoof5) to ensure high resilience across Indian regional accents. |
| **LOW** | `database.py` | Local development uses SQLite with JSON text serialization for vectors. | In production, deploy PostgreSQL with the native `pgvector` extension for sub-millisecond nearest-neighbor vector indexing. |

---

## 10. Real-World Attack Scenarios

### Scenario A: AI Voice Clone CEO Impersonation (Prevented)
1. **The Attack:** A threat actor generates an AI clone of the CEO using a neural vocoder (HiFi-GAN) requesting an urgent ₹50,00,000 vendor payment.
2. **Chunk 1 Stream (0.0s – 3.0s):** Attacker starts speaking over VoIP. Web Audio captures 48,000 samples.
3. **ML Verification (3.04s):**
   * High-frequency vocoder ratio exceeds threshold ($0.0194 > 0.0110$).
   * WavLM Layer 3 transition velocity reveals synthetic smoothness.
   * `WavLMDetector` returns $\text{SyntheticScore} = 0.92$.
4. **Risk Engine Execution (3.05s):** 3-Way Triage fires `CRITICAL_AI_CLONE`. High-value transaction modifier adds weight. Running risk reaches **$92.0\%$**.
5. **Dashboard Response:** Instant **RED ALERT** banner pops up on the bank operator's screen:  
   *`"CRITICAL: AI Voice Clone Attack Detected — Neural vocoder synthesis verified. PROTOCOL: ESCALATE / HALT TRANSACTION"`*.
6. **Outcome:** The fraudulent transfer is aborted before the attacker finishes speaking their second sentence.

### Scenario B: Legitimate CFO Approving Wire Transfer (Authorized)
1. **The Call:** The genuine CFO calls the finance desk to approve a quarterly tax payment.
2. **Chunk 1 Stream (0.0s – 3.0s):** Audio streamed via 16kHz PCM WebSocket.
3. **ML Verification (3.03s):**
   * Adaptive noise subtraction cancels ambient room hiss; vocoder ratio is clean ($0.0031$).
   * ECAPA-TDNN computes 192-d embedding: Cosine Similarity with Vault is $0.785$ ($	ext{Speaker Match} = 83.4\%$).
4. **Risk Engine Execution (3.04s):** 3-Way Triage categorizes as `AUTHENTIC_EXECUTIVE`. Running risk stays at **$8.2\%$ (LOW)**.
5. **Dashboard Response:** Solid **GREEN GAUGE** with protocol `ALLOW`.
6. **Outcome:** Transaction proceeds seamlessly without unnecessary friction or false alarms.

---

## 11. Interview Preparation: High-Yield Questions & Answers

### Q1: Why did you choose a dual-model architecture (ECAPA-TDNN + WavLM) instead of a single end-to-end model?
> **Answer:** *"A single model trying to solve both speaker identity and deepfake detection creates a major security vulnerability. An attacker using their natural human voice would fool a pure deepfake detector because no synthetic vocoder artifacts exist. Conversely, an attacker using an ultra-high-fidelity clone of an unenrolled person would fool a pure speaker verifier. By decoupling the biometric identity verification (SpeechBrain ECAPA-TDNN 192-d embeddings) from neural vocoder artifact detection (WavLM + spectral phase analysis), our system performs robust 3-way triage: detecting AI clones, human imposters, and authentic executives independently."*

### Q2: How does the system handle real-world microphone noise and prevent false positives?
> **Answer:** *"Standard laptop microphones and room acoustics introduce high-frequency electrical hiss and cooling fan noise that naive spectral classifiers often mistake for vocoder artifacts. VoiceShield addresses this through a multi-stage DSP defense: we apply an 80Hz–7500Hz Butterworth bandpass filter, dynamically estimate the stationary background noise floor, and use pitch autocorrelation to restrict artifact evaluation exclusively to active voiced speech frames. This ensures that ambient room noise does not artificially drive up the synthetic risk score."*

### Q3: Why stream raw PCM audio over WebSockets instead of using WebRTC or standard REST polling?
> **Answer:** *"Standard REST APIs introduce high HTTP handshake latency and require polling, which is unacceptable for real-time live call defense. While WebRTC is great for peer-to-peer media, browser WebRTC stacks apply dynamic gain compression and lossy Opus codecs that destroy high-frequency phase information needed to detect vocoders. By capturing uncompressed 16kHz mono PCM via the Web Audio API and streaming 3.0-second sliding windows with 4-byte sequence headers over binary WebSockets, we achieve sub-40ms end-to-end telemetry latency with zero codec distortion."*

### Q4: How is the system compliant with data privacy regulations like DPDP and GDPR?
> **Answer:** *"VoiceShield guarantees zero raw audio retention. During enrollment and live calls, incoming audio chunks exist only in volatile RAM buffers during the 20ms neural forward pass and are immediately flushed. The database only retains non-invertible 192-dimensional numerical embedding vectors and statistical risk scores. It is mathematically impossible to reconstruct the original speech or sensitive conversational content from an ECAPA-TDNN embedding vector."*

### Q5: What is the computational complexity and latency profile of the ML pipeline on CPU vs GPU?
> **Answer:** *"Because we optimized the inference pipeline to execute in-process within FastAPI without internal REST hops, a 3-second audio chunk takes approximately 15ms on an NVIDIA GPU (CUDA) and ~35-50ms on a modern multi-core CPU. This easily fits inside our 3000ms streaming window, ensuring the system operates with virtually zero queue backlog and true sub-second real-time responsiveness."*
