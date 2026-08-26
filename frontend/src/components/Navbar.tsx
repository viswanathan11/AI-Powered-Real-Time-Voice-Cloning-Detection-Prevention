import React from 'react';
import { SystemHealth } from '../types';
import {
  ShieldCheck,
  Radio,
  Fingerprint,
  History,
  Layers,
  Activity,
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
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'defense',
      label: 'Live Defense',
      icon: <Radio className={`w-4 h-4 ${isStreaming ? 'text-rose-400 animate-pulse' : ''}`} />,
    },
    {
      id: 'enrollment',
      label: 'Voiceprint Vault',
      icon: <Fingerprint className="w-4 h-4" />,
    },
    {
      id: 'history',
      label: 'Audit Logs',
      icon: <History className="w-4 h-4" />,
    },
    {
      id: 'architecture',
      label: 'Engine Stack',
      icon: <Layers className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090e1a]/80 border-b border-slate-800/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/15">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-white">
                  VoiceShield <span className="text-cyan-400 font-semibold">AI</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono font-medium border border-cyan-500/20">
                  SIH26104
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Real-Time Voice Cloning Detection &amp; Impersonation Defense
              </p>
            </div>
          </div>

          {/* Clean Segmented Navigation Tabs */}
          <nav className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 shadow-inner">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.id === 'defense' && isStreaming && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-0.5" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Modern Status Badge */}
          <div className="hidden lg:flex items-center space-x-3">
            {systemHealth ? (
              <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-medium">Dual-Model Engine</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-semibold">Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-300">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

