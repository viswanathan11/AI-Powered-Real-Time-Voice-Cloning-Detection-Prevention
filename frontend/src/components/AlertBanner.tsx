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
      <div className="w-full bg-emerald-950/40 border-2 border-emerald-500/50 rounded-xl p-4 shadow-lg flex items-center space-x-3 text-emerald-300">
        <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/30 font-bold tracking-wider uppercase text-emerald-200">
              CALL AUTHENTICATED
            </span>
            <span className="text-xs text-emerald-400/80 font-mono">Risk: {(runningRisk * 100).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-emerald-300/90 mt-1">
            Voiceprint matches enrolled genuine profile of <strong>{claimedName || 'Executive'}</strong>. No neural synthesis artifacts detected. Call may proceed normally.
          </p>
        </div>
      </div>
    );
  }

  if (recommendation === 'MONITOR' || riskLevel === 'MEDIUM') {
    return (
      <div className="w-full bg-amber-950/40 border-2 border-amber-500/60 rounded-xl p-4 shadow-lg flex items-center space-x-3 text-amber-300">
        <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
          <Eye className="w-6 h-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/30 font-bold tracking-wider uppercase text-amber-200">
              SUSPICIOUS: MONITOR
            </span>
            <span className="text-xs text-amber-400/80 font-mono">Risk: {(runningRisk * 100).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-amber-200/90 mt-1">
            Acoustic variance detected. Maintain heightened vigilance. {reason ? `(${reason})` : 'Verify transaction details before proceeding.'}
          </p>
        </div>
      </div>
    );
  }

  if (recommendation === 'VERIFY_CALLBACK' || riskLevel === 'HIGH') {
    return (
      <div className="w-full bg-rose-950/70 border-2 border-rose-500 rounded-xl p-4 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-rose-100 animate-pulse">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-rose-600/30 rounded-xl shrink-0 border border-rose-500/50">
            <PhoneCall className="w-7 h-7 text-rose-300 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 rounded bg-rose-600 font-extrabold tracking-wider uppercase text-white">
                ACTION REQUIRED: VERIFY CALLBACK
              </span>
              <span className="text-xs font-mono font-bold text-rose-300">Risk: {(runningRisk * 100).toFixed(1)}%</span>
            </div>
            <p className="text-sm font-semibold text-white mt-1">
              DO NOT APPROVE {amount ? `₹${amount.toLocaleString('en-IN')}` : 'TRANSACTION'}! High Voice Clone Likelihood!
            </p>
            <p className="text-xs text-rose-200/90 mt-0.5">
              {reason || 'Acoustic vocoder artifacts detected along with voiceprint mismatch.'} Immediately hang up and call back <strong>{claimedName || 'the Executive'}</strong> on their verified internal telecom extension.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center space-x-2 self-end md:self-center">
          <a
            href={`tel:${callerNumber || ''}`}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center space-x-1.5"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Back Verified Number</span>
          </a>
        </div>
      </div>
    );
  }

  // ESCALATE / CRITICAL
  return (
    <div className="w-full bg-red-950 border-2 border-red-500 rounded-xl p-4 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-red-100 ring-4 ring-red-500/30 animate-pulse">
      <div className="flex items-start space-x-3">
        <div className="p-2.5 bg-red-600 rounded-xl shrink-0">
          <AlertOctagon className="w-7 h-7 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2.5 py-0.5 rounded bg-white text-red-900 font-black tracking-widest uppercase">
              SECURITY LOCKDOWN: ESCALATE
            </span>
            <span className="text-xs font-mono font-black text-red-200">Risk: {(runningRisk * 100).toFixed(1)}%</span>
          </div>
          <p className="text-sm font-extrabold text-white mt-1">
            CRITICAL FRAUD ATTACK: AI SYNTHESIZED VOICE DETECTED!
          </p>
          <p className="text-xs text-red-200 mt-0.5">
            {reason || 'Severe neural vocoder artifact concentration and complete speaker mismatch.'} Session frozen. Alert transmitted to Bank Fraud SOC.
          </p>
        </div>
      </div>

      <div className="shrink-0 flex items-center space-x-2 self-end md:self-center">
        <button
          onClick={() => alert('Fraud Incident Ticket created! Session ID flagged and dispatched to SOC Incident Response.')}
          className="px-4 py-2 bg-white text-red-900 hover:bg-red-100 font-extrabold text-xs rounded-lg shadow-lg transition flex items-center space-x-1.5"
        >
          <ShieldAlert className="w-4 h-4 text-red-700" />
          <span>Dispatch SOC Ticket</span>
        </button>
      </div>
    </div>
  );
};
