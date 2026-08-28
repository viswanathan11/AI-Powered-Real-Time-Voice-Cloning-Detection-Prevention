# 🎤 SIH Hackathon: Judge Q&A Preparation
**Project:** VoiceShield AI - Real-Time Voice Cloning Detection & Executive Fraud Prevention

Here is a curated list of questions that judges are likely to ask during your internal Smart India Hackathon presentation, along with strong, technical, and confident answers based on your project's architecture.

## Core Technical Questions

### Q1: Why did you choose a dual-model architecture (ECAPA-TDNN + WavLM) instead of a single end-to-end model?
**Answer:** "A single model trying to solve both speaker identity and deepfake detection creates a major security vulnerability. An attacker using their natural human voice would fool a pure deepfake detector because no synthetic vocoder artifacts exist. Conversely, an attacker using an ultra-high-fidelity clone of an unenrolled person would fool a pure speaker verifier. By decoupling the biometric identity verification (SpeechBrain ECAPA-TDNN 192-d embeddings) from neural vocoder artifact detection (WavLM + spectral phase analysis), our system performs robust 3-way triage: detecting AI clones, human imposters, and authentic executives independently."

### Q2: How does the system handle real-world microphone noise and prevent false positives?
**Answer:** "Standard laptop microphones and room acoustics introduce high-frequency electrical hiss and cooling fan noise that naive spectral classifiers often mistake for vocoder artifacts. VoiceShield addresses this through a multi-stage DSP defense: we apply an 80Hz–7500Hz Butterworth bandpass filter, dynamically estimate the stationary background noise floor, and use pitch autocorrelation to restrict artifact evaluation exclusively to active voiced speech frames. This ensures that ambient room noise does not artificially drive up the synthetic risk score."

### Q3: Why stream raw PCM audio over WebSockets instead of using WebRTC or standard REST polling?
**Answer:** "Standard REST APIs introduce high HTTP handshake latency and require polling, which is unacceptable for real-time live call defense. While WebRTC is great for peer-to-peer media, browser WebRTC stacks apply dynamic gain compression and lossy Opus codecs that destroy high-frequency phase information needed to detect vocoders. By capturing uncompressed 16kHz mono PCM via the Web Audio API and streaming 3.0-second sliding windows with 4-byte sequence headers over binary WebSockets, we achieve sub-40ms end-to-end telemetry latency with zero codec distortion."

### Q4: What is the computational complexity and latency profile of the ML pipeline on CPU vs GPU?
**Answer:** "Because we optimized the inference pipeline to execute in-process within FastAPI without internal REST hops, a 3-second audio chunk takes approximately 15ms on an NVIDIA GPU (CUDA) and ~35-50ms on a modern multi-core CPU. This easily fits inside our 3000ms streaming window, ensuring the system operates with virtually zero queue backlog and true sub-second real-time responsiveness."

## Privacy, Security & Compliance

### Q5: How is the system compliant with data privacy regulations like DPDP and GDPR?
**Answer:** "VoiceShield guarantees zero raw audio retention. During enrollment and live calls, incoming audio chunks exist only in volatile RAM buffers during the 20ms neural forward pass and are immediately flushed. The database only retains non-invertible 192-dimensional numerical embedding vectors and statistical risk scores. It is mathematically impossible to reconstruct the original speech or sensitive conversational content from an ECAPA-TDNN embedding vector."

### Q6: Can a threat actor steal the voiceprints from your database to clone voices?
**Answer:** "No. Our database only stores mathematical embeddings (192-dimensional vectors), not the raw audio. These embeddings are non-invertible, meaning you cannot take the vector and reverse-engineer it to generate audio of the person speaking. Even if the database is compromised, the attacker cannot use the data for voice cloning."

## Practical Implementation & Scalability

### Q7: If a transaction is taking place over a phone call, how do you integrate this system?
**Answer:** "VoiceShield is designed to sit at the communication gateway level. For enterprise solutions, it can be integrated directly into VoIP softphones or SIP trunks used in call centers. The current web-based Threat Simulator demonstrates the frontend integration, but the FastAPI backend can process WebSocket audio streams from any carrier-grade telephony switch or collaboration tool like Zoom/Teams via their audio APIs."

### Q8: What happens if there's a momentary network lag and a chunk arrives late?
**Answer:** "Our WebSocket payloads include a 4-byte sequence number. The backend tracks these sequences and uses an Exponential Moving Average (EMA) to smooth the risk score across chunks. A dropped or delayed chunk won't crash the system; the EMA maintains the current risk context, preventing jittery alerts while the system instantly resumes processing upon receiving the next chunk."

### Q9: How does the contextual risk modifier work in the real world?
**Answer:** "Our risk engine isn't just listening to audio; it considers the intent. If a call is flagged as a routine internal chat, the threshold for triggering an alert is standard. However, if the call metadata indicates a high-risk event like a `wire_transfer` over ₹5,00,000 or a `credential_reset`, the risk engine automatically lowers the tolerance and applies a penalty. This means the system is far more sensitive to potential spoofing exactly when the financial stakes are highest."

## Future Scope & Improvements

### Q10: What are your plans for future improvements if you move forward in the hackathon?
**Answer:** "We have three main areas for expansion. First, migrating from local SQLite to PostgreSQL with `pgvector` for hyper-fast vector similarity searches at scale. Second, fine-tuning our WavLM classifier on datasets with regional Indian accents to ensure unbiased performance. Third, updating our client-side audio capture to use modern `AudioWorkletNode` for dedicated thread processing, further ensuring real-time performance even on low-end client machines."
