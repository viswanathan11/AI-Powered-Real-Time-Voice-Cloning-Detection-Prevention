#### 1. The Demonstration Data (For Pitch Day)
To prove your system works live, you don't need massive datasets. You just need a handful of very specific, clean audio files. (Format tip: Convert all of these to 16kHz Mono WAV files for the smoothest demo).

Data 1: The Enrollment Audio (Genuine)
What it is: 3 to 5 short audio clips (about 5-10 seconds each) of a team member (let's say they are acting as the "CEO") speaking normally.
Why you need it: To feed into the /ml/enroll-profile endpoint to generate their secure "voiceprint" before the demo starts.
Data 2: The "Safe" Test Call (Genuine)
What it is: A completely separate audio recording of that same team member saying something else (e.g., "Hi Priya, just checking on the quarterly reports.").
Why you need it: To play through your system during the demo to prove that genuine calls stay in the GREEN (LOW RISK) zone.
Data 3: The "Deepfake" Attack Call (Synthetic)
What it is: An AI-generated audio clip of that team member's voice saying something suspicious (e.g., "Hi, I need you to wire ₹50 Lakhs right now."). You can generate this using free trials of tools like ElevenLabs, Coqui TTS, or PlayHT by uploading some of their genuine voice.
Why you need it: This is the climax of your demo. You play this, and the judges will watch your dashboard instantly spike to RED (CRITICAL RISK) because the WavLM model catches the AI artifacts.
Data 4: The "Imposter" Call (Optional but good)
What it is: A real human voice, but from a completely different person pretending to be the CEO.
Why you need it: Proves your speaker verification (ECAPA-TDNN) works. The AI score might be low, but the speaker match score will fail, raising the risk.

### 2. Development & Training Data (For the ML Team)
To train or fine-tune your ML models (especially the WavLM deepfake detector) to catch the latest synthetic voices, your ML team will need these academic datasets. They are large, so make sure you have enough storage!

#### 2.1 ASVspoof 2019 or 2021 (Automatic Speaker Verification Spoofing and Countermeasures Challenge)
*   **What it is:** The absolute gold standard dataset for deepfake audio detection. It contains tens of thousands of human voices mixed with AI-generated, cloned, and replayed voices.
*   **Where to find it (Hugging Face):** Tell your friends to search for `ASVSpoof 2019` or `ASVSpoof 2021` on Hugging Face (huggingface.co/datasets). 
*   **Direct Link Search:** Many community members host it on Hugging Face. Just search the datasets tab for the most downloaded version. The official raw files can also be found at the official ASVspoof challenge website (`asvspoof.org`).

#### 2.2 WaveFake Dataset
*   **What it is:** A newer dataset focused heavily on detecting modern, high-quality neural vocoders (the tech that makes AI voices sound incredibly realistic, like MelGAN or HiFi-GAN). 
*   **Where to find it:** This is often found on GitHub or academic sites, but researchers frequently upload versions to Hugging Face. Tell them to search `WaveFake` on `huggingface.co/datasets`. 
*   **Alternative Source:** The original paper and dataset links are typically hosted by the authors (search "WaveFake dataset GitHub" on Google).

#### 2.3 WavLM & ECAPA-TDNN (The Pre-trained Models themselves)
*   **What it is:** You don't just need the raw audio data; you need the actual ML models to start with!
*   **Where to find them (Hugging Face):**
    *   **WavLM:** Tell them to search `microsoft/wavlm-base-plus` or `microsoft/wavlm-large` on Hugging Face. This is the model you will fine-tune.
    *   **ECAPA-TDNN (Speaker Verification):** Tell them to search `speechbrain/spkrec-ecapa-voxceleb` on Hugging Face. This is already fully trained on thousands of celebrities (VoxCeleb dataset) and is ready to use right out of the box for speaker matching!