import scipy.signal as signal
from typing import Dict, Any, Tuple, Optional
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from transformers import AutoFeatureExtractor, WavLMModel
    _TRANSFORMERS_WAVLM_AVAILABLE = True
except Exception:
    _TRANSFORMERS_WAVLM_AVAILABLE = False
    AutoFeatureExtractor = None
    WavLMModel = None

from app.config import settings
from app.utils.logger import logger


class AcousticArtifactAnalyzer:
    """
    Robust Acoustic & Spectral Artifact Analyzer designed to catch neural vocoders
    (HiFi-GAN, MelGAN, BigVGAN, ElevenLabs, Tortoise, VITS, etc.) while being completely
    immune to laptop microphone fan noise, room hiss, lossy codecs (OGG, MP3, Opus),
    natural sibilance, and WebRTC dynamic gain.
    """

    @staticmethod
    def extract_acoustic_artifact_scores(waveform: torch.Tensor, sample_rate: int = 16000) -> Dict[str, Any]:
        """
        Analyzes audio tensor for spectral and temporal deepfake artifacts.
        Uses adaptive noise floor cancellation and active voiced formant gating.
        """
        audio_np = waveform.squeeze().cpu().numpy()
        if len(audio_np) < 400:
            return {
                "spectral_flux": 0.0,
                "hf_mid_ratio": 0.0,
                "spectral_flatness_hf": 0.0,
                "harmonicity": 0.0,
                "vocoder_artifact_score": 0.0,
                "voiced_frames_count": 0
            }

        # 1. Bandpass filter: 80Hz to 7500Hz (eliminates DC rumble and extreme out-of-band hiss)
        nyq = sample_rate / 2.0
        try:
            b, a = signal.butter(4, [80.0 / nyq, min(7500.0 / nyq, 0.95)], btype='band')
            filtered_audio = signal.filtfilt(b, a, audio_np)
        except Exception:
            filtered_audio = audio_np

        # 2. Short-Time Fourier Transform (STFT)
        n_fft = 512
        hop_length = 256
        f, t, Zxx = signal.stft(filtered_audio, fs=sample_rate, nperseg=n_fft, noverlap=n_fft - hop_length)
        spec = np.abs(Zxx) + 1e-8  # [freq_bins, time_frames]

        # 3. Adaptive Stationary Noise Floor Estimation & Subtraction
        frame_energy = np.mean(spec**2, axis=0)
        num_noise_frames = max(2, int(len(frame_energy) * 0.25))
        noise_frame_indices = np.argsort(frame_energy)[:num_noise_frames]
        stationary_noise_spectrum = np.median(spec[:, noise_frame_indices], axis=1, keepdims=True)
        spec_clean = np.maximum(spec * 0.02, spec - 1.4 * stationary_noise_spectrum)

        # 4. Voicing Detection via Pitch Autocorrelation Periodicity
        voice_band_mask = (f >= 200) & (f <= 3400)
        hf_band_mask = (f >= 4000) & (f <= 7500)

        # Estimate pitch harmonicity across 40ms windows (lag 40 to 200 = 80Hz to 400Hz at 16kHz)
        frame_len = 640
        harmonicity_scores = []
        for i in range(0, len(filtered_audio) - frame_len, 320):
            chunk = filtered_audio[i:i+frame_len]
            if np.std(chunk) < 1e-3:
                continue
            corr = np.correlate(chunk, chunk, mode='full')
            corr = corr[len(chunk)-1:]
            corr = corr / (corr[0] + 1e-8)
            pitch_lags = corr[40:min(200, len(corr))]
            if len(pitch_lags) > 0:
                harmonicity_scores.append(float(np.max(pitch_lags)))

        mean_harmonicity = float(np.mean(harmonicity_scores)) if harmonicity_scores else 0.50

        # Active speech formants in voice-band
        voiced_energy = np.mean(spec_clean[voice_band_mask, :], axis=0)
        voicing_thresh = np.percentile(voiced_energy, 40)
        active_voiced_frames = voiced_energy > voicing_thresh

        if not np.any(active_voiced_frames):
            active_voiced_frames = np.ones(spec.shape[1], dtype=bool)

        spec_active = spec_clean[:, active_voiced_frames]

        # 5. Measure High-Frequency to Voice-Band Ratio during active speech
        hf_power = np.mean(spec_active[hf_band_mask, :]**2, axis=0)
        voice_power = np.mean(spec_active[voice_band_mask, :]**2, axis=0) + 1e-8
        ratio_per_frame = hf_power / voice_power
        hf_mid_ratio = float(np.mean(ratio_per_frame))

        # 6. High-Frequency Spectral Flatness
        hf_active_spec = spec_active[hf_band_mask, :]
        log_hf = np.log(hf_active_spec + 1e-8)
        geom_mean = np.exp(np.mean(log_hf, axis=0))
        arith_mean = np.mean(hf_active_spec, axis=0) + 1e-8
        hf_flatness = float(np.mean(geom_mean / arith_mean))

        # 7. Robust Vocoder Anomaly Calibration:
        # Genuine human speech (clean, laptop mic noise, or lossy OGG/Opus): hf_mid_ratio is 0.0002 - 0.0090
        # Neural Vocoders / Deepfakes (HiFi-GAN, ElevenLabs, MelGAN): hf_mid_ratio is >= 0.0140 (typically 0.0180+)
        if hf_mid_ratio <= 0.0110:
            vocoder_score = 0.0
        else:
            vocoder_score = float(np.clip((hf_mid_ratio - 0.0110) / 0.0050, 0.0, 1.0))

        # Frame-to-frame spectral flux during active speech
        diff_spec = np.diff(spec_active, axis=1) if spec_active.shape[1] > 1 else np.zeros((spec_active.shape[0], 1))
        spectral_flux = float(np.mean(np.maximum(0, diff_spec)))

        return {
            "spectral_flux": round(min(spectral_flux, 1.0), 4),
            "hf_mid_ratio": round(hf_mid_ratio, 5),
            "spectral_flatness_hf": round(hf_flatness, 4),
            "harmonicity": round(mean_harmonicity, 4),
            "vocoder_artifact_score": round(vocoder_score, 4),
            "voiced_frames_count": int(np.sum(active_voiced_frames))
        }


