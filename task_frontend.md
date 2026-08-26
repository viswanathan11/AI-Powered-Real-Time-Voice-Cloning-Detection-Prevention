# Frontend Team Task List (React & UI)

Welcome to the Frontend Team! Your primary goal is to build the visual dashboard that the employee sees, and handle the real-time audio capture from the microphone.

You are working in **JavaScript/TypeScript** (React, Vite, Web Audio API).

## 1. Core Objectives
1.  **Audio Capture:** Record audio from the microphone and stream it to the backend continuously without breaking it.
2.  **Dashboard UI:** Display a live, ticking risk gauge that changes color based on the data coming back from the backend.
3.  **Alerts:** Show clear, immediate warnings (like "ESCALATE" or "VERIFY CALLBACK") when a deepfake is detected.

## 2. Step-by-Step Tasks

### A. The Dashboard UI
- [ ] **Setup React + Vite:** Initialize a fast React project.
- [ ] **Build the Interface:** Create a split-screen view. One side can be the "Simulator" (where you pretend to be the attacker playing fake audio) and the other side is the "Employee Dashboard."
- [ ] **Create the Risk Gauge:** Build a visual gauge (0.0 to 1.0). 
  *   0.0 - 0.3: **GREEN** (Safe)
  *   0.3 - 0.7: **YELLOW** (Monitor)
  *   0.7 - 1.0: **RED** (Critical Risk - Likely a Voice Clone)

### B. Audio Capture & WebSockets
- [ ] **Use the Web Audio API:** Do NOT use `MediaRecorder` as it adds compression which messes up the ML models. You must capture raw **16kHz Mono PCM** audio using the native `AudioContext`.
- [ ] **Chunk the Audio:** Chop the live microphone feed into **3-second chunks**.
- [ ] **Stream via WebSocket:** Open a WebSocket connection to the Python Backend (`wss://localhost:8000/ws/session/...`). Send each 3-second binary audio chunk over this socket.
- [ ] **Listen for Scores:** Listen on that same WebSocket for the backend to reply with a JSON object containing the `runningRisk` and `recommendation`.
- [ ] **Update the UI Live:** Every time a JSON response arrives, instantly update the Risk Gauge and pop up an alert banner if the recommendation says `VERIFY_CALLBACK`.

> **Note:** The hardest part of your job is the raw audio capture and streaming. Once you have 16kHz audio hitting the backend smoothly, the rest is just making the UI look amazing!
