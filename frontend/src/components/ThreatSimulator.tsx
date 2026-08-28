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
  UserCheck,
  Upload,
  Sparkles,
  Settings2,
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
  const [isStarting, setIsStarting] = useState(false);

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
        setChunkProgressSec(elapsed % 3.0);
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
    if (isStarting || isStreaming) return;
    setIsStarting(true);
    setChunksSentCount(0);
    setTotalBytesSent(0);

    try {
      // For preset attacks and live calls, ensure a claimed profile is targeted
      let profileToClaim = selectedProfileId;
      if (!profileToClaim && profiles.length > 0) {
        const matched = profiles.find((p) => p.personName.toLowerCase().includes('ramesh')) || profiles[0];
        profileToClaim = matched.profileId;
        onSelectProfileId(profileToClaim);
      }

      await onStartCall({
        claimedIdentity: profileToClaim,
        callType,
        amount,
        callerNumber,
      });

      if (sourceMode === 'mic') {
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
        const base64Audio = await getScenarioAudioBase64(selectedScenario.filename);
        const slicedChunks = await audioCaptureEngine.sliceAudioIntoChunks(base64Audio);

        let currentIdx = 0;

        if (slicedChunks.length > 0) {
          const first = slicedChunks[0];
          setChunksSentCount(1);
          setTotalBytesSent(first.binaryFrame.byteLength);
          setRmsLevel(first.rmsLevel);
          onChunkReady(first);
          currentIdx = 1;
        }

        simTimerRef.current = window.setInterval(() => {
          if (slicedChunks.length === 0) return;
          if (currentIdx >= slicedChunks.length) {
            currentIdx = 0;
          }
          const nextChunk = slicedChunks[currentIdx];
          setChunksSentCount((c) => c + 1);
          setTotalBytesSent((b) => b + nextChunk.binaryFrame.byteLength);
          setRmsLevel(nextChunk.rmsLevel);
          onChunkReady(nextChunk);
          currentIdx++;
        }, 3000);
      } else if (sourceMode === 'file') {
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
          if (uploadedChunks.length === 0) return;
          if (currentIdx >= uploadedChunks.length) {
            currentIdx = 0;
          }
          const nextChunk = uploadedChunks[currentIdx];
          setChunksSentCount((c) => c + 1);
          setTotalBytesSent((b) => b + nextChunk.binaryFrame.byteLength);
          setRmsLevel(nextChunk.rmsLevel);
          onChunkReady(nextChunk);
          currentIdx++;
        }, 3000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to start call: ${msg}`);
      handleEndCall();
    } finally {
      setIsStarting(false);
    }
  };

  // Handle End Call
  const handleEndCall = async () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
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
    <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Call &amp; Threat Simulator
            </h2>
            <p className="text-xs text-slate-400">
              Simulate live telephony audio &amp; deepfake attack vectors
            </p>
          </div>
        </div>

        {isStreaming ? (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 rounded-full text-xs font-mono font-medium text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Streaming</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/60 rounded-full text-xs font-mono text-slate-400">
            Idle
          </span>
        )}
      </div>

      {/* Mode Selector Segmented Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('preset')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
            sourceMode === 'preset'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Preset Attacks</span>
        </button>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('mic')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
            sourceMode === 'mic'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Live Mic</span>
        </button>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setSourceMode('file')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
            sourceMode === 'file'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <FileAudio className="w-3.5 h-3.5" />
          <span>Audio File</span>
        </button>
      </div>

      {/* Preset Scenario Selector - Clean Horizontal Grid */}
      {sourceMode === 'preset' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DEMO_SCENARIOS.map((sc) => {
              const isSelected = selectedScenario.id === sc.id;
              let activeBorder = 'border-rose-500/70 bg-gradient-to-br from-rose-950/40 to-slate-950/80 text-rose-200 shadow-md shadow-rose-950/30';
              let badgeColor = 'bg-rose-500/25 text-rose-300 border border-rose-500/30';
              let dotColor = 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
              let scenarioTitle = '1. AI Clone Attack';
              let scenarioSub = 'Neural Vocoder Deepfake';

              if (sc.category === 'genuine') {
                activeBorder = 'border-emerald-500/70 bg-gradient-to-br from-emerald-950/40 to-slate-950/80 text-emerald-200 shadow-md shadow-emerald-950/30';
                badgeColor = 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30';
                dotColor = 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
                scenarioTitle = '2. Genuine Executive';
                scenarioSub = 'Authentic CFO Voice';
              } else if (sc.category === 'impersonator') {
                activeBorder = 'border-amber-500/70 bg-gradient-to-br from-amber-950/40 to-slate-950/80 text-amber-200 shadow-md shadow-amber-950/30';
                badgeColor = 'bg-amber-500/25 text-amber-300 border border-amber-500/30';
                dotColor = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
                scenarioTitle = '3. Human Imposter';
                scenarioSub = 'Voice Mismatch (Scammer)';
              }

              return (
                <button
                  key={sc.id}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => setSelectedScenario(sc)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? `${activeBorder} ring-1 ring-white/20 scale-[1.02]`
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                        <span className="text-xs font-bold tracking-tight text-white">
                          {scenarioTitle}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mb-2">
                      {scenarioSub}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-400">Threat Risk:</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${badgeColor}`}>
                      {sc.expectedRiskLevel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Scenario Brief */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 shadow-inner">
            <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[10px] mb-1 uppercase font-bold">
              <span>Attack Simulation Vector:</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {selectedScenario.description}
            </p>
          </div>
        </div>
      )}

      {/* Live Mic Info Banner */}
      {sourceMode === 'mic' && (
        <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3.5 text-xs text-cyan-200 flex items-center space-x-3 shadow-inner">
          <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30 shrink-0">
            <Mic className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <span className="text-cyan-300 font-bold block mb-0.5">Live Local Microphone Stream:</span>
            Capturing uncompressed <strong>16,000 Hz Mono 16-bit PCM</strong> audio in 3.0-second sliding windows for zero-latency neural classification.
          </div>
        </div>
      )}

      {/* File Upload Mode */}
      {sourceMode === 'file' && (
        <div className="space-y-2">
          <label className="flex items-center justify-center space-x-2 p-3.5 bg-slate-950/60 border border-dashed border-slate-700/80 hover:border-slate-600 rounded-xl cursor-pointer transition">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono text-slate-300">
              {uploadedFileName || 'Choose .wav or .mp3 voice file'}
            </span>
            <input
              type="file"
              accept="audio/wav, audio/mp3, audio/mpeg, audio/ogg"
              onChange={handleFileUpload}
              disabled={isStreaming}
              className="hidden"
            />
          </label>
          {uploadedChunks.length > 0 && (
            <p className="text-[11px] text-emerald-400 font-mono">
              ✓ Ready: {uploadedChunks.length} chunks ({(uploadedChunks.length * 3).toFixed(0)}s at 16kHz)
            </p>
          )}
        </div>
      )}

      {/* Call Context & Identity Form (Clean 2x2 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/50 rounded-xl border border-slate-800/80">
        {/* Target Profile */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Voiceprint</span>
          </label>
          <select
            value={selectedProfileId}
            onChange={(e) => onSelectProfileId(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {profiles.length === 0 ? (
              <option value="">No profiles enrolled yet</option>
            ) : (
              profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.personName} ({p.role || 'Executive'})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Intent */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Intent</span>
          </label>
          <select
            value={callType}
            onChange={(e) => setCallType(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="fund_transfer_approval">Fund Transfer Approval</option>
            <option value="wire_transfer">Wire Transfer</option>
            <option value="credential_reset">Admin Credential Reset</option>
            <option value="executive_instruction">Executive Instruction</option>
            <option value="vendor_invoice_approval">Vendor Invoice Approval</option>
            <option value="general_inquiry">General Inquiry</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Amount (₹ INR)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={isStreaming}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="e.g. 5000000"
          />
        </div>

        {/* Caller Number */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Caller ID
          </label>
          <input
            type="text"
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            disabled={isStreaming}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      {/* Waveform Visualizer */}
      <WaveformVisualizer
        analyserNode={audioCaptureEngine.analyserNode}
        isActive={isStreaming}
        rmsLevel={rmsLevel}
        chunkProgressSec={chunkProgressSec}
        mode={sourceMode === 'preset' ? 'scenario' : sourceMode}
        riskScore={currentRisk}
      />

      {/* Stream Metrics Strip */}
      <div className="grid grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-center font-mono">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-sans">Duration</div>
          <div className="text-xs font-semibold text-white mt-0.5">{streamDurationSec.toFixed(1)}s</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-sans">Chunks</div>
          <div className="text-xs font-semibold text-cyan-400 mt-0.5">#{chunksSentCount}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-sans">Sent</div>
          <div className="text-xs font-semibold text-slate-300 mt-0.5">{(totalBytesSent / 1024).toFixed(0)} KB</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-sans">Format</div>
          <div className="text-xs font-semibold text-emerald-400 mt-0.5">16k / 16b</div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div>
        {!isStreaming ? (
          <button
            type="button"
            onClick={handleStartCall}
            disabled={isStarting}
            className={`w-full py-3 px-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-rose-950/40 transition-all flex items-center justify-center space-x-2 text-xs tracking-wide cursor-pointer ${
              isStarting ? 'opacity-75 cursor-wait' : ''
            }`}
          >
            <Phone className={`w-4 h-4 ${isStarting ? 'animate-spin' : ''}`} />
            <span>{isStarting ? 'CONNECTING STREAM...' : 'START STREAM SIMULATION'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEndCall}
            className="w-full py-3 px-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-xs tracking-wide cursor-pointer animate-pulse"
          >
            <PhoneOff className="w-4 h-4" />
            <span>DISCONNECT STREAM</span>
          </button>
        )}
      </div>
    </div>
  );
};