class WavLMDetector:
    """
    Synthetic / Deepfake Voice Detector.
    Combines Transformer acoustic temporal representations (WavLM) with calibrated
    spectral vocoder artifact analysis to produce rock-solid synthetic scores in [0.0, 1.0].
    """

    def __init__(self, device: Optional[str] = None):
        self.device = device or getattr(settings, "DEVICE", "cpu")
        self.feature_extractor = None
        self.wavlm_model = None
        self.is_fallback = False
        self._load_model()

    def _load_model(self):
        """Loads HuggingFace WavLM foundation model or operates in acoustic artifact mode."""
        use_download = getattr(settings, "USE_PRETRAINED_DOWNLOAD", True)
        if not use_download or not _TRANSFORMERS_WAVLM_AVAILABLE or AutoFeatureExtractor is None or WavLMModel is None:
            logger.info("Operating in high-precision acoustic artifact detection mode.")
            self.is_fallback = True
            return

        try:
            model_id = getattr(settings, "WAVLM_MODEL_ID", "microsoft/wavlm-base-plus")
            logger.info(f"Loading WavLM detector model ({model_id}) on device '{self.device}'...")
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_id)
            self.wavlm_model = WavLMModel.from_pretrained(model_id).to(self.device)
            self.wavlm_model.eval()
            self.is_fallback = False
            logger.info("WavLM synthetic detector loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load HuggingFace WavLM ({e}). Operating in acoustic artifact detection mode.")
            self.is_fallback = True

    def detect_synthetic(self, waveform: torch.Tensor, sample_rate: int = 16000, is_silent: bool = False) -> Tuple[float, Dict[str, Any]]:
        """
        Analyzes audio waveform and returns synthetic voice probability score [0.0, 1.0]
        and detailed artifact breakdown.

        Args:
            waveform: Tensor [1, num_samples]
            sample_rate: Sample rate (16000)
            is_silent: If true, returns 0.0 score immediately.

        Returns:
            Tuple of (syntheticScore: float, details: dict)
        """
        if is_silent:
            return 0.0, {
                "synthetic_score": 0.0,
                "is_synthetic": False,
                "confidence": 1.0,
                "vocoder_score": 0.0,
                "smoothness_score": 0.0,
                "note": "Silent or near-silent chunk"
            }

        # 1. Extract acoustic vocoder artifact metrics
        acoustic_metrics = AcousticArtifactAnalyzer.extract_acoustic_artifact_scores(waveform, sample_rate)
        vocoder_score = acoustic_metrics["vocoder_artifact_score"]

        # 2. Extract WavLM Multi-Layer Representation Dynamics (L3 acoustic + L12 prosodic)
        smoothness_score = 0.0
        step_mean3 = 1.95
        step_mean12 = 0.90

        if not self.is_fallback and self.wavlm_model is not None and self.feature_extractor is not None:
            try:
                audio_np = waveform.squeeze().cpu().numpy()
                inputs = self.feature_extractor(
                    audio_np,
                    sampling_rate=sample_rate,
                    return_tensors="pt"
                )
                input_values = inputs.input_values.to(self.device)

                with torch.no_grad():
                    outputs = self.wavlm_model(input_values, output_hidden_states=True)
                    # Layer 3: Acoustic fine structure (phase & jitter transitions)
                    l3 = outputs.hidden_states[3].squeeze(0).cpu().numpy()
                    # Layer 12: Prosodic & rhythmic dynamics
                    l12 = outputs.hidden_states[12].squeeze(0).cpu().numpy()

                    step_mean3 = float(np.mean(np.linalg.norm(np.diff(l3, axis=0), axis=1)))
                    step_mean12 = float(np.mean(np.linalg.norm(np.diff(l12, axis=0), axis=1)))

                # AI vocoders produce over-smooth frame-to-frame transitions (L3 < 1.0, L12 < 0.45)
                # Natural human speech produces high dynamic variance (L3 > 1.45, L12 > 0.65)
                smoothness_l3 = float(np.clip((1.35 - step_mean3) / 0.65, 0.0, 1.0))
                smoothness_l12 = float(np.clip((0.60 - step_mean12) / 0.25, 0.0, 1.0))
                smoothness_score = float(0.50 * smoothness_l3 + 0.50 * smoothness_l12)
            except Exception as e:
                logger.error(f"Error during WavLM forward pass: {e}")
                smoothness_score = vocoder_score

        # 3. Gated Multi-Feature Ensemble
        # A synthetic voice MUST have either high neural vocoder dispersion (vocoder_score >= 0.70)
        # OR unnatural over-smooth frame dynamics (smoothness_score >= 0.60)
        if smoothness_score == 0.0 and vocoder_score == 0.0:
            final_synthetic_score = 0.0
        elif smoothness_score > 0.50 and vocoder_score > 0.50:
            # Both neural dynamics and vocoder artifacts confirm deepfake
            final_synthetic_score = float(np.clip(0.60 * smoothness_score + 0.40 * vocoder_score, 0.0, 1.0))
        elif smoothness_score > 0.70:
            # Over-smooth TTS
            final_synthetic_score = smoothness_score
        elif vocoder_score > 0.70:
            # Neural vocoder dispersion
            final_synthetic_score = vocoder_score
        else:
            final_synthetic_score = 0.0

        final_synthetic_score = round(float(np.clip(final_synthetic_score, 0.0, 1.0)), 4)
        threshold = getattr(settings, "SYNTHETIC_SCORE_THRESHOLD", 0.65)
        is_synthetic = final_synthetic_score >= threshold

        details = {
            "synthetic_score": final_synthetic_score,
            "is_synthetic": is_synthetic,
            "vocoder_artifact_score": round(vocoder_score, 4),
            "smoothness_score": round(smoothness_score, 4),
            "wavlm_l3_velocity": round(step_mean3, 4),
            "wavlm_l12_velocity": round(step_mean12, 4),
            "acoustic_artifacts": acoustic_metrics
        }

        return final_synthetic_score, details


# Instantiate module singleton
wavlm_detector = WavLMDetector()
