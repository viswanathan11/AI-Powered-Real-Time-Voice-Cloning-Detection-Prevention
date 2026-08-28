import unittest
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import torch
import sys
from pathlib import Path

ml_service_dir = Path(__file__).resolve().parent.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))

from app.models.ecapa_verifier import ECAPAVerifier


class TestECAPAVerifier(unittest.TestCase):
    def setUp(self):
        self.verifier = ECAPAVerifier(device="cpu")

    def test_extract_embedding_shape_and_norm(self):
        # 3 seconds of dummy audio
        waveform = torch.randn((1, 48000), dtype=torch.float32)
        emb = self.verifier.extract_embedding(waveform, sample_rate=16000)
        self.assertIsInstance(emb, np.ndarray)
        self.assertEqual(len(emb), 192)
        norm = np.linalg.norm(emb)
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_compute_similarity_identical(self):
        emb = np.random.randn(192).astype(np.float32)
        emb = emb / np.linalg.norm(emb)
        sim = self.verifier.compute_similarity(emb, emb)
        self.assertAlmostEqual(sim, 1.0, places=4)

    def test_compute_similarity_orthogonal(self):
        emb1 = np.zeros(192, dtype=np.float32)
        emb1[0] = 1.0
        emb2 = np.zeros(192, dtype=np.float32)
        emb2[1] = 1.0
        sim = self.verifier.compute_similarity(emb1, emb2)
        self.assertAlmostEqual(sim, 0.0, places=4)

    def test_calibrate_match_score(self):
        # Cosine sim 0.95 should have high match score
        score_high = self.verifier.calibrate_match_score(0.95)
        self.assertGreater(score_high, 0.90)

        # Cosine sim -0.5 should have low match score
        score_low = self.verifier.calibrate_match_score(-0.5)
        self.assertLess(score_low, 0.10)

    def test_average_embeddings(self):
        emb1 = np.ones(192, dtype=np.float32)
        emb2 = np.ones(192, dtype=np.float32)
        avg = self.verifier.average_embeddings([emb1, emb2])
        self.assertEqual(len(avg), 192)
        self.assertAlmostEqual(np.linalg.norm(avg), 1.0, places=4)

    def test_classify_speaker_decision(self):
        # Match (cosine >= 0.65)
        self.assertEqual(self.verifier.classify_speaker_decision(0.85, "GOOD"), "MATCH")
        # Mismatch (cosine < 0.58)
        self.assertEqual(self.verifier.classify_speaker_decision(0.55, "GOOD"), "MISMATCH")
        # Uncertain (borderline 0.58 - 0.65)
        self.assertEqual(self.verifier.classify_speaker_decision(0.60, "GOOD"), "UNCERTAIN")
        # Uncertain (poor audio quality)
        self.assertEqual(self.verifier.classify_speaker_decision(0.85, "INSUFFICIENT_SPEECH"), "UNCERTAIN")


if __name__ == "__main__":
    unittest.main()
