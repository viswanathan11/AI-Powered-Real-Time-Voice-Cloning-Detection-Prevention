import React, { useState, useEffect, useRef } from 'react';
import { VoiceProfile } from '../types';
import { DEMO_SCENARIOS, DemoScenario, getScenarioAudioBase64 } from '../data/demoAudio';
import { audioCaptureEngine, AudioChunkPayload } from '../services/audioCapture';
import { WaveformVisualizer } from './WaveformVisualizer';
import {
  Phone,
  PhoneOff,
  Mic,
  FileAudio,
  Radio,
  UserX,
  UserCheck,
  AlertTriangle,
  Play,
  Upload,
  Layers,
  Settings,
  Sparkles,
} from 'lucide-react';

interface ThreatSimulatorProps {
  profiles: VoiceProfile[];
  selectedProfileId: string;
  onSelectProfileId: (id: string) => void;
  isStreaming: boolean;
  onStartCall: (config: {
    claimedIdentity: string;
    callType: string;
    amount: number;
    callerNumber: string;
  }) => Promise<void>;
  onEndCall: () => Promise<void>;
  onChunkReady: (chunk: AudioChunkPayload) => void;
  currentRisk: number;
}

export const ThreatSimulator: React.FC<ThreatSimulatorProps> = ({
  profiles,
  selectedProfileId,
  onSelectProfileId,
  isStreaming,
  onStartCall,
  onEndCall,
  onChunkReady,
  currentRisk,
}) => {
  // Mode: 'preset' | 'mic' | 'file'
  const [sourceMode, setSourceMode] = useState<'preset' | 'mic' | 'file'>('preset');
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>(DEMO_SCENARIOS[0]);

  // Context form state
  const [callType, setCallType] = useState<string>('fund_transfer_approval');
  const [amount, setAmount] = useState<number>(5000000);
  const [callerNumber, setCallerNumber] = useState<string>('+91 98765 43210');

  // Audio stats state
  const [rmsLevel, setRmsLevel] = useState<number>(0);
  const [chunkProgressSec, setChunkProgressSec] = useState<number>(0);
  const [chunksSentCount, setChunksSentCount] = useState<number>(0);
  const [totalBytesSent, setTotalBytesSent] = useState<number>(0);
  const [streamDurationSec, setStreamDurationSec] = useState<number>(0);

  // File upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedChunks, setUploadedChunks] = useState<AudioChunkPayload[]>([]);

  // Simulation timer ref
  const simTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  // Synchronize scenario metadata when scenario is changed
  useEffect(() => {
    if (sourceMode === 'preset' && selectedScenario) {
      setCallType(selectedScenario.callType);
      setAmount(selectedScenario.amount);
      setCallerNumber(selectedScenario.callerNumber);
    }
  }, [selectedScenario, sourceMode]);

  // Track stream duration and chunk 3s timer
  useEffect(() => {
    if (isStreaming) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setStreamDurationSec(elapsed);
        setChunkProgressSec((elapsed % 3.0));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setStreamDurationSec(0);
      setChunkProgressSec(0);
      setRmsLevel(0);
    }
  }, [isStreaming]);

  // Handle Start Call
  const handleStartCall = async () => {
    setChunksSentCount(0);
    setTotalBytesSent(0);

    try {
      await onStartCall({
        claimedIdentity: selectedProfileId,
        callType,
        amount,
        callerNumber,
      });

      if (sourceMode === 'mic') {
        // Start live microphone stream
        await audioCaptureEngine.startMicrophone({
          onChunkReady: (chunk) => {
            setChunksSentCount((c) => c + 1);
            setTotalBytesSent((b) => b + chunk.binaryFrame.byteLength);
            onChunkReady(chunk);
          },
          onAudioLevel: (rms) => setRmsLevel(rms),
          onError: (err) => alert(`Microphone error: ${err.message}`),
        });
      } else if (sourceMode === 'preset') {
        // Load pre-recorded scenario audio and stream chunk by chunk
        const base64Audio = await getScenarioAudioBase64(selectedScenario.filename);
        const slicedChunks = await audioCaptureEngine.sliceAudioIntoChunks(base64Audio);

        let currentIdx = 0;

        // Send first chunk immediately
        if (slicedChunks.length > 0) {
          const first = slicedChunks[0];
          setChunksSentCount(1);
          setTotalBytesSent(first.binaryFrame.byteLength);
          setRmsLevel(first.rmsLevel);
          onChunkReady(first);
          currentIdx = 1;
        }

        // Send subsequent chunks every 3 seconds (real-time chunking simulation)
        simTimerRef.current = window.setInterval(() => {
          if (currentIdx < slicedChunks.length) {
            const nextChunk = slicedChunks[currentIdx];
            setChunksSentCount((c) => c + 1);
            setTotalBytesSent((b) => b + nextChunk.binaryFrame.byteLength);
            setRmsLevel(nextChunk.rmsLevel);
            onChunkReady(nextChunk);
            currentIdx++;
          } else {
            // Loop or keep active
            currentIdx = 0;
          }
        }, 3000);
      } else if (sourceMode === 'file') {
        // Custom file stream
        if (uploadedChunks.length === 0) {
          alert('Please select or upload an audio file (.wav or .mp3) first.');
          await onEndCall();
          return;
        }

        let currentIdx = 0;
        if (uploadedChunks.length > 0) {
          const first = uploadedChunks[0];
          setChunksSentCount(1);
          setTotalBytesSent(first.binaryFrame.byteLength);
          setRmsLevel(first.rmsLevel);
          onChunkReady(first);
          currentIdx = 1;
        }

        simTimerRef.current = window.setInterval(() => {
          if (currentIdx < uploadedChunks.length) {
            const nextChunk = uploadedChunks[currentIdx];
            setChunksSentCount((c) => c + 1);
            setTotalBytesSent((b) => b + nextChunk.binaryFrame.byteLength);
            setRmsLevel(nextChunk.rmsLevel);
            onChunkReady(nextChunk);
            currentIdx++;
          } else {
            currentIdx = 0;
          }
        }, 3000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to start call: ${msg}`);
      handleEndCall();
    }
  };

  // Handle End Call
  const handleEndCall = async () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    audioCaptureEngine.stop();
    await onEndCall();
  };

  // Handle Custom File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFileName(file.name);
      const chunks = await audioCaptureEngine.sliceAudioIntoChunks(file);
      setUploadedChunks(chunks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to process audio file: ${msg}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl">
            <Radio className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>Caller & Threat Simulator</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
                Layer 1: Audio Capture
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Simulates live incoming telephony/VoIP audio streams sent to backend via WebSockets
            </p>
          </div>
        </div>

        {isStreaming ? (
          <span className="flex items-center space-x-2 px-3 py-1 bg-rose-500/20 border border-rose-500/40 rounded-full text-xs font-bold font-mono text-rose-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>CALL IN PROGRESS</span>
          </span>
        ) : (
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono text-slate-400">
            DISCONNECTED
          </span>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-3 gap-2 my-4 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('preset')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
            sourceMode === 'preset'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Attack Presets</span>
        </button>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('mic')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
            sourceMode === 'mic'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Live Microphone</span>
        </button>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('file')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
            sourceMode === 'file'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileAudio className="w-3.5 h-3.5" />
          <span>Custom Audio File</span>
        </button>
      </div>

      {/* Preset Scenario Selector */}
      {sourceMode === 'preset' && (
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-slate-300 block">
            Select Threat Scenario Preset:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                disabled={isStreaming}
                onClick={() => setSelectedScenario(sc)}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedScenario.id === sc.id
                    ? sc.category === 'clone_attack'
                      ? 'bg-rose-950/40 border-rose-500/80 shadow-rose-950/50 ring-1 ring-rose-500'
                      : sc.category === 'genuine'
                      ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500'
                      : 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{sc.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      sc.expectedRiskLevel === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300'
                        : sc.expectedRiskLevel === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    Expected: {sc.expectedRiskLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{sc.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live Mic Info Banner */}
      {sourceMode === 'mic' && (
        <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3.5 mb-4 text-xs text-cyan-200">
          <div className="flex items-center space-x-2 font-bold mb-1">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span>Native Web Audio API Mic Streamer Active</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Records your physical microphone in uncompressed <strong>16kHz Mono 16-bit PCM</strong> without browser compression. Slices live speech into 3-second binary frames.
          </p>
        </div>
      )}

      {/* Custom Audio File Upload */}
      {sourceMode === 'file' && (
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-slate-300 block">
            Upload Voice Audio File (.wav or .mp3):
          </label>
          <div className="flex items-center space-x-2">
            <label className="flex-1 flex items-center justify-center space-x-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-mono text-slate-300">
                {uploadedFileName || 'Choose .wav / .mp3 file'}
              </span>
              <input
                type="file"
                accept="audio/wav, audio/mp3, audio/mpeg, audio/ogg"
                onChange={handleFileUpload}
                disabled={isStreaming}
                className="hidden"
              />
            </label>
          </div>
          {uploadedChunks.length > 0 && (
            <p className="text-[11px] text-emerald-400 font-mono">
              ✓ Ready: {uploadedChunks.length} chunks ({(uploadedChunks.length * 3).toFixed(0)}s duration at 16kHz)
            </p>
          )}
        </div>
      )}

      {/* Call & Identity Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
        {/* Claimed Profile */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Enrolled Voiceprint:</span>
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => onSelectProfileId(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
          >
            {profiles.length === 0 ? (
              <option value="">No profiles enrolled yet</option>
            ) : (
              profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.personName} ({p.role || 'Executive'}) - {p.profileId.substring(0, 10)}...
                </option>
              ))
            )}
          </select>
        </div>

        {/* Call Intent Type */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1">
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Intent Category:</span>
          </label>
          <select
            value={callType}
            onChange={(e) => setCallType(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="fund_transfer_approval">🚨 Fund Transfer Approval (Critical)</option>
            <option value="wire_transfer">🚨 Wire Transfer Execution</option>
            <option value="credential_reset">🔑 Admin Credential Reset</option>
            <option value="executive_instruction">👔 Urgent Executive Instruction</option>
            <option value="vendor_invoice_approval">💼 Standard Invoice Approval</option>
            <option value="general_inquiry">📞 General Inquiry (Low Risk)</option>
          </select>
        </div>

        {/* Transaction Amount */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
            Transaction Amount (₹ INR):
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={isStreaming}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="e.g. 5000000"
          />
          {amount >= 500000 && (
            <span className="text-[10px] text-amber-400 mt-0.5 block font-mono">
              ⚠️ High Value (&gt; ₹5L) triggers risk boost
            </span>
          )}
        </div>

        {/* Spoofed Caller ID */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 block mb-1">
            Inbound Caller ID (Telecom):
          </label>
          <input
            type="text"
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="+91 XXXXXXXXXX"
          />
        </div>
      </div>

      {/* Live Audio Visualizer Canvas */}
      <div className="mb-4">
        <WaveformVisualizer
          analyserNode={audioCaptureEngine.analyserNode}
          isActive={isStreaming}
          rmsLevel={rmsLevel}
          chunkProgressSec={chunkProgressSec}
          mode={sourceMode === 'preset' ? 'scenario' : sourceMode}
          riskScore={currentRisk}
        />
      </div>

      {/* Telemetry Status Bar */}
      <div className="grid grid-cols-4 gap-2 mb-4 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Duration</div>
          <div className="text-xs font-bold text-white">{streamDurationSec.toFixed(1)}s</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Chunks Sent</div>
          <div className="text-xs font-bold text-cyan-400">#{chunksSentCount}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Payload Size</div>
          <div className="text-xs font-bold text-slate-300">{(totalBytesSent / 1024).toFixed(0)} KB</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">PCM Format</div>
          <div className="text-xs font-bold text-emerald-400">16k / 16b</div>
        </div>
      </div>

      {/* Big Action Button */}
      <div className="mt-auto pt-2">
        {!isStreaming ? (
          <button
            type="button"
            onClick={handleStartCall}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold rounded-xl shadow-lg shadow-rose-900/30 transition duration-200 flex items-center justify-center space-x-2 text-sm tracking-wide"
          >
            <Phone className="w-5 h-5 animate-pulse" />
            <span>INITIATE CALL & STREAM TO BACKEND</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEndCall}
            className="w-full py-3.5 px-4 bg-red-700 hover:bg-red-600 text-white font-extrabold rounded-xl shadow-lg transition duration-200 flex items-center justify-center space-x-2 text-sm tracking-wide animate-pulse"
          >
            <PhoneOff className="w-5 h-5" />
            <span>TERMINATE CALL SESSION</span>
          </button>
        )}
      </div>
    </div>
  );
};
