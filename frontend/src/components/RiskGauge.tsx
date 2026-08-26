import React from 'react';
import { RiskLevel, Recommendation } from '../types';
import { ShieldCheck, ShieldAlert, AlertTriangle, Flame } from 'lucide-react';

interface RiskGaugeProps {
  riskScore: number; // 0.0 to 1.0
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  isStreaming?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  riskScore,
  riskLevel,
  recommendation,
  isStreaming = false,
}) => {
  const clampedScore = Math.max(0, Math.min(1, riskScore));
  const percentage = Math.round(clampedScore * 100);

  // SVG Gauge Arc Geometry
  const size = 220;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - clampedScore);
  const needleAngle = -180 + clampedScore * 180;

  let statusColor = '#10B981'; // Green
  let statusBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  let glowColor = 'rgba(16, 185, 129, 0.3)';
  let statusIcon = <ShieldCheck className="w-4 h-4 text-emerald-400" />;
  let statusLabel = 'Safe / Genuine';

  if (clampedScore >= 0.7 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    statusColor = '#EF4444'; // Red
    statusBg = 'bg-rose-500/15 border-rose-500/30 text-rose-400';
    glowColor = 'rgba(239, 68, 68, 0.4)';
    statusIcon = <Flame className="w-4 h-4 text-rose-400" />;
    statusLabel = 'Critical Risk: Clone';
  } else if (clampedScore >= 0.3 || riskLevel === 'MEDIUM') {
    statusColor = '#F59E0B'; // Amber
    statusBg = 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    glowColor = 'rgba(245, 158, 11, 0.3)';
    statusIcon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
    statusLabel = 'Suspicious: Monitor';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl relative overflow-hidden">
      {/* Background subtle glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full pointer-events-none filter blur-3xl transition-all duration-700 opacity-30"
        style={{ backgroundColor: glowColor }}
      />

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-1 z-10">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Risk Score
        </span>
        {isStreaming && (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>LIVE</span>
          </span>
        )}
      </div>

      {/* SVG Arc Speedometer */}
      <div className="relative flex items-center justify-center my-1">
        <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradientClean" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${strokeWidth / 2},${center} A ${radius},${radius} 0 0,1 ${size - strokeWidth / 2},${center}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Colored Progress Arc */}
          <path
            d={`M ${strokeWidth / 2},${center} A ${radius},${radius} 0 0,1 ${size - strokeWidth / 2},${center}`}
            fill="none"
            stroke="url(#gaugeGradientClean)"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />

          {/* Needle Indicator */}
          <g
            transform={`rotate(${needleAngle}, ${center}, ${center})`}
            className="transition-transform duration-500 ease-out"
          >
            <polygon
              points={`${center},${center - 4} ${center - radius + 12},${center} ${center},${center + 4}`}
              fill={statusColor}
            />
            <circle cx={center} cy={center} r="7" fill="#0b1120" stroke={statusColor} strokeWidth="2.5" />
          </g>
        </svg>

        {/* Central Numeric Score */}
        <div className="absolute top-20 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-3xl font-extrabold font-mono tracking-tight transition-colors duration-300"
            style={{ color: statusColor }}
          >
            {percentage}%
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Impersonation Risk
          </span>
        </div>
      </div>

      {/* Threshold Guide */}
      <div className="w-full flex justify-between px-2 text-[10px] font-mono text-slate-500 -mt-1 mb-2.5">
        <span className="text-emerald-400/80">0.0 Safe</span>
        <span className="text-amber-400/80">0.3 Monitor</span>
        <span className="text-rose-400/80">0.7 Critical</span>
      </div>

      {/* Status & Recommendation Card */}
      <div className={`w-full flex items-center justify-between p-2.5 rounded-lg border ${statusBg} transition-all duration-300`}>
        <div className="flex items-center space-x-2">
          {statusIcon}
          <div className="text-xs font-semibold">{statusLabel}</div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/60 border border-white/10">
            {recommendation}
          </span>
        </div>
      </div>
    </div>
  );
};

