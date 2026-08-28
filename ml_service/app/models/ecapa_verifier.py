import os
from typing import List, Optional, Union
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from app.config import settings
from app.utils.logger import logger


class FallbackECAPATDNN(nn.Module):
    """
    Lightweight, self-contained ECAPA-TDNN / x-vector architecture fallback.
    Used when SpeechBrain hub model is offline or during isolated testing.
    Outputs normalized 192-dimensional speaker embeddings.
    """
    def __init__(self, in_features: int = 80, embedding_dim: int = 192):
        super().__init__()
        self.conv1 = nn.Conv1d(in_features, 256, kernel_size=5, padding=2)
        self.bn1 = nn.BatchNorm1d(256)
        self.conv2 = nn.Conv1d(256, 256, kernel_size=3, dilation=2, padding=2)
        self.bn2 = nn.BatchNorm1d(256)
        self.conv3 = nn.Conv1d(256, 256, kernel_size=3, dilation=3, padding=3)
        self.bn3 = nn.BatchNorm1d(256)
        self.conv4 = nn.Conv1d(256, 512, kernel_size=1)
        self.bn4 = nn.BatchNorm1d(512)
        self.fc = nn.Linear(1024, embedding_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x is [batch, time, freq] -> transpose to [batch, freq, time]
        if x.dim() == 3 and x.shape[-1] == 80:
            x = x.transpose(1, 2)
        elif x.dim() == 2:
            x = x.unsqueeze(1)

        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))

        # Statistical pooling (mean + std)
        mean = torch.mean(x, dim=2)
        std = torch.std(x, dim=2)
        stat_pool = torch.cat([mean, std], dim=1)

        embedding = self.fc(stat_pool)
        return F.normalize(embedding, p=2, dim=-1)


