import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SystemHealth } from '../types';
import {
  Cpu,
  Server,
  Monitor,
  Zap,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const data = await api.getHealth();
      setHealth(data);
      setPingMs(Math.round(performance.now() - t0));
    } catch {
      setHealth(null);
      setPingMs(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-5">
      {/* Overview Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-white">
              SIH26104 Architecture Blueprint
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              3-Layer Stack
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">
            Real-Time Voice Cloning Detection &amp; Prevention Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unified sub-50ms inference pipeline connecting 16kHz audio capture, FastAPI WebSockets, and PyTorch ML.
          </p>
        </div>

        <button
          type="button"
          onClick={checkHealth}
          disabled={loading}
          className="shrink-0 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Test Connectivity</span>
        </button>
      </div>

      {/* 3 Layer Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Layer 1: Audio Capture */}
        <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-cyan-500/15 rounded-xl text-cyan-400">
                <Monitor className="w-5 h-5" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300">
                Layer 1
              </span>
            </div>
            <h3 className="text-xs font-bold text-white">Frontend &amp; Audio Capture</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              React 19 + Native Web Audio API
            </p>

            <ul className="space-y-1.5 mt-3 text-xs text-slate-300 font-mono">
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">▸</span>
                <span>16kHz Mono 16-bit PCM capture</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">▸</span>
                <span>3.0s real-time chunking windows</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-cyan-400">▸</span>
                <span>Binary frame streaming</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-emerald-400 flex justify-between">
            <span>Web Audio: Ready</span>
            <span>16,000 Hz</span>
          </div>
        </div>

        {/* Layer 2: FastAPI Backend */}
        <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-500/15 rounded-xl text-purple-400">
                <Server className="w-5 h-5" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-300">
                Layer 2
              </span>
            </div>
            <h3 className="text-xs font-bold text-white">FastAPI WebSocket Backend</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Python 3.13 + Async SQLAlchemy
            </p>

            <ul className="space-y-1.5 mt-3 text-xs text-slate-300 font-mono">
              <li className="flex items-center space-x-2">
                <span className="text-purple-400">▸</span>
                <span>WebSocket Session Gateway</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-purple-400">▸</span>
                <span>EMA Risk Smoothing (α=0.70)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-purple-400">▸</span>
                <span>192-d Feature Embedding DB</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] font-mono flex justify-between">
            <span className="text-slate-400">DB: {health?.database || 'sqlite'}</span>
            <span className="text-purple-400">{pingMs !== null ? `${pingMs}ms` : 'Connected'}</span>
          </div>
        </div>

        {/* Layer 3: Dual-Model ML */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-500/15 rounded-xl text-amber-400">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300">
                Layer 3
              </span>
            </div>
            <h3 className="text-xs font-bold text-white">Dual-Model Neural Engine</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              PyTorch + WavLM + ECAPA-TDNN
            </p>

            <ul className="space-y-1.5 mt-3 text-xs text-slate-300 font-mono">
              <li className="flex items-center space-x-2">
                <span className="text-amber-400">▸</span>
                <span>WavLM Neural Vocoder Detection</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-amber-400">▸</span>
                <span>ECAPA-TDNN 192-d Voiceprint Match</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-amber-400">▸</span>
                <span>Sub-50ms In-Process Execution</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-emerald-400 flex justify-between">
            <span>In-Process Bridge</span>
            <span>Zero Audio Retained</span>
          </div>
        </div>
      </div>

      {/* Clean Streaming Dataflow Pipeline */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real-Time 3-Second Streaming Pipeline</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-center font-mono">
          <div className="p-2.5 bg-slate-950/60 border border-cyan-500/30 rounded-xl">
            <span className="text-[10px] text-cyan-400 block font-bold">1. Capture</span>
            <span className="text-xs text-white font-semibold block mt-0.5">16kHz PCM</span>
          </div>

          <div className="hidden sm:flex justify-center text-slate-500">
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="p-2.5 bg-slate-950/60 border border-purple-500/30 rounded-xl">
            <span className="text-[10px] text-purple-400 block font-bold">2. WebSocket</span>
            <span className="text-xs text-white font-semibold block mt-0.5">Binary Frame</span>
          </div>

          <div className="hidden sm:flex justify-center text-slate-500">
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </div>

          <div className="p-2.5 bg-slate-950/60 border border-amber-500/30 rounded-xl">
            <span className="text-[10px] text-amber-400 block font-bold">3. Dual ML</span>
            <span className="text-xs text-white font-semibold block mt-0.5">WavLM + ECAPA</span>
          </div>
        </div>
      </div>
    </div>
  );
};

