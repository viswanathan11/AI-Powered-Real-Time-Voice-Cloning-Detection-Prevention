# Backend Team Task List (FastAPI & Architecture)

Welcome to the Backend Team! Your primary goal is to take the ML team's models and wrap them in a robust, real-time Python API that the Frontend can talk to. 

You are working in **Python** (FastAPI, WebSockets, SQLAlchemy/asyncpg, Redis).

## 1. Core Objectives
1.  **WebSockets:** Handle continuous streams of 3-second audio chunks from the frontend.
2.  **Risk Engine:** Calculate the final risk score based on the ML models and contextual data (like caller ID).
3.  **Data Storage:** Save Voice Profiles (embeddings ONLY, no audio) and log session alerts.

## 2. Step-by-Step Tasks

### A. The Risk Engine & WebSockets
- [ ] **Create a WebSocket Endpoint:** Build a route (e.g. `/ws/session/{session_id}`) that accepts binary audio frames from the React frontend continuously.
- [ ] **Wire up the ML Models:** For every 3-second chunk you receive, pass it to the ML Team's function to get the raw `syntheticScore` and `speakerMatchScore`.
- [ ] **Implement the Risk Formula:** Calculate the `runningRisk` using this logic:
  ```python
  runningRisk = 0.5 * syntheticScore + 0.5 * (1 - speakerMatchScore)
  ```
- [ ] **Return JSON over WebSocket:** Immediately send the calculated risk score and recommendation (e.g., `VERIFY_CALLBACK`) back to the frontend so their UI can update.

### B. Database & Caching
- [ ] **Setup PostgreSQL:** Create the tables defined in `Plane.md` (voice_profiles, sessions, session_chunks, alerts). 
- [ ] **Create Enrollment REST API:** Build `POST /api/voiceprint/enroll`. This should take audio clips, extract the 192-d embedding (using the ML team's code), and save the embedding to the `voice_profiles` table. **Crucial:** Discard the actual audio file to preserve privacy!
- [ ] **Setup Redis (Optional but Recommended):** Use Redis to store the `runningRisk` cache for active, ongoing phone calls to keep latency as low as possible.

> **Note:** You are the glue! You need to make sure the ML team's functions are called efficiently and that the Frontend team gets their JSON data blazingly fast.
