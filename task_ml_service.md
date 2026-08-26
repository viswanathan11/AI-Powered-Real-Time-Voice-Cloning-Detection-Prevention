# ML Team Task List (Core AI & Inference)

Welcome to the ML Team! Your primary goal is to ensure our system can accurately detect deepfake voices and verify genuine speakers as fast as possible. 

You are working entirely in **Python** (PyTorch, SpeechBrain, HuggingFace).

## 1. Core Objectives
You are responsible for two main AI models:
1.  **Synthetic Voice Detection (WavLM):** Catching the tiny, robotic digital artifacts left behind by AI voice generators (like ElevenLabs).
2.  **Speaker Verification (ECAPA-TDNN):** Comparing the live audio to the CEO's saved "voiceprint" to prove it's really them.

## 2. Datasets You Need
You don't need to build models from scratch, but you need data to test and fine-tune them. Search for these on **Hugging Face** or Google:
*   **ASVspoof 2019/2021:** The gold standard for deepfake audio.
*   **WaveFake:** Good for detecting high-quality neural vocoders.

## 3. Step-by-Step Tasks
- [ ] **Setup Pre-trained Models:** Download the `microsoft/wavlm-base-plus` and `speechbrain/spkrec-ecapa-voxceleb` weights. Load them into PyTorch.
- [ ] **Optimize Inference Speed:** We need this to run in real-time. A 3-second audio chunk MUST be processed in under ~500ms. Explore ONNX runtime or basic PyTorch optimization if it's too slow.
- [ ] **Define the Core Python Function:** Ensure you have a clean Python function that the Backend team can call. It should take a 3-second audio array and return a simple dictionary: 
  ```python
  { 
    "syntheticScore": 0.85, 
    "speakerMatchScore": 0.12 
  }
  ```
- [ ] **Test with Real Deepfakes:** Generate some fake audio using a free TTS tool (like ElevenLabs or Coqui) and ensure your WavLM model flags the `syntheticScore` as high.

> **Note:** Do NOT worry about WebSockets, Databases, or the composite "Risk Score." Just focus on making the AI models fast and accurate. The Backend team will handle the rest!
