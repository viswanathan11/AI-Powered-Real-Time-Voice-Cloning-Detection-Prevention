import base64
import io
from typing import Tuple, Optional
import numpy as np
import soundfile as sf
import torch
import torchaudio

from app.config import settings
from app.utils.logger import logger


class AudioProcessor:
    """
    Robust audio processor for real-time voice verification and synthetic detection.
    Handles base64 WAV/PCM decoding, stereo-to-mono downmixing, resampling to 16kHz,
    and voice activity / energy assessment.
    """

    def __init__(self, target_sample_rate: int = settings.SAMPLE_RATE):
        self.target_sample_rate = target_sample_rate

    def decode_base64_audio(self, audio_data: str) -> Tuple[torch.Tensor, int, bool, float]:
        """
        Decodes a base64 encoded audio string (WAV or raw PCM) into a 16kHz mono PyTorch tensor.

        Args:
            audio_data: Base64 string containing WAV file or raw PCM data.

        Returns:
            Tuple of:
                - waveform (torch.Tensor of shape [1, num_samples], float32 in [-1.0, 1.0])
                - sample_rate (int, normalized to 16000)
                - is_silent (bool, True if chunk contains only silence/noise below threshold)
                - rms_energy (float, root-mean-square energy)
        """
        # Strip data URL prefix if present (e.g., 'data:audio/wav;base64,...')
        if "," in audio_data:
            audio_data = audio_data.split(",", 1)[1]

        audio_data = audio_data.strip()
        try:
            raw_bytes = base64.b64decode(audio_data)
        except Exception as e:
            raise ValueError(f"Failed to decode base64 audio payload: {str(e)}")

        return self.process_raw_bytes(raw_bytes)

    def process_raw_bytes(self, raw_bytes: bytes) -> Tuple[torch.Tensor, int, bool, float]:
        """
        Processes raw audio bytes (WAV container or raw PCM 16-bit) to 16kHz mono torch.Tensor.
        """
        if len(raw_bytes) == 0:
            raise ValueError("Audio payload is empty")

        waveform: Optional[np.ndarray] = None
        orig_sr: int = self.target_sample_rate

        # Attempt 1: Try reading as standard audio container (WAV, FLAC, OGG) via soundfile
        try:
            byte_io = io.BytesIO(raw_bytes)
            data, sr = sf.read(byte_io, dtype="float32", always_2d=True)
            # data is [samples, channels]
            # Downmix to mono:
            waveform = np.mean(data, axis=1)
            orig_sr = sr
        except Exception:
            # Attempt 2: Fallback to raw 16-bit PCM (little-endian)
            try:
                # Expecting 16-bit signed integer PCM
                int16_data = np.frombuffer(raw_bytes, dtype=np.int16)
                if len(int16_data) > 0:
                    waveform = int16_data.astype(np.float32) / 32768.0
                    orig_sr = self.target_sample_rate
            except Exception:
                pass

        if waveform is None or len(waveform) == 0:
            raise ValueError("Unable to parse audio bytes as WAV or raw PCM")

        # Convert to PyTorch Tensor [1, num_samples]
        tensor_wave = torch.from_numpy(waveform).float().unsqueeze(0)

        # Resample if sample rate doesn't match target (16kHz)
        if orig_sr != self.target_sample_rate:
            resampler = torchaudio.transforms.Resample(orig_freq=orig_sr, new_freq=self.target_sample_rate)
            tensor_wave = resampler(tensor_wave)

        # Energy / Silence detection
        rms_energy = float(torch.sqrt(torch.mean(tensor_wave ** 2)).item())
        is_silent = rms_energy < settings.SILENCE_RMS_THRESHOLD

        # DC offset removal and gentle speech level normalization
        if not is_silent and rms_energy > 1e-4:
            # Center waveform (zero mean)
            tensor_wave = tensor_wave - torch.mean(tensor_wave)
            # Normalize active speech to target RMS 0.08 for model consistency
            target_rms = 0.08
            gain = min(12.0, max(0.2, target_rms / rms_energy))
            tensor_wave = tensor_wave * gain
            # Recalculate normalized RMS
            rms_energy = float(torch.sqrt(torch.mean(tensor_wave ** 2)).item())

        # Clamp values to valid [-1.0, 1.0] range
        tensor_wave = torch.clamp(tensor_wave, -1.0, 1.0)

        return tensor_wave, self.target_sample_rate, is_silent, rms_energy

    def encode_audio_to_base64_wav(self, waveform: torch.Tensor, sample_rate: int = 16000) -> str:
        """
        Encodes a torch.Tensor audio waveform into a base64 WAV string.
        """
        wav_np = waveform.squeeze().cpu().numpy()
        byte_io = io.BytesIO()
        sf.write(byte_io, wav_np, sample_rate, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        return base64.b64encode(byte_io.read()).decode("utf-8")

    def pad_or_trim(self, waveform: torch.Tensor, target_duration_sec: float = 3.0) -> torch.Tensor:
        """
        Pads with zeros or trims audio waveform to exact target duration.
        """
        target_samples = int(target_duration_sec * self.target_sample_rate)
        current_samples = waveform.shape[-1]

        if current_samples == target_samples:
            return waveform
        elif current_samples > target_samples:
            return waveform[:, :target_samples]
        else:
            padding = torch.zeros((waveform.shape[0], target_samples - current_samples), dtype=waveform.dtype)
            return torch.cat([waveform, padding], dim=-1)

    def assess_audio_quality(self, waveform: torch.Tensor, sample_rate: int = 16000) -> dict:
        """
        Assesses the physical acoustic quality of an audio chunk for verification reliability.
        Calculates duration, RMS energy, clipping ratio, active speech frame ratio, and estimated SNR.
        Returns quality status ('GOOD', 'POOR_QUALITY', 'INSUFFICIENT_SPEECH') and confidence multiplier [0.0, 1.0].
        """
        audio_np = waveform.squeeze().cpu().numpy()
        duration_sec = float(len(audio_np) / sample_rate)

        if len(audio_np) < 400:
            return {
                "durationSec": round(duration_sec, 3),
                "rmsEnergy": 0.0,
                "snrDb": 0.0,
                "clippingRatio": 0.0,
                "speechRatio": 0.0,
                "quality": "INSUFFICIENT_SPEECH",
                "isUsable": False,
                "confidenceMultiplier": 0.0
            }

        rms = float(np.sqrt(np.mean(audio_np ** 2)))
        clipping_count = np.sum(np.abs(audio_np) >= 0.995)
        clipping_ratio = float(clipping_count / len(audio_np))

        # Frame-level RMS (25ms window, 10ms hop)
        frame_len = int(sample_rate * 0.025)
        hop_len = int(sample_rate * 0.010)
        num_frames = (len(audio_np) - frame_len) // hop_len + 1

        if num_frames > 0:
            frames = np.lib.stride_tricks.sliding_window_view(audio_np, frame_len)[::hop_len]
            frame_rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-10)

            # Active speech frames have RMS above silence threshold
            active_speech_mask = frame_rms >= settings.SILENCE_RMS_THRESHOLD
            speech_ratio = float(np.sum(active_speech_mask) / len(active_speech_mask))

            num_noise = max(1, int(len(frame_rms) * 0.15))
            noise_floor_rms = np.mean(np.sort(frame_rms)[:num_noise])
            signal_rms = np.mean(frame_rms[active_speech_mask]) if np.any(active_speech_mask) else noise_floor_rms
            snr_db = float(20.0 * np.log10(max(1.0, signal_rms / (noise_floor_rms + 1e-6))))
        else:
            speech_ratio = 1.0 if rms >= settings.SILENCE_RMS_THRESHOLD else 0.0
            snr_db = 20.0 if rms >= settings.SILENCE_RMS_THRESHOLD else 0.0

        # Classification
        if rms < settings.SILENCE_RMS_THRESHOLD or duration_sec < settings.MIN_AUDIO_DURATION_SEC or speech_ratio < 0.15:
            quality = "INSUFFICIENT_SPEECH"
            is_usable = False
            confidence = 0.0
        elif clipping_ratio > 0.08 or (snr_db < 3.0 and speech_ratio < 0.40):
            quality = "POOR_QUALITY"
            is_usable = True
            confidence = 0.50
        else:
            quality = "GOOD"
            is_usable = True
            confidence = 1.0

        return {
            "durationSec": round(duration_sec, 3),
            "rmsEnergy": round(rms, 5),
            "snrDb": round(snr_db, 2),
            "clippingRatio": round(clipping_ratio, 4),
            "speechRatio": round(speech_ratio, 3),
            "quality": quality,
            "isUsable": is_usable,
            "confidenceMultiplier": confidence
        }

    def trim_silence_vad(
        self,
        waveform: torch.Tensor,
        sample_rate: int = 16000,
        energy_thresh: float = settings.SILENCE_RMS_THRESHOLD,
        min_duration_sec: float = settings.MIN_AUDIO_DURATION_SEC
    ) -> torch.Tensor:
        """
        Trims leading and trailing silence/noise frames using Voice Activity Detection (VAD).
        Ensures that ECAPA pooling and WavLM sequence dynamics operate only over active speech.
        """
        audio_np = waveform.squeeze().cpu().numpy()
        frame_len = int(sample_rate * 0.025)
        hop_len = int(sample_rate * 0.010)

        if len(audio_np) < frame_len:
            return waveform

        frames = np.lib.stride_tricks.sliding_window_view(audio_np, frame_len)[::hop_len]
        frame_rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-10)

        active_mask = frame_rms >= energy_thresh
        if not np.any(active_mask):
            return waveform

        first_active = max(0, int(np.argmax(active_mask) * hop_len))
        last_active = min(len(audio_np), int((len(active_mask) - 1 - np.argmax(active_mask[::-1])) * hop_len + frame_len))

        trimmed_audio = audio_np[first_active:last_active]
        if len(trimmed_audio) < int(min_duration_sec * sample_rate):
            return waveform

        return torch.from_numpy(trimmed_audio).float().unsqueeze(0).to(waveform.device)


audio_processor = AudioProcessor()
