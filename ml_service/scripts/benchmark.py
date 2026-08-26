import os
import sys
import time
from pathlib import Path
import numpy as np
import torch

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from app.config import settings
from app.models.model_manager import model_manager
from app.services.analysis_service import analysis_service
from app.services.audio_processor import audio_processor


def run_benchmark(num_iterations: int = 50):
    print(f"=== VoiceShield ML Service Benchmark ===")
    print(f"Device: {settings.DEVICE}")
    print(f"Running warm-up...")
    model_manager.warmup()

    # Generate 3-second test waveform
    dummy_tensor = torch.randn((1, 48000), dtype=torch.float32) * 0.4
    b64_audio = audio_processor.encode_audio_to_base64_wav(dummy_tensor, 16000)

    # Enroll a dummy reference profile
    profile = analysis_service.enroll_voice_samples(
        person_name="Benchmark CFO",
        role="CFO",
        org_id="org_bench",
        audio_samples_b64=[b64_audio]
    )

    print(f"\nRunning {num_iterations} chunk analysis iterations (3.0s audio each)...")
    latencies = []

    for i in range(num_iterations):
        t0 = time.perf_counter()
        res = analysis_service.analyze_chunk(
            audio_b64=b64_audio,
            compare_to_profile_id=profile.profile_id
        )
        t_elapsed = (time.perf_counter() - t0) * 1000
        latencies.append(t_elapsed)
        if (i + 1) % 10 == 0:
            print(f"  Iteration {i+1}/{num_iterations} -> Latency: {t_elapsed:.2f} ms | Risk: {res['runningRisk']}")

    latencies = np.array(latencies)
    print("\n--- Latency Benchmark Results ---")
    print(f"Mean Latency:   {np.mean(latencies):.2f} ms")
    print(f"Median Latency: {np.median(latencies):.2f} ms")
    print(f"Min Latency:    {np.min(latencies):.2f} ms")
    print(f"Max Latency:    {np.max(latencies):.2f} ms")
    print(f"p95 Latency:    {np.percentile(latencies, 95):.2f} ms")
    print(f"p99 Latency:    {np.percentile(latencies, 99):.2f} ms")
    print("=========================================\n")


if __name__ == "__main__":
    run_benchmark(30)
