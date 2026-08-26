import os
import io
import json
import base64
from pathlib import Path
import numpy as np
import soundfile as sf


def generate_voice_sample(
    fundamental_freq: float = 180.0,
    duration_sec: float = 3.0,
    sr: int = 16000,
    is_synthetic: bool = False,
    jitter: float = 0.02
) -> np.ndarray:
    """
    Generates synthetic or simulated natural voice audio signals.
    - Genuine voice: rich harmonics, natural micro-jitter, formant filtering.
    - Synthetic voice: robotic/flat pitch contour, high-frequency vocoder artifacts, spectral phase anomalies.
    """
    num_samples = int(sr * duration_sec)
    t = np.linspace(0, duration_sec, num_samples, endpoint=False)

    if not is_synthetic:
        # Genuine human voice simulation
        # Add natural pitch drift / micro-jitter
        pitch_contour = fundamental_freq + 10.0 * np.sin(2 * np.pi * 1.5 * t) + np.random.normal(0, jitter, num_samples)
        phase = 2 * np.pi * np.cumsum(pitch_contour) / sr
        
        # Harmonic series with formant envelope (Formants around 500Hz, 1500Hz, 2500Hz)
        waveform = (
            1.0 * np.sin(phase) +
            0.6 * np.sin(2 * phase) +
            0.4 * np.sin(3 * phase) +
            0.2 * np.sin(4 * phase) +
            0.1 * np.sin(5 * phase)
        )
        # Add natural breathiness / room noise
        waveform += np.random.normal(0, 0.02, num_samples)
    else:
        # Synthetic / AI cloned voice simulation
        # Flat pitch contour, unnaturally sharp harmonics, high-frequency vocoder hiss
        phase = 2 * np.pi * fundamental_freq * t
        waveform = (
            1.0 * np.sin(phase) +
            0.8 * np.sin(2 * phase) +
            0.7 * np.sin(3 * phase) +
            0.6 * np.sin(4 * phase) +
            0.5 * np.sin(5 * phase) +
            0.4 * np.sin(6 * phase)
        )
        # High-frequency vocoder phase artifacts (4kHz-7kHz)
        hf_noise = np.sin(2 * np.pi * 5500 * t) * 0.15 + np.sin(2 * np.pi * 6500 * t) * 0.12
        waveform += hf_noise

    # Normalize to [-0.8, 0.8]
    waveform = waveform / (np.max(np.abs(waveform)) + 1e-6) * 0.8
    return waveform.astype(np.float32)


def main():
    output_dir = Path("./samples")
    output_dir.mkdir(parents=True, exist_ok=True)

    samples = {
        # Genuine CFO Ramesh Kumar (Enrollment clips)
        "cfo_enrollment_1.wav": generate_voice_sample(160.0, 3.0, is_synthetic=False),
        "cfo_enrollment_2.wav": generate_voice_sample(162.0, 3.0, is_synthetic=False),
        "cfo_enrollment_3.wav": generate_voice_sample(158.0, 3.0, is_synthetic=False),
        
        # Genuine CFO live chunk (low risk test)
        "cfo_genuine_live_chunk.wav": generate_voice_sample(161.0, 3.0, is_synthetic=False),

        # AI-Cloned CFO voice (high risk deepfake attack test)
        "cfo_ai_clone_attack_chunk.wav": generate_voice_sample(160.0, 3.0, is_synthetic=True),

        # Impersonator / Different person (speaker mismatch test)
        "attacker_different_voice_chunk.wav": generate_voice_sample(240.0, 3.0, is_synthetic=False)
    }

    base64_payloads = {}

    for fname, audio_np in samples.items():
        filepath = output_dir / fname
        sf.write(str(filepath), audio_np, 16000, format="WAV", subtype="PCM_16")
        
        byte_io = io.BytesIO()
        sf.write(byte_io, audio_np, 16000, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        b64_str = base64.b64encode(byte_io.read()).decode("utf-8")
        base64_payloads[fname] = b64_str
        print(f"Generated sample: {filepath}")

    payloads_path = output_dir / "sample_payloads.json"
    with open(payloads_path, "w") as f:
        json.dump(base64_payloads, f, indent=2)
    print(f"Saved base64 payloads to {payloads_path}")


if __name__ == "__main__":
    main()
