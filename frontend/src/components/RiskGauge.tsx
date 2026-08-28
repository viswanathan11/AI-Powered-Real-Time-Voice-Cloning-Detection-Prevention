import React from 'react';
import { RiskLevel, Recommendation } from '../types';
import { ShieldCheck, AlertTriangle, Flame, ShieldAlert } from 'lucide-react';

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
  const radius = (size - strokeWidth) / 2; // 102
  const center = size / 2; // 110
  const arcLength = Math.PI * radius; // ~320.4
  const strokeDashoffset = arcLength * (1 - clampedScore);
  
  // Needle drawn pointing UP (12 o'clock): -90 deg is Left (0%), 0 deg is Top (50%), +90 deg is Right (100%)
  const needleAngle = -90 + clampedScore * 180;

  let statusColor = '#10B981'; // Emerald Green
  let statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
  let glowColor = 'rgba(16, 185, 129, 0.35)';
  let statusIcon = <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />;
  let statusLabel = 'Authentic / Low Risk';

  if (clampedScore >= 0.7 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    statusColor = '#EF4444'; // Red
    statusBg = 'bg-rose-500/15 border-rose-500/30 text-rose-300';
    glowColor = 'rgba(239, 68, 68, 0.45)';
    statusIcon = <Flame className="w-4 h-4 text-rose-400 shrink-0" />;
    statusLabel = 'Critical: High Risk Attack';
  } else if (clampedScore >= 0.3 || riskLevel === 'MEDIUM') {
    statusColor = '#F59E0B'; // Amber
    statusBg = 'bg-amber-500/15 border-amber-500/30 text-amber-300';
    glowColor = 'rgba(245, 158, 11, 0.35)';
    statusIcon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    statusLabel = 'Suspicious: Monitor Call';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl relative overflow-hidden shadow-xl backdrop-blur-md">
      {/* Background radial ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none filter blur-3xl transition-all duration-700 opacity-40"
        style={{ backgroundColor: glowColor }}
      />

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-1 z-10">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          Impersonation Risk Index
        </span>
        {isStreaming ? (
          <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>STREAMING</span>
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800/80 text-slate-400 border border-slate-700/60">
            IDLE
          </span>
        )}
      </div>

      {/* SVG Arc Speedometer */}
      <div className="relative flex items-center justify-center my-2">
        <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`} className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradientClean" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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
            filter="url(#gaugeGlow)"
          />

          {/* Needle Indicator - Drawn pointing UP at 12 o'clock, rotated around (center, center) */}
          <g
            transform={`rotate(${needleAngle}, ${center}, ${center})`}
            className="transition-transform duration-500 ease-out"
          >
            {/* Needle Body */}
            <polygon
              points={`${center - 4},${center} ${center},${center - radius + 12} ${center + 4},${center}`}
              fill={statusColor}
              filter="drop-shadow(0 0 4px rgba(0,0,0,0.8))"
            />
            {/* Pivot Center Cap */}
            <circle cx={center} cy={center} r="7" fill="#090e1a" stroke={statusColor} strokeWidth="3" />
          </g>
        </svg>

        {/* Central Numeric Score Display */}
        <div className="absolute top-[72px] flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-4xl font-extrabold font-mono tracking-tight transition-colors duration-300"
            style={{ color: statusColor, textShadow: `0 0 16px ${glowColor}` }}
          >
            {percentage}%
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
            Running Risk
          </span>
        </div>
      </div>

      {/* Threshold Guide */}
      <div className="w-full flex justify-between px-3 text-[10px] font-mono text-slate-400 -mt-1 mb-3">
        <span className="text-emerald-400 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          0% Safe
        </span>
        <span className="text-amber-400 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          30% Monitor
        </span>
        <span className="text-rose-400 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          70% Critical
        </span>
      </div>

      {/* Status & Recommendation Card */}
      <div className={`w-full flex items-center justify-between p-2.5 rounded-xl border ${statusBg} transition-all duration-300 shadow-sm`}>
        <div className="flex items-center space-x-2">
          {statusIcon}
          <div className="text-xs font-bold tracking-wide">{statusLabel}</div>
        </div>
        <div>
          <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-950/80 border border-white/10 text-white tracking-wider">
            {recommendation}
          </span>
        </div>
      </div>
    </div>
  );
};

