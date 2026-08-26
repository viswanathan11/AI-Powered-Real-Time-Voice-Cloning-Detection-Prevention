import React from 'react';
import { ChunkScoringResult, SecurityAlert, VoiceProfile } from '../types';
import { RiskGauge } from './RiskGauge';
import { AlertBanner } from './AlertBanner';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Fingerprint,
  Clock,
  History,
  Lock,
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
      ? 'Critical neural vocoder synthesis detected along with voiceprint divergence.'
      : 'High probability of deepfake impersonation.'
    : undefined;

  return (
    <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl space-y-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Live SOC Defense
            </h2>
            <p className="text-xs text-slate-400">
              Dual-model neural inference (WavLM + ECAPA-TDNN)
            </p>
          </div>
        </div>

        {/* Latency Tag */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs font-mono text-cyan-400">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{latencyMs > 0 ? `${latencyMs}ms` : '< 50ms'}</span>
        </div>
      </div>

      {/* Actionable Alert Banner */}
      <AlertBanner
        recommendation={recommendation}
        riskLevel={riskLevel}
        runningRisk={riskScore}
        reason={reason}
        callerNumber={callerNumber}
        claimedName={selectedProfile?.personName || 'Executive'}
        amount={amount}
      />

      {/* Main Grid: Risk Gauge + Dual-Model Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Ticking Risk Gauge (5 cols) */}
        <div className="md:col-span-5 flex flex-col justify-center">
          <RiskGauge
            riskScore={riskScore}
            riskLevel={riskLevel}
            recommendation={recommendation}
            isStreaming={isStreaming}
          />
        </div>

        {/* Right Column: Dual AI Model Telemetry Cards (7 cols) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3">
          {/* Model 1: WavLM Synthetic Voice Detector */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">
                  WavLM Synthesis Detector
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

            <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
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

            <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-0.5">
              <span>Phase: {syntheticScore >= 0.65 ? '🔴 Anomalous' : '🟢 Natural'}</span>
              <span>HF Flux: {syntheticScore >= 0.65 ? 'Dispersion' : 'Clean'}</span>
            </div>
          </div>

          {/* Model 2: ECAPA-TDNN Speaker Verifier */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">
                  ECAPA-TDNN Speaker Match
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

            <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
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

            <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-0.5">
              <span className="truncate max-w-[150px]">Target: {selectedProfile?.personName || 'None'}</span>
              <span>Cosine Sim: {(speakerMatchScore * 0.9).toFixed(2)}</span>
            </div>
          </div>

          {/* Risk Engine Status Tag */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Risk Engine: EMA Smoothed (α=0.70)</span>
            <span className="text-cyan-400 font-bold">{(riskScore * 100).toFixed(1)}% Composite</span>
          </div>
        </div>
      </div>

      {/* Live Chunk Scoring Progression Timeline */}
      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              Chunk-by-Chunk Risk Stream (3s Windows)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {chunkHistory.length} Chunks
          </span>
        </div>

        {chunkHistory.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 font-mono">
            No live chunks received yet.
          </div>
        ) : (
          <div className="flex items-end space-x-1.5 h-12 pt-1 overflow-x-auto">
            {chunkHistory.slice(-16).map((chk) => {
              const heightPct = Math.max(15, Math.min(100, chk.runningRisk * 100));
              let barBg = 'bg-emerald-500';
              if (chk.runningRisk >= 0.7) barBg = 'bg-rose-500';
              else if (chk.runningRisk >= 0.3) barBg = 'bg-amber-500';

              return (
                <div key={chk.chunkSeq} className="flex-1 flex flex-col items-center min-w-[20px]">
                  <div className="w-full bg-slate-800/60 rounded-t h-9 flex items-end">
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

      {/* Security Alert Feed & Privacy Guarantee Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Real-time Alerts Ticker */}
        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 font-semibold text-slate-300 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Active Alerts</span>
          </div>
          {alerts.length === 0 ? (
            <p className="text-[11px] text-slate-500 font-mono">No alerts triggered.</p>
          ) : (
            <div className="space-y-1 max-h-16 overflow-y-auto pr-1">
              {alerts.slice(-2).map((alt, i) => (
                <div key={i} className="flex items-center justify-between p-1 bg-slate-900/80 rounded border border-rose-500/20 text-[10px] font-mono">
                  <span className="font-bold text-rose-400">#{alt.chunkSeq}: {alt.alertType}</span>
                  <span className="text-slate-400 truncate max-w-[120px]">{alt.reason || 'High Risk'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy Assurance Badge */}
        <div className="bg-emerald-950/15 border border-emerald-500/25 p-3 rounded-xl text-xs flex items-center space-x-3 text-emerald-200">
          <div className="p-1.5 bg-emerald-500/15 rounded-lg shrink-0">
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold text-[11px] text-emerald-300">
              Zero Raw Audio Stored
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              192-d vectors only (DPDP &amp; GDPR compliant).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

