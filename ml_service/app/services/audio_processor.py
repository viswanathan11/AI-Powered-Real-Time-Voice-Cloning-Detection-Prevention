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


audio_processor = AudioProcessor()
