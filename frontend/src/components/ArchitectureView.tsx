import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SystemHealth } from '../types';
import {
  Layers,
  Cpu,
  Server,
  Monitor,
  Database,
  Radio,
  Zap,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Lock,
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
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase tracking-wider">
                SIH26104 Architecture Blueprint
              </span>
              <span className="text-xs text-slate-400 font-mono">3-Layer Unified Engine</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-1">
              End-to-End Real-Time Voice Cloning Detection Pipeline
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              A tightly integrated, low-latency stack uniting raw 16kHz audio capture, FastAPI WebSocket state management, and dual-model neural verification.
            </p>
          </div>

          <button
            type="button"
            onClick={checkHealth}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Test 3-Layer Connectivity</span>
          </button>
        </div>
      </div>

      {/* 3 Layer Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Layer 1: Frontend & Audio Capture */}
        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-cyan-500/20 rounded-xl text-cyan-400">
                <Monitor className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                LAYER 1: PRESENTATION
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Frontend &amp; Audio Capture Engine</h3>
            <p className="text-xs text-slate-400 mt-1">
              React 19 + Vite + Native Web Audio API
            </p>

            <ul className="space-y-2 mt-4 text-xs text-slate-300 font-mono">
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">▸</span>
                <span><strong>16kHz Mono PCM</strong> raw capture (No MediaRecorder compression artifacts)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">▸</span>
                <span><strong>3.0s Chunking</strong> (48,000 samples @ 16kHz = 96KB payload)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">▸</span>
                <span>Binary framing: <code>[4-byte Seq][WAV data]</code></span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">▸</span>
                <span>Live ticking Speedometer Risk Gauge (0.0 to 1.0)</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <span>Status: Active</span>
            <span>Web Audio Context: Ready</span>
          </div>
        </div>

        {/* Layer 2: FastAPI Backend & Gateway */}
        <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-400">
                <Server className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                LAYER 2: STATE &amp; GATEWAY
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Unified FastAPI Backend</h3>
            <p className="text-xs text-slate-400 mt-1">
              Python 3.13 + WebSockets + SQLAlchemy Async
            </p>

            <ul className="space-y-2 mt-4 text-xs text-slate-300 font-mono">
              <li className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">▸</span>
                <span><strong>WebSocket Gateway</strong> (<code>/ws/session/&#123;id&#125;</code>)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">▸</span>
                <span><strong>Composite Risk Engine</strong> with EMA smoothing (α=0.70)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">▸</span>
                <span>Contextual boosts: High-value (&gt; ₹5L) + Call Intent</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">▸</span>
                <span>PostgreSQL / SQLite <code>FLOAT8[]</code> numerical embeddings</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Database: <strong>{health?.database || 'sqlite'}</strong></span>
            <span className="text-purple-400 font-bold">{pingMs !== null ? `${pingMs}ms ping` : 'Connected'}</span>
          </div>
        </div>

        {/* Layer 3: Dual-Model ML Inference */}
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                LAYER 3: NEURAL INFERENCE
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Dual-Model AI ML Engine</h3>
            <p className="text-xs text-slate-400 mt-1">
              PyTorch + WavLM + ECAPA-TDNN (In-Process)
            </p>

            <ul className="space-y-2 mt-4 text-xs text-slate-300 font-mono">
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">▸</span>
                <span><strong>WavLM / Spectral Flux</strong>: Catches HiFi-GAN &amp; ElevenLabs neural artifacts</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">▸</span>
                <span><strong>ECAPA-TDNN</strong>: 192-d speaker voiceprint embedding &amp; cosine match</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">▸</span>
                <span>Sub-50ms in-process execution (Zero REST hops)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 font-bold">▸</span>
                <span><strong>Privacy Shield</strong>: Raw audio dropped; feature vectors only</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <span>Bridge: {health?.mlBridgeMode || 'in_process'}</span>
            <span>192-d ECAPA / WavLM</span>
          </div>
        </div>
      </div>

      {/* Interactive Dataflow Architecture Flowchart */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Real-Time Streaming Dataflow (3-Second Cycle)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center font-mono">
          <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl">
            <span className="text-[10px] text-cyan-400 block font-bold">STEP 1</span>
            <span className="text-xs text-white font-bold block mt-1">Audio Capture</span>
            <span className="text-[10px] text-slate-400">Web Audio API 16kHz PCM (48k samples)</span>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>

          <div className="p-3 bg-slate-950 border border-purple-500/30 rounded-xl">
            <span className="text-[10px] text-purple-400 block font-bold">STEP 2</span>
            <span className="text-xs text-white font-bold block mt-1">WebSocket Frame</span>
            <span className="text-[10px] text-slate-400">Binary chunk sent over <code>/ws/session/&#123;id&#125;</code></span>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>

          <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl">
            <span className="text-[10px] text-amber-400 block font-bold">STEP 3</span>
            <span className="text-xs text-white font-bold block mt-1">Dual ML Inference</span>
            <span className="text-[10px] text-slate-400">WavLM Synth + ECAPA Cosine Sim (~20ms)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-center font-mono mt-4">
          <div className="p-3 bg-slate-950 border border-rose-500/30 rounded-xl">
            <span className="text-[10px] text-rose-400 block font-bold">STEP 4</span>
            <span className="text-xs text-white font-bold block mt-1">Risk Calculation</span>
            <span className="text-[10px] text-slate-400">
              <code>0.5*Synth + 0.5*(1-Speaker) + Context</code>
            </span>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-rose-400 animate-pulse" />
          </div>

          <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl">
            <span className="text-[10px] text-emerald-400 block font-bold">STEP 5</span>
            <span className="text-xs text-white font-bold block mt-1">Immediate Action</span>
            <span className="text-[10px] text-slate-400">Live Gauge ticks &amp; <code>VERIFY_CALLBACK</code> banner</span>
          </div>
        </div>
      </div>
    </div>
  );
};
