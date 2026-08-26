# VoiceShield Python ML Service

**AI-Powered Real-Time Voice Cloning Detection & Speaker Verification Engine**  
*Part of SIH26104 — Enterprise Voice Impersonation Fraud Prevention*

---

## 1. Overview

The Python ML Service provides high-performance, real-time audio inference to detect AI-generated/cloned voices and verify speaker identity against enrolled genuine executive voiceprints.

It exposes low-latency REST endpoints for the Spring Boot backend to query during live call streams.

### Core Capabilities
- **Speaker Verification (ECAPA-TDNN):** Extracts 192-dimensional speaker embeddings (SpeechBrain VoxCeleb), computing cosine similarity against enrolled voiceprints.
- **Synthetic Voice Detection (WavLM & Vocoder Artifacts):** Detects neural vocoder phase artifacts (HiFi-GAN, MelGAN, BigVGAN), high-frequency spectral flatness anomalies, and transformer acoustic representations.
- **Composite Risk Scoring Engine:** Calculates running risk scores according to the formula:
  $$\text{runningRisk} = 0.5 \times \text{syntheticScore} + 0.5 \times (1.0 - \text{speakerMatchScore})$$
- **Privacy-Preserving Enrollment:** Extracts and averages 192-d embeddings across 3-5 clips, instantly discarding raw audio.
- **VAD & Silence Suppression:** Detects silent and low-energy audio chunks to avoid false alarms during call pauses.

---

## 2. API Endpoints

### 1. `POST /ml/analyze-chunk`
Analyzes a live 3-second 16kHz mono audio chunk.

**Request:**
```json
{
  "audio": "<base64 wav or pcm>",
  "compareToProfileId": "vp_9a3f12bc45de",
  "sessionId": "sess_7b21",
  "chunkSeq": 12
}
```

**Response:**
```json
{
  "syntheticScore": 0.73,
  "speakerMatchScore": 0.41,
  "runningRisk": 0.68,
  "riskLevel": "HIGH",
  "recommendation": "VERIFY_CALLBACK",
  "latencyMs": 42.15,
  "audioDurationSec": 3.0,
  "isSilent": false,
  "details": {
    "synthetic": {
      "is_synthetic": true,
      "vocoder_artifact_score": 0.71,
      "acoustic_artifacts": {
        "spectral_flux": 0.42,
        "high_freq_irregularity": 0.68,
        "spectral_flatness_hf": 0.55
      }
    }
  }
}
```

---

### 2. `POST /ml/enroll-profile`
Enrolls an executive voiceprint from 3-5 genuine audio clips.

**Request:**
```json
{
  "personName": "Ramesh Kumar",
  "role": "CFO",
  "orgId": "org_123",
  "audioSamples": [
    "<base64 wav clip 1>",
    "<base64 wav clip 2>",
    "<base64 wav clip 3>"
  ]
}
```

**Response:**
```json
{
  "profileId": "vp_9a3f12bc45de",
  "personName": "Ramesh Kumar",
  "role": "CFO",
  "orgId": "org_123",
  "sampleCount": 3,
  "embedding": [0.034, -0.125, ...],
  "enrolledAt": "2026-08-26T10:15:00Z"
}
```

---

### 3. `POST /ml/extract-embedding`
Extracts 192-dim ECAPA-TDNN vector from one or multiple audio samples.

### 4. `POST /ml/verify-speaker`
Directly compares two audio samples or an audio sample against a reference embedding.

### 5. `POST /ml/detect-synthetic`
Standalone deepfake / synthetic artifact classification on a single audio chunk.

### 6. `GET /health` / `GET /ml/health`
System health, active inference device (CPU/CUDA), and loaded model statuses.

---

## 3. Quickstart & Execution

### Run tests:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s ml_service/tests -p "test_*.py"
```

### Start Server:
```powershell
.\venv\Scripts\python.exe ml_service/scripts/run_server.py
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### Run Benchmark:
```powershell
.\venv\Scripts\python.exe ml_service/scripts/benchmark.py
```

### Generate Demo Audio Samples:
```powershell
.\venv\Scripts\python.exe ml_service/scripts/generate_sample_audio.py
```
