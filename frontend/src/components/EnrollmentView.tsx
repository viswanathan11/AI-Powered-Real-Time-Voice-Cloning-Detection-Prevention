import React, { useState, useEffect, useRef } from 'react';
import { VoiceProfile, EnrollVoiceprintRequest } from '../types';
import { api } from '../services/api';
import { getDemoAudioPayloads } from '../data/demoAudio';
import { audioCaptureEngine } from '../services/audioCapture';
import { WaveformVisualizer } from './WaveformVisualizer';
import {
  UserCheck,
  UserPlus,
  Trash2,
  Lock,
  Mic,
  Square,
  CheckCircle,
  Sparkles,
  Upload,
  RefreshCw,
  Fingerprint,
  ShieldCheck,
  BookOpen,
  Copy,
  Check,
  Info,
  Volume2,
  Layers,
  Timer,
  RotateCcw,
  FileAudio,
} from 'lucide-react';

export const RAINBOW_PASSAGE_SENTENCES = [
  'When the sunlight strikes raindrops in the air, they act as a prism and form a rainbow.',
  'The rainbow is a division of white light into many beautiful colors.',
  'These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.',
];

export const RAINBOW_PASSAGE_FULL = RAINBOW_PASSAGE_SENTENCES.join(' ');

interface EnrollmentViewProps {
  profiles: VoiceProfile[];
  onRefreshProfiles: () => Promise<void>;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  profiles,
  onRefreshProfiles,
}) => {
  // Form fields
  const [personName, setPersonName] = useState('Ramesh Kumar');
  const [role, setRole] = useState('Chief Financial Officer (CFO)');
  const [orgId, setOrgId] = useState('org_hdfc_bank');

  // Input Mode: 'mic' | 'file'
  const [inputMode, setInputMode] = useState<'mic' | 'file'>('mic');

  // Audio samples & chunking state
  const [audioSamples, setAudioSamples] = useState<string[]>([]);
  const [recordedDurationSec, setRecordedDurationSec] = useState<number>(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Live recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationSec, setRecordingDurationSec] = useState<number>(0);
  const [rmsLevel, setRmsLevel] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Status and UI state
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reading prompt UI states
  const [promptViewMode, setPromptViewMode] = useState<'full' | 'step'>('full');
  const [showPromptInfo, setShowPromptInfo] = useState(false);
  const [copied, setCopied] = useState(false);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      audioCaptureEngine.stop();
    };
  }, []);

  // Copy full passage to clipboard
  const handleCopyPassage = async () => {
    try {
      await navigator.clipboard.writeText(RAINBOW_PASSAGE_FULL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Load demo CFO samples for instant 1-click enrollment testing
  const handleLoadDemoSamples = async () => {
    try {
      setLoading(true);
      const payloads = await getDemoAudioPayloads();
      const samples = [
        payloads['cfo_enrollment_1.wav'],
        payloads['cfo_enrollment_2.wav'],
        payloads['cfo_enrollment_3.wav'],
      ].filter(Boolean);

      if (samples.length === 0) {
        throw new Error('Demo CFO samples not found in /sample_payloads.json');
      }

      setPersonName('Ramesh Kumar');
      setRole('Chief Financial Officer (CFO)');
      setOrgId('org_hdfc_bank');
      setAudioSamples(samples);
      setRecordedDurationSec(9.0);
      setUploadedFileName('cfo_demo_suite (3 pre-sliced clips)');
      setSuccessMessage('Loaded 3 authentic CFO voice clips ready for enrollment!');
      setErrorMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to load demo samples: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Start continuous single-take recording
  const handleStartRecording = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setAudioSamples([]);
      setRecordedDurationSec(0);
      setRecordingDurationSec(0);
      setUploadedFileName(null);
      setIsRecording(true);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingDurationSec(elapsed);
      }, 100);

      await audioCaptureEngine.startContinuousRecording({
        onAudioLevel: (rms) => setRmsLevel(rms),
        onError: (err) => {
          setErrorMessage(`Microphone capture error: ${err.message}`);
          handleStopRecording();
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Could not access microphone: ${msg}`);
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Stop continuous recording and auto-slice into chunks
  const handleStopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      setLoading(true);
      const { chunks, totalDurationSec } = await audioCaptureEngine.stopContinuousRecording();
      setIsRecording(false);
      setRmsLevel(0);

      if (chunks.length === 0) {
        setErrorMessage('No audible speech detected. Please speak into the mic while reading the passage.');
        setAudioSamples([]);
        setRecordedDurationSec(0);
        return;
      }

      const sampleB64s = chunks.map((c) => c.base64Wav);
      setAudioSamples(sampleB64s);
      setRecordedDurationSec(totalDurationSec);
      setSuccessMessage(
        `✓ Captured ${totalDurationSec.toFixed(1)}s of continuous voice! Automatically partitioned into ${chunks.length} biometric chunks (192-d ECAPA-TDNN).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Error processing recording: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle single audio file upload and auto-slice
  const handleSingleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadedFileName(file.name);

      const chunks = await audioCaptureEngine.sliceAudioIntoChunks(file);
      if (chunks.length === 0) {
        throw new Error('Could not extract valid audio chunks from file.');
      }

      const sampleB64s = chunks.map((c) => c.base64Wav);
      setAudioSamples(sampleB64s);
      setRecordedDurationSec(chunks.length * 3);
      setSuccessMessage(
        `✓ Loaded "${file.name}"! Sliced into ${chunks.length} standardized biometric chunks ready for enrollment.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to process audio file: ${msg}`);
      setAudioSamples([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset/Clear recording
  const handleResetRecording = () => {
    setAudioSamples([]);
    setRecordedDurationSec(0);
    setUploadedFileName(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Submit Enrollment
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setErrorMessage('Please enter the executive name.');
      return;
    }
    if (audioSamples.length === 0) {
      setErrorMessage('Please record your voice reading the passage or upload an audio file first.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const req: EnrollVoiceprintRequest = {
        personName: personName.trim(),
        role: role.trim(),
        orgId: orgId.trim(),
        audioSamples: audioSamples,
      };

      const profile = await api.enrollVoiceprint(req);
      setSuccessMessage(
        `✓ Voiceprint successfully enrolled for "${profile.personName}" (${profile.role})! 192-d mathematical vector stored across ${audioSamples.length} chunks.`
      );
      setAudioSamples([]);
      setRecordedDurationSec(0);
      setUploadedFileName(null);
      await onRefreshProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Enrollment failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to remove this executive voiceprint?')) return;
    try {
      await api.deleteProfile(id);
      await onRefreshProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Delete failed: ${msg}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Privacy Assurance Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white">
                Zero Raw Voice Storage (DPDP &amp; GDPR Compliant)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                Mandate #4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ECAPA-TDNN generates a 192-d mathematical embedding vector. Raw audio is instantly wiped from memory.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLoadDemoSamples}
          disabled={loading || isRecording}
          className="shrink-0 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Load Demo CFO Clips</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Enrollment Form & Continuous Single-Take Recording (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Enroll Executive Voiceprint</h3>
                  <p className="text-xs text-slate-400">
                    Read the passage continuously at your natural speed — auto-chunked in background
                  </p>
                </div>
              </div>

              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono hidden sm:inline-flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Text-Independent 192-d</span>
              </span>
            </div>

            {/* Notification Messages */}
            {successMessage && (
              <div className="p-3 mb-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="p-3 mb-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              {/* Executive Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    disabled={isRecording}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Executive Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={isRecording}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. CFO"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Organization ID
                  </label>
                  <input
                    type="text"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    disabled={isRecording}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. org_bank_01"
                  />
                </div>
              </div>

              {/* PHONETICALLY BALANCED READING PROMPT (The Rainbow Passage) */}
              <div className="bg-gradient-to-b from-slate-950/90 to-slate-900/90 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      Phonetically Balanced Passage (The Rainbow Passage)
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setPromptViewMode('full')}
                        className={`px-2 py-0.5 rounded transition ${
                          promptViewMode === 'full'
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Full Paragraph
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptViewMode('step')}
                        className={`px-2 py-0.5 rounded transition ${
                          promptViewMode === 'step'
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Sentence Breakdown
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyPassage}
                      className="p-1 text-slate-400 hover:text-cyan-300 rounded transition cursor-pointer"
                      title="Copy passage to clipboard"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPromptInfo(!showPromptInfo)}
                      className="p-1 text-slate-400 hover:text-cyan-300 rounded transition cursor-pointer"
                      title="Why read this passage?"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Read aloud comfortably while recording. It contains all key vowel formants and consonant transitions for a comprehensive biometric signature.
                </p>

                {/* Educational info toggle */}
                {showPromptInfo && (
                  <div className="p-2.5 bg-cyan-950/30 border border-cyan-500/20 rounded-lg text-[11px] text-cyan-200/90 leading-relaxed space-y-1">
                    <p className="font-semibold text-cyan-300">💡 Why The Rainbow Passage?</p>
                    <p>
                      The Rainbow Passage contains almost all English phonemes, formant transitions, and frequency variations.
                    </p>
                    <p className="text-slate-300">
                      Once enrolled, the system verifies your voice against <strong>any different words spoken in future calls</strong> (text-independent).
                    </p>
                  </div>
                )}

                {/* Paragraph Content Display */}
                {promptViewMode === 'full' ? (
                  <div className={`p-3.5 rounded-xl border transition-all ${
                    isRecording 
                      ? 'bg-cyan-950/30 border-cyan-400/80 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/40' 
                      : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans select-text">
                      &ldquo;{RAINBOW_PASSAGE_FULL}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {RAINBOW_PASSAGE_SENTENCES.map((sentence, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs ${
                          isRecording
                            ? 'bg-cyan-950/20 border-cyan-500/40 text-slate-100'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <span className="text-[10px] font-mono text-cyan-400 mr-2 font-bold">
                          [{idx + 1}]
                        </span>
                        {sentence}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RECORDING / FILE INPUT SECTION */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-950/70 p-0.5 rounded-lg border border-slate-800/80 text-xs">
                      <button
                        type="button"
                        disabled={isRecording}
                        onClick={() => setInputMode('mic')}
                        className={`px-3 py-1 rounded-md transition flex items-center space-x-1.5 ${
                          inputMode === 'mic'
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Continuous Mic</span>
                      </button>
                      <button
                        type="button"
                        disabled={isRecording}
                        onClick={() => setInputMode('file')}
                        className={`px-3 py-1 rounded-md transition flex items-center space-x-1.5 ${
                          inputMode === 'file'
                            ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileAudio className="w-3.5 h-3.5" />
                        <span>Upload Audio File</span>
                      </button>
                    </div>
                  </div>

                  {audioSamples.length > 0 && (
                    <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{audioSamples.length} Chunks Ready ({recordedDurationSec.toFixed(1)}s)</span>
                    </span>
                  )}
                </div>

                {/* MODE 1: LIVE CONTINUOUS MIC RECORDING */}
                {inputMode === 'mic' && (
                  <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
                    {!isRecording ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                            <Mic className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">
                              {audioSamples.length > 0 ? 'Voice Sample Captured' : 'Single-Take Recording'}
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {audioSamples.length > 0
                                ? `${audioSamples.length} chunks generated from ${recordedDurationSec.toFixed(1)}s speech.`
                                : 'Click Start, read the passage at your pace, then click Stop.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 w-full sm:w-auto">
                          {audioSamples.length > 0 && (
                            <button
                              type="button"
                              onClick={handleResetRecording}
                              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                              title="Clear recording"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Clear</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleStartRecording}
                            disabled={loading}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                          >
                            <Mic className="w-4 h-4" />
                            <span>{audioSamples.length > 0 ? 'Record Again' : 'Start Recording'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE RECORDING STATE */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                            <span className="text-xs font-bold text-rose-300 font-mono tracking-wide">
                              RECORDING SPEECH...
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                            <Timer className="w-3.5 h-3.5" />
                            <span>{recordingDurationSec.toFixed(1)}s</span>
                          </div>
                        </div>

                        {/* Waveform Visualizer */}
                        <div className="h-14 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                          <WaveformVisualizer
                            analyserNode={audioCaptureEngine.analyserNode}
                            isActive={isRecording}
                            rmsLevel={rmsLevel}
                            mode="mic"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <p className="text-[11px] text-slate-400 italic">
                            Read the passage above aloud. Click Stop when you finish.
                          </p>

                          <button
                            type="button"
                            onClick={handleStopRecording}
                            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition flex items-center space-x-2 cursor-pointer animate-pulse"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop &amp; Auto-Chunk</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2: SINGLE AUDIO FILE UPLOAD */}
                {inputMode === 'file' && (
                  <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
                    <label className="flex flex-col items-center justify-center space-y-2 p-4 border border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl cursor-pointer transition bg-slate-900/40">
                      <Upload className="w-5 h-5 text-cyan-400" />
                      <span className="text-xs font-medium text-slate-200">
                        {uploadedFileName ? uploadedFileName : 'Choose single audio recording (.wav, .mp3, .m4a)'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        The engine will automatically slice it into 3-second ECAPA-TDNN frames.
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleSingleFileUpload}
                        disabled={isRecording || loading}
                        className="hidden"
                      />
                    </label>

                    {audioSamples.length > 0 && (
                      <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
                        <span className="font-mono text-emerald-400">
                          ✓ {audioSamples.length} chunks generated
                        </span>
                        <button
                          type="button"
                          onClick={handleResetRecording}
                          className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                        >
                          Remove file
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Chunking Breakdown Pill List */}
                {audioSamples.length > 0 && (
                  <div className="p-3 bg-slate-950/40 border border-slate-800/70 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">
                        Biometric Extraction Pipeline:
                      </span>
                      <span className="text-slate-400 font-mono">
                        {audioSamples.length} × 3.0s (16kHz Mono PCM)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {audioSamples.map((_, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono rounded-md flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Chunk #{idx + 1}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || isRecording || audioSamples.length === 0}
                  className={`w-full py-3 px-4 font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-xs tracking-wide cursor-pointer ${
                    audioSamples.length > 0 && !isRecording
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4" />
                  )}
                  <span>
                    {audioSamples.length > 0
                      ? `EXTRACT 192-D EMBEDDING & ENROLL (${audioSamples.length} CHUNKS)`
                      : 'RECORD OR UPLOAD SPEECH TO ENROLL'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Enrolled Profiles Directory (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/70">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Registered Executive Profiles</h3>
              </div>
              <button
                type="button"
                onClick={() => onRefreshProfiles()}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Refresh Profile List"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                No voice profiles enrolled yet. Complete the form to register an executive.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {profiles.map((p) => (
                  <div
                    key={p.profileId}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{p.personName}</h4>
                        <p className="text-[11px] text-cyan-400">{p.role || 'Executive'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.profileId)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                      <div>
                        <span>Samples:</span>
                        <div className="text-emerald-400 font-semibold">{p.sampleCount} chunks (192-d)</div>
                      </div>
                      <div>
                        <span>Enrolled:</span>
                        <div className="text-slate-400">{new Date(p.enrolledAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Total: {profiles.length} Profiles</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vault Active</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

