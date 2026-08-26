# VoiceShield Dataset & Model Requirements Specification

---

## 1. Demonstration Data (For Live Pitch / Demo Day)
To prove the system works live in real time, you need clean, verified audio files formatted as **16kHz Mono WAV (PCM 16-bit)**.

| Audio Item | Category | Specifications | Role in System Demo |
| :--- | :--- | :--- | :--- |
| **Data 1: Enrollment Audio** | Genuine | 3–5 short clips (5–10s each) of target executive (e.g. CEO/CFO) speaking naturally. | Fed to `/ml/enroll-profile` to generate a 192-dimensional ECAPA-TDNN voiceprint before demo. |
| **Data 2: Safe Test Call** | Genuine | Separate recording of the same executive saying normal business sentences. | Sent via WebSocket to show risk score stays in **GREEN (LOW RISK, < 0.35)**. |
| **Data 3: Deepfake Attack Call** | Synthetic / Cloned | AI-cloned audio of the executive (created via ElevenLabs, Coqui TTS, or PlayHT) demanding an urgent fund transfer. | Sent via WebSocket to show `syntheticScore` spikes to **RED (CRITICAL RISK, > 0.70)**. |
| **Data 4: Imposter Call** | Human (Different) | Real human voice of another speaker pretending to be the executive. | Verifies speaker matching failure: `speakerMatchScore` < 0.50, triggering **HIGH RISK**. |

---

## 2. Development & Training Datasets (For ML Model Training & Fine-Tuning)

To train, fine-tune, and evaluate the **WavLM Synthetic Voice Detector** and **ECAPA-TDNN Speaker Verifier**, the following academic datasets and pre-trained backbones are required:

### 2.1 ASVspoof 2019 (Logical Access - LA Track)
* **What it is:** The global gold-standard benchmark for speech synthesis and voice conversion spoofing countermeasures. Contains 107k+ genuine and synthetic utterances generated across 19 TTS/VC algorithms.
* **Dataset Size:** ~15 GB (Compressed) / ~25 GB (Uncompressed)
* **Official Website:** [ASVspoof 2019 Official Portal](https://www.asvspoof.org/index2019.html)
* **Direct Official Download:** [Edinburgh DataShare - ASVspoof 2019 LA](https://datashare.ed.ac.uk/handle/10283/3336)
* **Hugging Face Hub (Ready-to-Use):**
  * [`SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA`](https://huggingface.co/datasets/SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA)
  * [`Bisher/ASVspoof_2019_LA`](https://huggingface.co/datasets/Bisher/ASVspoof_2019_LA)
* **Python Quickstream:**
  ```python
  from datasets import load_dataset
  asv_dataset = load_dataset("SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA", split="train", streaming=True)
  ```

---

### 2.2 ASVspoof 2021 (Deepfake Track - DF & Logical Access - LA)
* **What it is:** Expanded benchmark introducing real-world lossy transmission conditions (VoIP codecs, m4a, opus, mp3 compression) and cross-dataset synthetic spoof attacks.
* **Dataset Size:** ~35 GB
* **Official Website:** [ASVspoof 2021 Challenge](https://www.asvspoof.org/index2021.html)
* **Official Zenodo Direct Links:**
  * **Deepfake (DF) Subset:** [Zenodo Record 4835108](https://zenodo.org/record/4835108) (DOI: 10.5281/zenodo.4835108)
  * **Logical Access (LA) Subset:** [Zenodo Record 4837263](https://zenodo.org/record/4837263) (DOI: 10.5281/zenodo.4837263)
  * **Physical Access (PA) Subset:** [Zenodo Record 4834716](https://zenodo.org/record/4834716) (DOI: 10.5281/zenodo.4834716)
* **Evaluation Keys & Metadata:** [ASVspoof 2021 Protocols](https://www.asvspoof.org/index2021.html)

---

### 2.3 WaveFake Dataset (Neural Vocoder Artifact Benchmark)
* **What it is:** Modern deepfake dataset built for analyzing neural vocoder synthesis artifacts across 6 architectures: HiFi-GAN, MelGAN, WaveGlow, Parallel WaveGAN, Multi-band MelGAN, and FullBand-MelGAN (104,885 audio files).
* **Dataset Size:** ~5.8 GB
* **Official Zenodo Direct Link:** [Zenodo Record 5642694 (v1.2.0)](https://zenodo.org/records/5642694)
* **Official GitHub:** [RUB-SysSec/WaveFake](https://github.com/RUB-SysSec/WaveFake)
* **Hugging Face Hub Repositories:**
  * [`ajaykarthick/wavefake-audio`](https://huggingface.co/datasets/ajaykarthick/wavefake-audio)
  * [`DeepFense/WaveFake`](https://huggingface.co/datasets/DeepFense/WaveFake)
* **Python Quickstream:**
  ```python
  from datasets import load_dataset
  wavefake_ds = load_dataset("ajaykarthick/wavefake-audio", split="train", streaming=True)
  ```

---

### 2.4 In-the-Wild Audio Deepfake Dataset (Interspeech 2022)
* **What it is:** Real-world in-the-wild audio deepfakes collected from public figures, politicians, and CEOs across podcasts, social media, and video platforms (20.8h real + 17.2h deepfake).
* **Dataset Size:** ~1.4 GB
* **Official Project:** [deepfake-total.com/in_the_wild](https://deepfake-total.com/in_the_wild)
* **Zenodo Direct Link:** [Zenodo Record 7594957](https://zenodo.org/records/7594957)
* **Hugging Face Hub:** [`mueller91/In-The-Wild`](https://huggingface.co/datasets/mueller91/In-The-Wild)
* **Kaggle Mirror:** [Release In The Wild (Audio Deepfake)](https://www.kaggle.com/datasets/thedevastator/release-in-the-wild-audio-deepfake)
* **Python Quickstream:**
  ```python
  from datasets import load_dataset
  wild_ds = load_dataset("mueller91/In-The-Wild", split="test", streaming=True)
  ```

---

### 2.5 Pre-trained Model Checkpoints

| Model Name | Hugging Face Repository | Primary Use Case |
| :--- | :--- | :--- |
| **Microsoft WavLM Base+** | [`microsoft/wavlm-base-plus`](https://huggingface.co/microsoft/wavlm-base-plus) | 94M-param self-supervised acoustic representation model (Base backbone). |
| **Microsoft WavLM Large** | [`microsoft/wavlm-large`](https://huggingface.co/microsoft/wavlm-large) | 316M-param high-capacity backbone for complex noisy speech feature extraction. |
| **Fine-Tuned WavLM Deepfake Detector** | [`HamidRezaAttar/wavlm-base-plus-deepfake-audio-detection`](https://huggingface.co/HamidRezaAttar/wavlm-base-plus-deepfake-audio-detection) | Ready-to-use fine-tuned binary classifier for deepfake voice detection. |
| **SpeechBrain ECAPA-TDNN** | [`speechbrain/spkrec-ecapa-voxceleb`](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb) | 192-dimensional speaker verification vector extractor trained on VoxCeleb 1 & 2. |

---

## 3. Automated Downloader Utility

You can view catalog information or download models using the included project utility script:

```powershell
# List all datasets, sizes, and direct download links
.\venv\Scripts\python.exe ml_service/scripts/download_datasets.py --list

# Download and cache pre-trained WavLM and ECAPA-TDNN weights locally
.\venv\Scripts\python.exe ml_service/scripts/download_datasets.py --download-models
```