import os
import io
import json
import base64
from pathlib import Path
import numpy as np
import soundfile as sf


def generate_voice_sample(
    fundamental_freq: float = 160.0,
    duration_sec: float = 3.0,
    sr: int = 16000,
    is_synthetic: bool = False,
    jitter: float = 0.03
) -> np.ndarray:
    """
    Generates realistic synthetic or simulated natural voice audio signals.
    - Genuine voice: rich low-frequency formants (<3kHz), natural pitch drift, steep roll-off at >3.5kHz.
    - Synthetic voice: robotic/flat pitch contour, high-frequency vocoder dispersion & hiss (>4.5kHz).
    """
    num_samples = int(sr * duration_sec)
    t = np.linspace(0, duration_sec, num_samples, endpoint=False)

    if not is_synthetic:
        # Genuine human voice simulation
        pitch_contour = fundamental_freq + 8.0 * np.sin(2 * np.pi * 1.2 * t) + np.random.normal(0, jitter, num_samples)
        phase = 2 * np.pi * np.cumsum(pitch_contour) / sr
        
        # Natural vocal tract formants (steep roll-off above 3kHz)
        waveform = (
            1.00 * np.sin(phase) +
            0.65 * np.sin(2 * phase) +
            0.40 * np.sin(3 * phase) +
            0.20 * np.sin(4 * phase) +
            0.08 * np.sin(5 * phase) +
            0.02 * np.sin(6 * phase)
        )
        # Soft room ambiance (low frequency)
        waveform += np.random.normal(0, 0.005, num_samples)
    else:
        # Synthetic / AI cloned voice simulation
        # Flat pitch contour, unnaturally prominent upper harmonics, neural vocoder dispersion
        phase = 2 * np.pi * fundamental_freq * t
        waveform = (
            0.80 * np.sin(phase) +
            0.75 * np.sin(2 * phase) +
            0.70 * np.sin(3 * phase) +
            0.65 * np.sin(4 * phase) +
            0.60 * np.sin(5 * phase) +
            0.55 * np.sin(6 * phase) +
            0.50 * np.sin(7 * phase)
        )
        # Neural vocoder high-frequency checkerboard / unvoiced dispersion (4.5kHz - 7.5kHz)
        hf_vocoder = (
            0.35 * np.sin(2 * np.pi * 4800 * t) +
            0.30 * np.sin(2 * np.pi * 5600 * t) +
            0.25 * np.sin(2 * np.pi * 6800 * t) +
            0.20 * np.random.normal(0, 0.1, num_samples)
        )
        waveform += hf_vocoder

    # Normalize to [-0.8, 0.8]
    waveform = waveform / (np.max(np.abs(waveform)) + 1e-6) * 0.8
    return waveform.astype(np.float32)


def main():
    script_dir = Path(__file__).resolve().parent
    output_dir = script_dir.parent / "samples"
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
