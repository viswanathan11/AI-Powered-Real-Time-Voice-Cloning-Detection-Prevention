import unittest
import numpy as np
import soundfile as sf
import io
import base64
import torch

from app.services.audio_processor import AudioProcessor


class TestAudioProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = AudioProcessor(target_sample_rate=16000)

    def _create_sine_wave_b64(self, freq=440.0, duration=1.0, sr=16000, channels=1, amplitude=0.5):
        t = np.linspace(0, duration, int(sr * duration), endpoint=False)
        audio = amplitude * np.sin(2 * np.pi * freq * t).astype(np.float32)
        if channels == 2:
            audio = np.column_stack([audio, audio])
        byte_io = io.BytesIO()
        sf.write(byte_io, audio, sr, format="WAV", subtype="PCM_16")
        byte_io.seek(0)
        return base64.b64encode(byte_io.read()).decode("utf-8")

    def test_decode_valid_wav_16k_mono(self):
        b64_audio = self._create_sine_wave_b64(freq=440.0, duration=2.0, sr=16000, channels=1)
        waveform, sr, is_silent, rms = self.processor.decode_base64_audio(b64_audio)
        self.assertEqual(sr, 16000)
        self.assertEqual(waveform.dim(), 2)
        self.assertEqual(waveform.shape[0], 1)
        self.assertEqual(waveform.shape[1], 32000)
        self.assertFalse(is_silent)
        self.assertGreater(rms, 0.01)

    def test_stereo_to_mono_downmixing(self):
        b64_stereo = self._create_sine_wave_b64(freq=440.0, duration=1.0, sr=16000, channels=2)
        waveform, sr, is_silent, rms = self.processor.decode_base64_audio(b64_stereo)
        self.assertEqual(waveform.shape[0], 1)
        self.assertEqual(waveform.shape[1], 16000)

    def test_resampling_from_44k1(self):
        b64_44k = self._create_sine_wave_b64(freq=440.0, duration=1.0, sr=44100, channels=1)
        waveform, sr, is_silent, rms = self.processor.decode_base64_audio(b64_44k)
        self.assertEqual(sr, 16000)
        # Should be approximately 16000 samples (+/- a few due to filter lag)
        self.assertTrue(abs(waveform.shape[1] - 16000) < 50)

    def test_silence_detection(self):
        b64_silent = self._create_sine_wave_b64(freq=440.0, duration=1.0, sr=16000, amplitude=0.0001)
        waveform, sr, is_silent, rms = self.processor.decode_base64_audio(b64_silent)
        self.assertTrue(is_silent)
        self.assertLess(rms, 0.005)

    def test_raw_pcm_fallback(self):
        # 16-bit raw PCM without header
        t = np.linspace(0, 1.0, 16000, endpoint=False)
        pcm_data = (0.4 * np.sin(2 * np.pi * 300 * t) * 32767).astype(np.int16).tobytes()
        b64_pcm = base64.b64encode(pcm_data).decode("utf-8")
        waveform, sr, is_silent, rms = self.processor.decode_base64_audio(b64_pcm)
        self.assertEqual(sr, 16000)
        self.assertEqual(waveform.shape[1], 16000)
        self.assertFalse(is_silent)

    def test_pad_or_trim(self):
        short_tensor = torch.zeros((1, 8000))
        padded = self.processor.pad_or_trim(short_tensor, target_duration_sec=1.0)
        self.assertEqual(padded.shape[1], 16000)

        long_tensor = torch.zeros((1, 32000))
        trimmed = self.processor.pad_or_trim(long_tensor, target_duration_sec=1.0)
        self.assertEqual(trimmed.shape[1], 16000)


if __name__ == "__main__":
    unittest.main()
