/**
 * AudioCaptureEngine: Native Web Audio API 16kHz Mono PCM Audio Streamer & File Slicer.
 * Implements SIH26104 / Plane.md specification:
 *  - 16kHz mono raw PCM WAV encoding (Zero compression / No MediaRecorder)
 *  - 3-second chunking (48,000 samples @ 16kHz = 96,000 PCM bytes + 44B WAV header)
 *  - 4-byte big-endian sequence number prefix
 *  - Real-time oscilloscope & frequency analysis for canvas visualization
 */

export interface AudioChunkPayload {
  chunkSeq: number;
  binaryFrame: ArrayBuffer; // [4-byte seq][WAV bytes]
  wavBlob: Blob;
  base64Wav: string;
  durationSec: number;
  rmsLevel: number;
}

export interface AudioCaptureCallbacks {
  onChunkReady: (chunk: AudioChunkPayload) => void;
  onAudioLevel?: (rms: number) => void;
  onError?: (error: Error) => void;
}

export class AudioCaptureEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  public analyserNode: AnalyserNode | null = null;

  private targetSampleRate = 16000;
  private targetChunkDurationSec = 3.0;
  private targetChunkSamples = 48000; // 3s * 16000Hz

  private sampleBuffer: Float32Array[] = [];
  private accumulatedInputSamples = 0;
  private chunkSequence = 0;
  private isRecording = false;
  private callbacks: AudioCaptureCallbacks | null = null;

  constructor() {}

  private continuousSampleBuffer: Float32Array[] = [];
  private isContinuousRecording = false;

  /**
   * Starts a continuous, unlimited-length microphone recording session.
   * Useful for paragraph reading during enrollment at the user's natural pace.
   */
  async startContinuousRecording(options?: {
    onAudioLevel?: (rms: number) => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.stop();
    this.continuousSampleBuffer = [];
    this.isContinuousRecording = true;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch {
        this.audioContext = new AudioCtx();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyserNode);

      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isContinuousRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        this.continuousSampleBuffer.push(copy);

        let sumSq = 0;
        for (let i = 0; i < copy.length; i++) {
          sumSq += copy[i] * copy[i];
        }
        const rms = Math.sqrt(sumSq / copy.length);
        if (options?.onAudioLevel) {
          options.onAudioLevel(rms);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
    } catch (err: unknown) {
      this.isContinuousRecording = false;
      const error = err instanceof Error ? err : new Error(String(err));
      if (options?.onError) {
        options.onError(error);
      }
      throw error;
    }
  }

  /**
   * Stops continuous recording and automatically slices the complete speech stream
   * into standardized 3-second 16kHz PCM WAV chunks.
   */
  async stopContinuousRecording(): Promise<{ chunks: AudioChunkPayload[]; totalDurationSec: number }> {
    this.isContinuousRecording = false;
    const inputSampleRate = this.audioContext?.sampleRate || 48000;
    const recordedBuffers = [...this.continuousSampleBuffer];
    this.stop();

    if (recordedBuffers.length === 0) {
      return { chunks: [], totalDurationSec: 0 };
    }

    const totalLength = recordedBuffers.reduce((acc, b) => acc + b.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of recordedBuffers) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    const totalDurationSec = totalLength / inputSampleRate;

    // Resample to 16kHz mono
    const resampled = this.resampleAudio(merged, inputSampleRate, this.targetSampleRate);

    // Slice into standard 3-second chunks (48,000 samples each)
    const chunkSize = this.targetChunkSamples; // 48,000
    const chunks: AudioChunkPayload[] = [];
    let seq = 1;

    if (resampled.length < chunkSize) {
      // Audio is shorter than 3s: pad to 3s to form a single valid chunk
      const padded = new Float32Array(chunkSize);
      padded.set(resampled);

      let sumSq = 0;
      for (let j = 0; j < resampled.length; j++) {
        sumSq += resampled[j] * resampled[j];
      }
      const rms = Math.sqrt(sumSq / (resampled.length || 1));

      const wavBytes = this.encodeWAV(padded, this.targetSampleRate);
      const binaryFrame = this.createBinaryFrame(seq, wavBytes);
      const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      const base64Wav = this.uint8ArrayToBase64(wavBytes);

      chunks.push({
        chunkSeq: seq,
        binaryFrame,
        wavBlob,
        base64Wav,
        durationSec: totalDurationSec,
        rmsLevel: rms,
      });
    } else {
      for (let i = 0; i < resampled.length; i += chunkSize) {
        const slice = resampled.subarray(i, i + chunkSize);
        // Ignore residual tail if shorter than 1.0s (16,000 samples) and we already have valid chunks
        if (slice.length < 16000 && chunks.length > 0) {
          break;
        }

        const chunkSamples = new Float32Array(chunkSize);
        chunkSamples.set(slice);

        let sumSq = 0;
        for (let j = 0; j < slice.length; j++) {
          sumSq += slice[j] * slice[j];
        }
        const rms = Math.sqrt(sumSq / slice.length);

        const wavBytes = this.encodeWAV(chunkSamples, this.targetSampleRate);
        const binaryFrame = this.createBinaryFrame(seq, wavBytes);
        const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
        const base64Wav = this.uint8ArrayToBase64(wavBytes);

        chunks.push({
          chunkSeq: seq,
          binaryFrame,
          wavBlob,
          base64Wav,
          durationSec: this.targetChunkDurationSec,
          rmsLevel: rms,
        });

        seq++;
      }
    }

    return { chunks, totalDurationSec };
  }

  /**
   * Initializes microphone access and sets up Web Audio API processing graph for live call streaming.
   */
  async startMicrophone(callbacks: AudioCaptureCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.chunkSequence = 0;
    this.sampleBuffer = [];
    this.accumulatedInputSamples = 0;

    try {
      // Prefer 16kHz AudioContext if browser supports custom sample rate
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch {
        this.audioContext = new AudioCtx();
      }

      // Request clean 16kHz-optimized mic stream with native browser noise handling
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Analyser node for live oscilloscope/spectrum visualization
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyserNode);

      // Buffer size 4096 gives ~85ms intervals at 48kHz
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      const inputSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Copy chunk
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        this.sampleBuffer.push(copy);
        this.accumulatedInputSamples += copy.length;

        // Calculate live RMS energy
        let sumSq = 0;
        for (let i = 0; i < copy.length; i++) {
          sumSq += copy[i] * copy[i];
        }
        const rms = Math.sqrt(sumSq / copy.length);
        if (this.callbacks?.onAudioLevel) {
          this.callbacks.onAudioLevel(rms);
        }

        // Check if we have accumulated ~3 seconds of audio at the input sample rate
        const neededInputSamples = Math.round(this.targetChunkDurationSec * inputSampleRate);
        if (this.accumulatedInputSamples >= neededInputSamples) {
          this.flushChunk(inputSampleRate);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.callbacks?.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  /**
   * Resamples and packages the accumulated audio into a standard 3-second 16kHz PCM WAV chunk.
   */
  private flushChunk(inputSampleRate: number): void {
    if (this.sampleBuffer.length === 0) return;

    // Concatenate accumulated float buffers
    const totalLength = this.sampleBuffer.reduce((acc, b) => acc + b.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of this.sampleBuffer) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    this.sampleBuffer = [];
    this.accumulatedInputSamples = 0;

    // Resample to 16kHz mono
    const resampled = this.resampleAudio(merged, inputSampleRate, this.targetSampleRate);

    // Pad or trim to exactly 48,000 samples (3.0 sec)
    const exact3s = new Float32Array(this.targetChunkSamples);
    if (resampled.length >= this.targetChunkSamples) {
      exact3s.set(resampled.subarray(0, this.targetChunkSamples));
    } else {
      exact3s.set(resampled);
    }

    // Compute RMS
    let sumSq = 0;
    for (let i = 0; i < exact3s.length; i++) {
      sumSq += exact3s[i] * exact3s[i];
    }
    const rms = Math.sqrt(sumSq / exact3s.length);

    this.chunkSequence++;
    const seq = this.chunkSequence;

    // Encode to 16-bit PCM WAV
    const wavBytes = this.encodeWAV(exact3s, this.targetSampleRate);

    // Build binary frame: [4 bytes seq (big-endian)][WAV bytes]
    const binaryFrame = this.createBinaryFrame(seq, wavBytes);
    const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });

    // Convert to base64
    const base64Wav = this.uint8ArrayToBase64(wavBytes);

    const payload: AudioChunkPayload = {
      chunkSeq: seq,
      binaryFrame,
      wavBlob,
      base64Wav,
      durationSec: this.targetChunkDurationSec,
      rmsLevel: rms,
    };

    if (this.callbacks?.onChunkReady) {
      this.callbacks.onChunkReady(payload);
    }
  }

  /**
   * Bandlimited / anti-aliased interpolation resampler for converting browser sample rate to 16kHz.
   */
  public resampleAudio(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return audioData;
    const ratio = fromRate / toRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    // If downsampling, apply a simple box-filter / moving average to mitigate high-frequency aliasing
    const filterWidth = Math.max(1, Math.floor(ratio));

    for (let i = 0; i < newLength; i++) {
      const center = i * ratio;
      if (ratio > 1.2) {
        let sum = 0;
        let count = 0;
        const start = Math.max(0, Math.floor(center - filterWidth / 2));
        const end = Math.min(audioData.length, Math.ceil(center + filterWidth / 2));
        for (let j = start; j < end; j++) {
          sum += audioData[j];
          count++;
        }
        result[i] = count > 0 ? sum / count : 0;
      } else {
        const srcIndexFloor = Math.floor(center);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
        const frac = center - srcIndexFloor;
        result[i] = audioData[srcIndexFloor] * (1 - frac) + audioData[srcIndexCeil] * frac;
      }
    }
    return result;
  }

  /**
   * Generates a 44-byte standard RIFF PCM 16-bit WAV container.
   */
  public encodeWAV(samples: Float32Array, sampleRate = 16000): Uint8Array {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // chunkSize
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
    view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM 16-bit signed integer samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      // Clamp between -1.0 and 1.0
      const s = Math.max(-1, Math.min(1, samples[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, val, true); // little-endian PCM sample
    }

    return new Uint8Array(buffer);
  }

  /**
   * Prepend 4-byte big-endian sequence number according to Plane.md:
   * [4 bytes: chunk sequence number][remaining bytes: 16kHz mono PCM WAV]
   */
  public createBinaryFrame(chunkSeq: number, wavBytes: Uint8Array): ArrayBuffer {
    const frameBuffer = new ArrayBuffer(4 + wavBytes.byteLength);
    const dataView = new DataView(frameBuffer);
    dataView.setUint32(0, chunkSeq, false); // Big-endian (>I in Python)
    new Uint8Array(frameBuffer, 4).set(wavBytes);
    return frameBuffer;
  }

  /**
   * Slices an existing audio file or base64 into exact 3-second chunks for attack simulation.
   */
  async sliceAudioIntoChunks(
    audioSource: ArrayBuffer | Blob | string
  ): Promise<AudioChunkPayload[]> {
    let arrayBuffer: ArrayBuffer;

    if (typeof audioSource === 'string') {
      // Base64 string
      const b64 = audioSource.includes(',') ? audioSource.split(',')[1] : audioSource;
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else if (audioSource instanceof Blob) {
      arrayBuffer = await audioSource.arrayBuffer();
    } else {
      arrayBuffer = audioSource;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioCtx();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    await tempCtx.close();

    // Downmix to mono if stereo
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    if (numChannels === 1) {
      mono.set(audioBuffer.getChannelData(0));
    } else {
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      for (let i = 0; i < length; i++) {
        mono[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    // Resample to 16kHz
    const resampled = this.resampleAudio(mono, audioBuffer.sampleRate, this.targetSampleRate);

    const chunks: AudioChunkPayload[] = [];
    const chunkSize = this.targetChunkSamples; // 48,000 samples = 3s
    let seq = 1;

    for (let i = 0; i < resampled.length; i += chunkSize) {
      const chunkSamples = new Float32Array(chunkSize);
      const slice = resampled.subarray(i, i + chunkSize);
      chunkSamples.set(slice);

      let sumSq = 0;
      for (let j = 0; j < chunkSamples.length; j++) {
        sumSq += chunkSamples[j] * chunkSamples[j];
      }
      const rms = Math.sqrt(sumSq / chunkSamples.length);

      const wavBytes = this.encodeWAV(chunkSamples, this.targetSampleRate);
      const binaryFrame = this.createBinaryFrame(seq, wavBytes);
      const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
      const base64Wav = this.uint8ArrayToBase64(wavBytes);

      chunks.push({
        chunkSeq: seq,
        binaryFrame,
        wavBlob,
        base64Wav,
        durationSec: this.targetChunkDurationSec,
        rmsLevel: rms,
      });

      seq++;
    }

    return chunks;
  }

  stop(): void {
    this.isRecording = false;
    this.isContinuousRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // AudioContext may already be closing or closed
      }
      this.audioContext = null;
    }
    this.callbacks = null;
    this.sampleBuffer = [];
    this.continuousSampleBuffer = [];
    this.accumulatedInputSamples = 0;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  public uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export const audioCaptureEngine = new AudioCaptureEngine();
