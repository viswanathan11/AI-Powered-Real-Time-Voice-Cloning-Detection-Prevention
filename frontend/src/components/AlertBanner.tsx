import React from 'react';
import { Recommendation, RiskLevel } from '../types';
import { PhoneCall, AlertOctagon, CheckCircle2, Eye, ShieldAlert } from 'lucide-react';

interface AlertBannerProps {
  recommendation: Recommendation;
  riskLevel: RiskLevel;
  runningRisk: number;
  reason?: string;
  callerNumber?: string;
  claimedName?: string;
  amount?: number;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  recommendation,
  riskLevel,
  runningRisk,
  reason,
  callerNumber,
  claimedName,
  amount,
}) => {
  if (recommendation === 'ALLOW' || riskLevel === 'LOW') {
    return (
      <div className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between text-emerald-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/15 rounded-lg shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                Call Authenticated
              </span>
              <span className="text-[11px] text-emerald-400/70 font-mono">
                • Risk: {(runningRisk * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Voiceprint verified for <strong>{claimedName || 'Executive'}</strong>. No neural synthesis artifacts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (recommendation === 'MONITOR' || riskLevel === 'MEDIUM') {
    return (
      <div className="w-full bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between text-amber-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/15 rounded-lg shrink-0">
            <Eye className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
                Suspicious: Monitor
              </span>
              <span className="text-[11px] text-amber-400/70 font-mono">
                • Risk: {(runningRisk * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Acoustic variance detected. {reason ? reason : 'Verify transaction details before proceeding.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (recommendation === 'VERIFY_CALLBACK' || riskLevel === 'HIGH') {
    return (
      <div className="w-full bg-rose-950/40 border border-rose-500/50 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-100 animate-fadeIn">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-500/20 rounded-lg shrink-0 text-rose-400">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-rose-300">
                Action Required: Verify Callback
              </span>
              <span className="text-[11px] text-rose-400/80 font-mono font-bold">
                • Risk: {(runningRisk * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5">
              Voiceprint divergence for <strong>{claimedName || 'Executive'}</strong>{amount ? ` on ₹${amount.toLocaleString('en-IN')} transfer` : ''}. {reason || 'Caller biometric features do not match the registered profile.'}
            </p>
          </div>
        </div>

        <a
          href={`tel:${callerNumber || ''}`}
          className="shrink-0 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center space-x-1.5 self-end sm:self-center"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Call Back Verified Number</span>
        </a>
      </div>
    );
  }

  // ESCALATE / CRITICAL
  return (
    <div className="w-full bg-red-950/60 border border-red-500/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-100 animate-fadeIn">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-red-600/30 rounded-lg shrink-0 text-red-400">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-red-300">
              Security Lockdown: Escalate
            </span>
            <span className="text-[11px] text-red-400 font-mono font-bold">
              • Risk: {(runningRisk * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-200 mt-0.5">
            {reason || 'Critical AI voice clone synthesis detected.'} Session flagged to SOC.
          </p>
        </div>
      </div>

      <button
        onClick={() => alert('SOC Incident Ticket dispatched!')}
        className="shrink-0 px-3.5 py-1.5 bg-white text-red-900 hover:bg-slate-100 font-bold text-xs rounded-lg shadow transition flex items-center space-x-1.5 self-end sm:self-center cursor-pointer"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-red-700" />
        <span>Dispatch SOC Ticket</span>
      </button>
    </div>
  );
};