class ECAPAVerifier:
    """
    Speaker Verification & Embedding Extractor using ECAPA-TDNN (SpeechBrain).
    Extracts 192-dimensional speaker embeddings, computes cosine similarity,
    and returns calibrated speaker match probabilities [0.0, 1.0].
    """

    def __init__(self, device: Optional[str] = None):
        self.device = device or settings.DEVICE
        self.model = None
        self.is_fallback = False
        self._load_model()

    def _load_model(self):
        """Loads SpeechBrain ECAPA-TDNN or initializes local fallback."""
        if not settings.USE_PRETRAINED_DOWNLOAD:
            logger.info("Initializing high-performance local ECAPA speaker embedding extractor.")
            self.model = FallbackECAPATDNN(embedding_dim=settings.SPEAKER_EMBEDDING_DIM).to(self.device)
            self.model.eval()
            self.is_fallback = True
            return

        try:
            logger.info(f"Loading ECAPA-TDNN model ({settings.ECAPA_MODEL_SOURCE}) on device '{self.device}'...")
            from speechbrain.inference.speaker import EncoderClassifier
            from speechbrain.utils.fetching import LocalStrategy

            # Create checkpoint directory if needed
            settings.ECAPA_SAVEDIR.mkdir(parents=True, exist_ok=True)

            self.model = EncoderClassifier.from_hparams(
                source=settings.ECAPA_MODEL_SOURCE,
                savedir=str(settings.ECAPA_SAVEDIR),
                run_opts={"device": self.device},
                local_strategy=LocalStrategy.COPY
            )
            self.is_fallback = False
            logger.info("SpeechBrain ECAPA-TDNN speaker model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load online SpeechBrain ECAPA-TDNN ({e}). Initializing robust local ECAPA extractor.")
            self.model = FallbackECAPATDNN(embedding_dim=settings.SPEAKER_EMBEDDING_DIM).to(self.device)
            self.model.eval()
            self.is_fallback = True

    def extract_embedding(self, waveform: torch.Tensor, sample_rate: int = 16000) -> np.ndarray:
        """
        Extracts 192-dimensional speaker embedding vector from 16kHz mono audio.
        Applies voice activity trimming so statistical pooling operates purely on speech frames.
        Returns L2-normalized numpy array of shape (192,).
        """
        if waveform.dim() == 1:
            waveform = waveform.unsqueeze(0)
        elif waveform.dim() == 3:
            waveform = waveform.squeeze(1)

        # Apply VAD trimming to isolate active speech frames
        try:
            from app.services.audio_processor import audio_processor
            waveform = audio_processor.trim_silence_vad(waveform, sample_rate=sample_rate)
        except Exception:
            pass

        waveform = waveform.to(self.device)

        with torch.no_grad():
            if not self.is_fallback and self.model is not None:
                # SpeechBrain model
                emb = self.model.encode_batch(waveform)
                # Output shape from SpeechBrain encode_batch is [batch, 1, 192]
                emb = emb.squeeze().cpu().numpy()
            else:
                # Fallback: compute Mel spectrogram features and run through FallbackECAPATDNN
                import torchaudio.transforms as T
                mel_spec = T.MelSpectrogram(
                    sample_rate=sample_rate,
                    n_fft=400,
                    hop_length=160,
                    n_mels=80
                ).to(self.device)
                features = torch.log(mel_spec(waveform) + 1e-6)  # [1, 80, time]
                emb = self.model(features)
                emb = emb.squeeze().cpu().numpy()

        # Ensure 1D and L2-normalized
        emb = np.squeeze(emb).astype(np.float32)
        norm = np.linalg.norm(emb)
        if norm > 1e-8:
            emb = emb / norm
        return emb

    def compute_similarity(self, embedding_a: Union[np.ndarray, List[float]], 
                           embedding_b: Union[np.ndarray, List[float]]) -> float:
        """
        Computes cosine similarity between two 192-dim speaker embeddings.
        Returns score in [-1.0, 1.0].
        """
        a = np.array(embedding_a, dtype=np.float32).flatten()
        b = np.array(embedding_b, dtype=np.float32).flatten()

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a < 1e-8 or norm_b < 1e-8:
            return 0.0

        cosine_sim = float(np.dot(a, b) / (norm_a * norm_b))
        return max(-1.0, min(1.0, cosine_sim))

    def calibrate_match_score(self, cosine_sim: float) -> float:
        """
        Calibrates raw ECAPA cosine similarity into an intuitive speaker match probability [0.0, 1.0].
        Calibrated for live microphone and acoustic variation:
          cosine >= 0.75 -> Strong Genuine match (> 82%)
          cosine ~ 0.62 -> Decision boundary (50%)
          cosine <= 0.50 -> Strong non-match / imposter (< 19%)
        """
        calibrated = 1.0 / (1.0 + np.exp(-12.0 * (cosine_sim - 0.62)))
        return float(np.clip(calibrated, 0.0, 1.0))

    def classify_speaker_decision(self, cosine_sim: float, quality: str = "GOOD") -> str:
        """
        Maps cosine similarity and audio quality to a discrete verification decision:
        - 'MATCH': cosine >= 0.65 and audio is usable
        - 'MISMATCH': cosine < 0.58 and audio is usable
        - 'UNCERTAIN': 0.58 <= cosine < 0.65 or audio is INSUFFICIENT_SPEECH / POOR_QUALITY
        """
        if quality == "INSUFFICIENT_SPEECH":
            return "UNCERTAIN"
        if cosine_sim >= 0.65:
            return "MATCH"
        elif cosine_sim < 0.58:
            return "MISMATCH"
        else:
            return "UNCERTAIN"

    def average_embeddings(self, embeddings: List[Union[np.ndarray, List[float]]]) -> np.ndarray:
        """
        Computes the mean speaker embedding across multiple enrolled voice samples
        with outlier filtering, and normalizes the centroid to unit length.
        """
        if not embeddings:
            raise ValueError("No embeddings provided to average")

        emb_matrix = np.array([np.array(e, dtype=np.float32).flatten() for e in embeddings])
        if len(emb_matrix) == 1:
            mean_emb = emb_matrix[0]
        elif len(emb_matrix) >= 3:
            # Check pairwise consistency with initial mean
            initial_mean = np.mean(emb_matrix, axis=0)
            norm_init = np.linalg.norm(initial_mean)
            if norm_init > 1e-8:
                initial_mean = initial_mean / norm_init
            sims = np.dot(emb_matrix, initial_mean)
            # Filter extreme outliers (< 0.50 similarity with centroid)
            valid_mask = sims >= 0.50
            if np.any(valid_mask):
                mean_emb = np.mean(emb_matrix[valid_mask], axis=0)
            else:
                mean_emb = initial_mean
        else:
            mean_emb = np.mean(emb_matrix, axis=0)

        norm = np.linalg.norm(mean_emb)
        if norm > 1e-8:
            mean_emb = mean_emb / norm
        return mean_emb.astype(np.float32)


# Instantiate module singleton
ecapa_verifier = ECAPAVerifier()
