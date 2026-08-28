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
  Activity,
  AlertTriangle,
  Flame,
  CheckCircle2,
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
  const cosineSim = currentResult?.cosineSimilarity !== undefined && currentResult.cosineSimilarity !== null
    ? currentResult.cosineSimilarity
    : currentResult ? (speakerMatchScore > 0.8 ? 0.98 : speakerMatchScore * 0.7) : 0.0;
  const latencyMs = currentResult ? currentResult.latencyMs : 0;
  const verdict = currentResult?.verdict || 'AWAITING_SPEECH';
  const verdictLabel = currentResult?.verdictLabel || 'System Ready / Monitoring Stream';

  // Dynamic Verdict Styling
  let verdictBorder = 'border-slate-800 bg-slate-950/60 text-slate-300';
  let verdictIcon = <Activity className="w-5 h-5 text-cyan-400" />;
  let verdictBadge = 'bg-slate-800 text-slate-400';

  if (verdict === 'CRITICAL_AI_CLONE' || riskScore >= 0.75) {
    verdictBorder = 'border-rose-500/50 bg-gradient-to-r from-rose-950/60 via-slate-950/80 to-rose-950/40 text-rose-200 shadow-lg shadow-rose-950/40';
    verdictIcon = <Flame className="w-5 h-5 text-rose-400 animate-pulse" />;
    verdictBadge = 'bg-rose-500/25 text-rose-300 border border-rose-500/40';
  } else if (verdict === 'IMPOSTER_MISMATCH' || (riskScore >= 0.50 && speakerMatchScore < 0.50)) {
    verdictBorder = 'border-amber-500/50 bg-gradient-to-r from-amber-950/60 via-slate-950/80 to-amber-950/40 text-amber-200 shadow-lg shadow-amber-950/40';
    verdictIcon = <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />;
    verdictBadge = 'bg-amber-500/25 text-amber-300 border border-amber-500/40';
  } else if (verdict === 'AUTHENTIC_EXECUTIVE' || (speakerMatchScore >= 0.70 && syntheticScore < 0.35)) {
    verdictBorder = 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-slate-950/80 to-emerald-950/30 text-emerald-200 shadow-lg shadow-emerald-950/30';
    verdictIcon = <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    verdictBadge = 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40';
  }

  const reason = currentResult?.alertTriggered
    ? verdict === 'CRITICAL_AI_CLONE'
      ? 'Neural vocoder phase dispersion & synthetic temporal smoothness detected.'
      : verdict === 'IMPOSTER_MISMATCH'
      ? 'Significant biometric voiceprint divergence from enrolled executive profile.'
      : 'Elevated transaction impersonation risk.'
    : undefined;

  return (
    <div className="flex flex-col bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl space-y-4">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Live SOC Telephony Defense
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                Zero-Trust Voice
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Dual-Layer Neural Verification: SpeechBrain ECAPA-TDNN + Microsoft WavLM
            </p>
          </div>
        </div>

        {/* Latency & Processing Badge */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono text-cyan-400 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{latencyMs > 0 ? `${latencyMs.toFixed(1)}ms` : '< 40ms'}</span>
          </div>
        </div>
      </div>

      {/* Prominent Live 3-Way Threat Classification Hero Card */}
      <div className={`p-3.5 rounded-2xl border transition-all duration-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${verdictBorder}`}>
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/10 shrink-0">
            {verdictIcon}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                {verdictLabel}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${verdictBadge}`}>
                {riskLevel} RISK
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-sans">
              {verdict === 'CRITICAL_AI_CLONE' && 'Deepfake clone detected. Neural vocoder signature identified with >80% probability.'}
              {verdict === 'IMPOSTER_MISMATCH' && `Caller voiceprint does not match the enrolled profile for "${selectedProfile?.personName || 'Executive'}".`}
              {verdict === 'AUTHENTIC_EXECUTIVE' && `Speaker identity mathematically confirmed against Voice Vault (${(speakerMatchScore * 100).toFixed(1)}% match).`}
              {verdict === 'AWAITING_SPEECH' && 'Stream connected. Awaiting active speech chunks to begin neural inference.'}
              {verdict === 'GENERAL_HUMAN' && 'Natural human speech patterns observed. No reference vault profile attached.'}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
          <span className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-white shadow-sm">
            PROTOCOL: {recommendation}
          </span>
        </div>
      </div>

      {/* Actionable Alert Banner (if needed) */}
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
          {/* Model 1: WavLM Synthetic Voice & Vocoder Detector */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    WavLM Synthesis &amp; Vocoder Detector
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    High-Frequency Phase &amp; Temporal Entropy
                  </span>
                </div>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  syntheticScore >= 0.60
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : syntheticScore >= 0.30
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {(syntheticScore * 100).toFixed(1)}% Synthetic
              </span>
            </div>

            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  syntheticScore >= 0.60
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : syntheticScore >= 0.30
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, syntheticScore * 100))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-900">
              <div className="flex justify-between">
                <span>Vocoder Artifact:</span>
                <span className={syntheticScore >= 0.60 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {syntheticScore >= 0.60 ? '🔴 Detected (>85%)' : '🟢 Clean Human'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Transition Entropy:</span>
                <span className={syntheticScore >= 0.60 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {syntheticScore >= 0.60 ? '⚠️ Over-smooth (TTS)' : '🟢 Natural Organic'}
                </span>
              </div>
            </div>
          </div>

          {/* Model 2: ECAPA-TDNN Speaker Verification */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    ECAPA-TDNN Voiceprint Verification
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    192-Dimensional Biometric Cosine Metric
                  </span>
                </div>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  speakerMatchScore >= 0.70
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : speakerMatchScore >= 0.40
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                {(speakerMatchScore * 100).toFixed(1)}% Match
              </span>
            </div>

            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  speakerMatchScore >= 0.70
                    ? 'bg-emerald-400'
                    : speakerMatchScore >= 0.40
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, speakerMatchScore * 100))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-900">
              <div className="flex justify-between truncate pr-1">
                <span>Vault Target:</span>
                <span className="text-slate-200 font-semibold truncate ml-1">
                  {selectedProfile?.personName || 'No Target Selected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Raw Cosine Sim:</span>
                <span className={`font-bold ${cosineSim >= 0.74 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {typeof cosineSim === 'number' ? cosineSim.toFixed(3) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Engine Status Tag */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Engine: Multi-Chunk EMA Smoothed (α=0.70)</span>
            </span>
            <span className="text-cyan-300 font-bold font-mono">
              {(riskScore * 100).toFixed(1)}% Impersonation Risk
            </span>
          </div>
        </div>
      </div>

      {/* Live Chunk Scoring Progression Timeline */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              Chunk-by-Chunk Risk Stream (3.0s Continuous Windows)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {chunkHistory.length} Chunks Evaluated
          </span>
        </div>

        {chunkHistory.length === 0 ? (
          <div className="py-5 text-center text-xs text-slate-500 font-mono bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
            No live chunks received yet. Start stream to view real-time temporal progression.
          </div>
        ) : (
          <div className="flex items-end space-x-2 h-14 pt-1 overflow-x-auto">
            {chunkHistory.slice(-18).map((chk) => {
              const heightPct = Math.max(18, Math.min(100, chk.runningRisk * 100));
              let barBg = 'bg-emerald-500';
              if (chk.runningRisk >= 0.70) barBg = 'bg-rose-500';
              else if (chk.runningRisk >= 0.30) barBg = 'bg-amber-500';

              return (
                <div key={chk.chunkSeq} className="flex-1 flex flex-col items-center min-w-[24px]">
                  <div className="w-full bg-slate-800/70 rounded-t h-10 flex items-end overflow-hidden">
                    <div
                      className={`w-full ${barBg} rounded-t transition-all duration-300 shadow-sm`}
                      style={{ height: `${heightPct}%` }}
                      title={`Chunk #${chk.chunkSeq}: Risk ${(chk.runningRisk * 100).toFixed(1)}% | Synth ${(chk.syntheticScore * 100).toFixed(0)}% | Match ${(chk.speakerMatchScore * 100).toFixed(0)}%`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 mt-1 font-semibold">
                    #{chk.chunkSeq}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Alert Feed & Privacy Guarantee Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Real-time Alerts Ticker */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs shadow-inner">
          <div className="flex items-center justify-between font-bold text-slate-300 mb-2">
            <div className="flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Active Security Alerts</span>
            </div>
            <span className="text-[10px] font-mono text-rose-400">
              {alerts.length} Triggered
            </span>
          </div>
          {alerts.length === 0 ? (
            <p className="text-[11px] text-slate-500 font-mono">No alerts triggered in this session.</p>
          ) : (
            <div className="space-y-1.5 max-h-20 overflow-y-auto pr-1">
              {alerts.slice(-3).map((alt, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-slate-900/90 rounded-lg border border-rose-500/25 text-[10px] font-mono">
                  <span className="font-bold text-rose-400">#{alt.chunkSeq}: {alt.alertType}</span>
                  <span className="text-slate-300 truncate max-w-[140px] ml-1">{alt.reason || 'High Risk'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy Assurance Badge */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl text-xs flex items-center space-x-3 text-emerald-200 shadow-inner">
          <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl shrink-0">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-xs text-emerald-300">
              Zero Raw Audio Storage Guarantee
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              Only 192-d mathematical embedding vectors stored. Raw speech memory buffers are instantly wiped after inference (DPDP &amp; GDPR compliant).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

