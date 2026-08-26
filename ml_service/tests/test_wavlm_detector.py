import unittest
import torch
import numpy as np
import sys
from pathlib import Path

ml_service_dir = Path(__file__).resolve().parent.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))

from app.models.wavlm_detector import WavLMDetector, AcousticArtifactAnalyzer


class TestWavLMDetector(unittest.TestCase):
    def setUp(self):
        self.detector = WavLMDetector(device="cpu")

    def test_silence_returns_zero_score(self):
        silent_waveform = torch.zeros((1, 48000), dtype=torch.float32)
        score, details = self.detector.detect_synthetic(silent_waveform, sample_rate=16000, is_silent=True)
        self.assertEqual(score, 0.0)
        self.assertFalse(details["is_synthetic"])

    def test_acoustic_artifact_analyzer_normal_audio(self):
        t = np.linspace(0, 3.0, 48000, endpoint=False)
        # Multi-tone natural-like harmonic signal
        audio = (0.5 * np.sin(2 * np.pi * 220 * t) + 0.25 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        tensor = torch.from_numpy(audio).unsqueeze(0)
        
        metrics = AcousticArtifactAnalyzer.extract_acoustic_artifact_scores(tensor, 16000)
        self.assertIn("spectral_flux", metrics)
        self.assertIn("vocoder_artifact_score", metrics)
        self.assertIn("high_freq_ratio", metrics)
        self.assertTrue(0.0 <= metrics["vocoder_artifact_score"] <= 1.0)

    def test_detector_output_range(self):
        waveform = torch.randn((1, 48000), dtype=torch.float32) * 0.3
        score, details = self.detector.detect_synthetic(waveform, sample_rate=16000, is_silent=False)
        self.assertTrue(0.0 <= score <= 1.0)
        self.assertIn("is_synthetic", details)
        self.assertIn("acoustic_artifacts", details)


if __name__ == "__main__":
    unittest.main()
