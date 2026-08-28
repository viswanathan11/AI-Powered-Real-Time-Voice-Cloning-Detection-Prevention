import struct
import base64
import io
import json
from typing import Tuple, Union, Optional
import numpy as np
import soundfile as sf


def parse_websocket_frame(
    message: Union[bytes, str],
    default_seq: int = 1
) -> Tuple[int, bytes]:
    """
    Parses an incoming WebSocket frame from the React frontend.
    Handles:
      1. Binary Frame (Plane.md spec): [4 bytes chunk sequence number][remaining bytes audio WAV/PCM]
      2. Binary Frame (raw audio without prefix): [all bytes audio]
      3. Text/JSON Frame: {"chunkSeq": 12, "audio": "<base64>"}

    Returns:
        Tuple of (chunk_sequence_number: int, raw_audio_bytes: bytes)
    """
    if isinstance(message, str):
        # JSON text frame
        try:
            payload = json.loads(message)
            seq = int(payload.get("chunkSeq", default_seq))
            raw_b64 = payload.get("audio", "")
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            audio_bytes = base64.b64decode(raw_b64)
            return seq, audio_bytes
        except Exception as e:
            raise ValueError(f"Invalid text frame payload: {e}")

    elif isinstance(message, (bytes, bytearray)):
        data = bytes(message)
        if len(data) < 4:
            raise ValueError("Binary audio frame is too short (empty payload)")

        # Attempt to detect WAV header at byte offset 0 (i.e., no 4-byte prefix)
        # RIFF header starts with b'RIFF'
        if data.startswith(b"RIFF"):
            return default_seq, data

        # Check if byte 4 onwards starts with b'RIFF' (i.e., 4-byte sequence prefix present)
        if len(data) > 8 and data[4:8] == b"RIFF":
            # Unpack 4-byte sequence number (try big-endian >I, fallback little-endian <I)
            seq_be = struct.unpack(">I", data[:4])[0]
            seq_le = struct.unpack("<I", data[:4])[0]
            # Choose the more plausible small integer sequence (< 10,000,000)
            seq = seq_be if seq_be < 1000000 else seq_le
            return seq, data[4:]

        # If not explicit RIFF, check if first 4 bytes look like a sequence integer header
        seq_be = struct.unpack(">I", data[:4])[0]
        seq_le = struct.unpack("<I", data[:4])[0]

        if 0 <= seq_be < 100000:
            return seq_be, data[4:]
        elif 0 <= seq_le < 100000:
            return seq_le, data[4:]
        else:
            # Fallback: treat whole payload as raw audio
            return default_seq, data

    else:
        raise ValueError(f"Unsupported WebSocket frame type: {type(message)}")


def audio_bytes_to_base64(raw_bytes: bytes) -> str:
    """Encodes raw audio bytes to base64 string."""
    return base64.b64encode(raw_bytes).decode("utf-8")
