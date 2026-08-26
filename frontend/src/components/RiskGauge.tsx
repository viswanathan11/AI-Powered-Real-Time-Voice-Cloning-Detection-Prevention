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
  // Clamp risk score to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, riskScore));
  const percentage = Math.round(clampedScore * 100);

  // SVG Gauge Arc Geometry
  const size = 280;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  // Semi-circle from -180 deg (left) to 0 deg (right) = 180 degrees total
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - clampedScore);

  // Needle angle: -180 deg (0% risk) to 0 deg (100% risk)
  const needleAngle = -180 + clampedScore * 180;

  // Dynamic Theme Colors based on Task List:
  // 0.0 - 0.3: GREEN (Safe)
  // 0.3 - 0.7: YELLOW (Monitor)
  // 0.7 - 1.0: RED (Critical Risk - Likely Voice Clone)
  let statusColor = '#10B981'; // Green
  let statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  let glowColor = 'rgba(16, 185, 129, 0.4)';
  let statusIcon = <ShieldCheck className="w-5 h-5 text-emerald-400" />;
  let statusLabel = 'SAFE / GENUINE';

  if (clampedScore >= 0.7 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    statusColor = '#EF4444'; // Red
    statusBg = 'bg-rose-500/15 border-rose-500/40 text-rose-400';
    glowColor = 'rgba(239, 68, 68, 0.5)';
    statusIcon = <Flame className="w-5 h-5 text-rose-400 animate-pulse" />;
    statusLabel = 'CRITICAL RISK: CLONE';
  } else if (clampedScore >= 0.3 || riskLevel === 'MEDIUM') {
    statusColor = '#F59E0B'; // Yellow / Amber
    statusBg = 'bg-amber-500/15 border-amber-500/40 text-amber-400';
    glowColor = 'rgba(245, 158, 11, 0.4)';
    statusIcon = <AlertTriangle className="w-5 h-5 text-amber-400" />;
    statusLabel = 'MONITOR / SUSPICIOUS';
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none filter blur-3xl transition-all duration-700 opacity-40"
        style={{ backgroundColor: glowColor }}
      />

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-2 z-10">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Real-Time Risk Scoring Engine
          </span>
        </div>
        {isStreaming && (
          <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>LIVE SCORING</span>
          </span>
        )}
      </div>

      {/* SVG Radial Speedometer Gauge */}
      <div className="relative flex items-center justify-center my-2">
        <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`} className="overflow-visible">
          <defs>
            {/* Multi-stop gradient along the gauge */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />   {/* Green: Safe */}
              <stop offset="35%" stopColor="#34D399" />
              <stop offset="55%" stopColor="#FBBF24" />  {/* Yellow: Monitor */}
              <stop offset="75%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#EF4444" /> {/* Red: Critical */}
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${strokeWidth / 2},${center} A ${radius},${radius} 0 0,1 ${size - strokeWidth / 2},${center}`}
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Colored Progress Arc */}
          <path
            d={`M ${strokeWidth / 2},${center} A ${radius},${radius} 0 0,1 ${size - strokeWidth / 2},${center}`}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            className="transition-all duration-500 ease-out"
          />

          {/* Threshold Tick Marks: 0.3 (Safe/Monitor boundary) and 0.7 (Monitor/Critical boundary) */}
          {/* Tick at 30% */}
          {(() => {
            const angle30 = (-180 + 0.3 * 180) * (Math.PI / 180);
            const x1 = center + (radius - 16) * Math.cos(angle30);
            const y1 = center + (radius - 16) * Math.sin(angle30);
            const x2 = center + (radius + 16) * Math.cos(angle30);
            const y2 = center + (radius + 16) * Math.sin(angle30);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748B" strokeWidth="2" strokeDasharray="2,2" />;
          })()}

          {/* Tick at 70% */}
          {(() => {
            const angle70 = (-180 + 0.7 * 180) * (Math.PI / 180);
            const x1 = center + (radius - 16) * Math.cos(angle70);
            const y1 = center + (radius - 16) * Math.sin(angle70);
            const x2 = center + (radius + 16) * Math.cos(angle70);
            const y2 = center + (radius + 16) * Math.sin(angle70);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748B" strokeWidth="2" strokeDasharray="2,2" />;
          })()}

          {/* Needle Indicator */}
          <g
            transform={`rotate(${needleAngle}, ${center}, ${center})`}
            className="transition-transform duration-500 ease-out"
          >
            <polygon
              points={`${center},${center - 6} ${center - radius + 15},${center} ${center},${center + 6}`}
              fill={statusColor}
              filter="drop-shadow(0 0 4px rgba(0,0,0,0.8))"
            />
            <circle cx={center} cy={center} r="10" fill="#0F172A" stroke={statusColor} strokeWidth="3" />
            <circle cx={center} cy={center} r="4" fill={statusColor} />
          </g>
        </svg>

        {/* Central Numeric Score Display */}
        <div className="absolute top-28 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-4xl font-extrabold tracking-tight font-mono transition-colors duration-300"
            style={{ color: statusColor, textShadow: `0 0 20px ${glowColor}` }}
          >
            {percentage}%
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
            Impersonation Risk
          </span>
        </div>
      </div>

      {/* Threshold Zone Labels */}
      <div className="w-full flex justify-between px-3 text-[10px] font-mono text-slate-500 -mt-2 mb-3">
        <span className="text-emerald-400/80">0.0 SAFE</span>
        <span className="text-amber-400/80">0.3 MONITOR</span>
        <span className="text-rose-400/80">0.7 CRITICAL</span>
        <span className="text-rose-500">1.0</span>
      </div>

      {/* Status & Recommendation Card */}
      <div className={`w-full flex items-center justify-between p-3 rounded-xl border ${statusBg} transition-all duration-300`}>
        <div className="flex items-center space-x-2">
          {statusIcon}
          <div>
            <div className="text-xs font-bold uppercase">{statusLabel}</div>
            <div className="text-[10px] opacity-80">
              {riskLevel === 'CRITICAL' && 'High synthesis artifacts & voice mismatch'}
              {riskLevel === 'HIGH' && 'Voiceprint divergence detected'}
              {riskLevel === 'MEDIUM' && 'Acoustic anomalies present'}
              {riskLevel === 'LOW' && 'Acoustic spectrum verified authentic'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider block opacity-70">Protocol</span>
          <span className="text-xs font-mono font-bold tracking-wider">
            {recommendation}
          </span>
        </div>
      </div>
    </div>
  );
};
