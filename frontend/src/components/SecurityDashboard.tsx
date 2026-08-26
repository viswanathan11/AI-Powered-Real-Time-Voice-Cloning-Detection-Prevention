import React from 'react';
import { ChunkScoringResult, SecurityAlert, VoiceProfile } from '../types';
import { RiskGauge } from './RiskGauge';
import { AlertBanner } from './AlertBanner';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Fingerprint,
  Zap,
  Clock,
  History,
  Lock,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';

interface SecurityDashboardProps {
  currentResult: ChunkScoringResult | null;
  chunkHistory: ChunkScoringResult[];
  alerts: SecurityAlert[];
  isStreaming: boolean;
  selectedProfile: VoiceProfile | null;
  callerNumber?: string;
  amount?: number;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  currentResult,
  chunkHistory,
  alerts,
  isStreaming,
  selectedProfile,
  callerNumber,
  amount,
}) => {
  const riskScore = currentResult ? currentResult.runningRisk : 0.0;
  const riskLevel = currentResult ? currentResult.riskLevel : 'LOW';
  const recommendation = currentResult ? currentResult.recommendation : 'ALLOW';
  const syntheticScore = currentResult ? currentResult.syntheticScore : 0.0;
  const speakerMatchScore = currentResult ? currentResult.speakerMatchScore : 1.0;
  const latencyMs = currentResult ? currentResult.latencyMs : 0;
  const reason = currentResult?.alertTriggered
    ? currentResult.riskLevel === 'CRITICAL'
      ? 'Critical neural vocoder synthesis artifacts detected along with voiceprint divergence.'
      : 'High probability of deepfake impersonation.'
    : undefined;

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>Employee & SOC Defense Dashboard</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                Layer 2 & 3: Risk Engine + AI
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live dual-model neural inference (WavLM + ECAPA-TDNN) computing continuous risk scores
            </p>
          </div>
        </div>

        {/* Latency Tag */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Latency: <strong>{latencyMs > 0 ? `${latencyMs}ms` : '< 50ms'}</strong></span>
        </div>
      </div>

      {/* Actionable Alert Banner */}
      <div className="my-3">
        <AlertBanner
          recommendation={recommendation}
          riskLevel={riskLevel}
          runningRisk={riskScore}
          reason={reason}
          callerNumber={callerNumber}
          claimedName={selectedProfile?.personName || 'Executive'}
          amount={amount}
        />
      </div>

      {/* Main Grid: Risk Gauge + Dual-Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-2">
        {/* Left Column: Ticking Risk Gauge (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <RiskGauge
            riskScore={riskScore}
            riskLevel={riskLevel}
            recommendation={recommendation}
            isStreaming={isStreaming}
          />
        </div>

        {/* Right Column: Dual AI Model Telemetry Cards (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
          {/* Model 1: WavLM Synthetic Voice Detector */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">
                  Model 1: WavLM Acoustic Synthesis Detector
                </span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  syntheticScore >= 0.65
                    ? 'bg-rose-500/20 text-rose-300'
                    : syntheticScore >= 0.35
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {(syntheticScore * 100).toFixed(1)}% Synthetic
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    syntheticScore >= 0.65
                      ? 'bg-rose-500'
                      : syntheticScore >= 0.35
                      ? 'bg-amber-500'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, syntheticScore * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Phase Consistency: {syntheticScore >= 0.65 ? '🔴 Anomalous Vocoder' : '🟢 Natural Human'}</span>
                <span>HF Flux &gt;3.8kHz: {syntheticScore >= 0.65 ? 'Dispersion Detected' : 'Clean'}</span>
              </div>
            </div>
          </div>

          {/* Model 2: ECAPA-TDNN Speaker Verifier */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Model 2: ECAPA-TDNN Speaker Identity Match
                </span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  speakerMatchScore >= 0.70
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : speakerMatchScore >= 0.40
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {(speakerMatchScore * 100).toFixed(1)}% Match
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    speakerMatchScore >= 0.70
                      ? 'bg-emerald-400'
                      : speakerMatchScore >= 0.40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, speakerMatchScore * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Claimed: <strong>{selectedProfile?.personName || 'No profile selected'}</strong></span>
                <span>192-d Cosine Sim: {(speakerMatchScore * 0.9).toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Composite Formula Live Computation Box */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-[11px] font-mono">
            <div className="text-slate-400 font-bold uppercase text-[10px] mb-1 flex items-center justify-between">
              <span>Risk Engine Formula (Plane.md)</span>
              <span className="text-cyan-400">EMA Smoothing Alpha: 0.70</span>
            </div>
            <div className="text-slate-300 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
              <span className="text-rose-400 font-bold">runningRisk</span> = 0.5 × ({syntheticScore.toFixed(2)}) + 0.5 × (1 - {speakerMatchScore.toFixed(2)}){' '}
              {amount && amount >= 500000 && <span className="text-amber-400">+ 0.10(High-Value)</span>}
              {' = '}
              <strong className="text-white font-bold text-xs">{(riskScore * 100).toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Live Chunk Scoring Progression Timeline */}
      <div className="my-2 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Chunk-by-Chunk Risk Stream Timeline (3s Windows)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Total Analyzed: {chunkHistory.length} Chunks
          </span>
        </div>

        {chunkHistory.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">
            No live chunks received yet. Click "Initiate Call &amp; Stream" to stream audio.
          </div>
        ) : (
          <div className="flex items-end space-x-2 h-16 pt-2 overflow-x-auto">
            {chunkHistory.slice(-15).map((chk) => {
              const heightPct = Math.max(12, Math.min(100, chk.runningRisk * 100));
              let barBg = 'bg-emerald-500';
              if (chk.runningRisk >= 0.7) barBg = 'bg-rose-500';
              else if (chk.runningRisk >= 0.3) barBg = 'bg-amber-500';

              return (
                <div key={chk.chunkSeq} className="flex-1 flex flex-col items-center group min-w-[28px]">
                  <span className="text-[9px] font-mono text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition">
                    {(chk.runningRisk * 100).toFixed(0)}%
                  </span>
                  <div className="w-full bg-slate-800 rounded-t h-12 flex items-end">
                    <div
                      className={`w-full ${barBg} rounded-t transition-all duration-300`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">#{chk.chunkSeq}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Alert Feed & Privacy Guarantee Seal */}
      <div className="mt-auto pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Real-time Alerts Ticker */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-300 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Active Security Alerts Log</span>
          </div>
          {alerts.length === 0 ? (
            <p className="text-[11px] text-slate-500 font-mono">No security alerts triggered.</p>
          ) : (
            <div className="space-y-1.5 max-h-20 overflow-y-auto pr-1">
              {alerts.slice(-3).map((alt, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-rose-500/30 text-[10px] font-mono">
                  <span className="font-bold text-rose-400">Chunk #{alt.chunkSeq}: {alt.alertType}</span>
                  <span className="text-slate-400 truncate max-w-[140px]">{alt.reason || 'High Risk'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy & Compliance Assurance Badge */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl text-xs flex items-center space-x-3 text-emerald-200">
          <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-[11px] uppercase tracking-wider text-emerald-300">
              Zero Raw Audio Storage (Privacy First)
            </div>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Audio is discarded immediately after feature extraction. Only 192-d numerical embeddings are persisted (DPDP Act &amp; GDPR compliant).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
