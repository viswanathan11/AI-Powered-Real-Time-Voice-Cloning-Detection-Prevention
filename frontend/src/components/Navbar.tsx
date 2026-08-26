import React from 'react';
import { SystemHealth } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Radio,
  Fingerprint,
  History,
  Layers,
  Sparkles,
  Server,
  Cpu,
} from 'lucide-react';

export type ActiveTab = 'defense' | 'enrollment' | 'history' | 'architecture';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  systemHealth: SystemHealth | null;
  isStreaming: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  systemHealth,
  isStreaming,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 border-b border-slate-800 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-tight text-white font-sans">
                  VoiceShield <span className="text-cyan-400">AI</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
                  SIH26104
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Real-Time Voice Cloning Detection &amp; Executive Impersonation Defense
              </p>
            </div>
          </div>

          {/* Navigation View Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onTabChange('defense')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'defense'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-rose-400 animate-pulse' : ''}`} />
              <span>Split-Screen Defense</span>
              {isStreaming && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping ml-1" />
              )}
            </button>

            <button
              onClick={() => onTabChange('enrollment')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'enrollment'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Voiceprint Vault</span>
            </button>

            <button
              onClick={() => onTabChange('history')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </button>

            <button
              onClick={() => onTabChange('architecture')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'architecture'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">3-Layer Stack</span>
            </button>
          </nav>

          {/* System Health Status Badges */}
          <div className="hidden lg:flex items-center space-x-2 text-[10px] font-mono">
            {systemHealth ? (
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-bold">FastAPI Backend</span>
                <span className="text-slate-500">|</span>
                <span className="text-cyan-300">WavLM + ECAPA</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-lg text-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span>Backend Connecting...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
