import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  rmsLevel: number;
  chunkProgressSec?: number; // 0.0 to 3.0
  mode?: 'mic' | 'scenario' | 'file';
  riskScore?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyserNode,
  isActive,
  rmsLevel,
  chunkProgressSec = 0,
  mode = 'mic',
  riskScore = 0.1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.04;
      
      // Auto-fit canvas internal buffer to actual rendered dimensions for ultra-sharp rendering
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (targetWidth > 0 && targetHeight > 0 && (canvas.width !== targetWidth || canvas.height !== targetHeight)) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const width = canvas.width || 600;
      const height = canvas.height || 80;

      // Dark background
      ctx.fillStyle = '#060a13';
      ctx.fillRect(0, 0, width, height);

      // Subtle horizontal centerline
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Dynamic waveform stroke & glow based on risk
      let strokeColor = '#06b6d4'; // Cyan
      let glowColor = 'rgba(6, 182, 212, 0.4)';
      if (riskScore >= 0.7) {
        strokeColor = '#ef4444'; // Red
        glowColor = 'rgba(239, 68, 68, 0.5)';
      } else if (riskScore >= 0.3) {
        strokeColor = '#f59e0b'; // Amber
        glowColor = 'rgba(245, 158, 11, 0.4)';
      }

      if (isActive && analyserNode) {
        // Real Live AnalyserNode Data
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        // Draw Oscilloscope Waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Subtle bottom spectrum bars
        const freqArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(freqArray);
        const barWidth = width / 36;
        for (let i = 0; i < 36; i++) {
          const barHeight = (freqArray[i * 2] / 255) * (height * 0.35);
          ctx.fillStyle = `${strokeColor}25`;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
        }
      } else if (isActive) {
        // Animated live wave for scenario playback
        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const points = 80;
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * width;
          const amp = Math.max(0.12, rmsLevel * 3.2) * (height * 0.32);
          const y =
            height / 2 +
            Math.sin(i * 0.18 + time * 3) * amp * 0.6 +
            Math.sin(i * 0.35 - time * 2) * amp * 0.35 +
            (Math.random() - 0.5) * (amp * 0.08);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Idle gentle breathing wave
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height / 2 + Math.sin(x * 0.04 + time) * 1.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyserNode, isActive, rmsLevel, riskScore]);

  const progressPercent = Math.min(100, Math.round((chunkProgressSec / 3.0) * 100));

  return (
    <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
      {/* Top Header */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {isActive ? (
            <span className="flex items-center space-x-1.5 text-emerald-400 font-mono text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{mode === 'mic' ? 'Live Microphone' : 'Audio Stream Active'}</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-slate-500 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span>Awaiting Stream</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <span>16kHz Mono</span>
          <span className="text-slate-600">•</span>
          <span>RMS: <strong>{(rmsLevel * 100).toFixed(0)}%</strong></span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-20 rounded-lg overflow-hidden border border-slate-800/50 bg-[#060a13]">
        <canvas ref={canvasRef} width={600} height={80} className="w-full h-full block" />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 pointer-events-none">
            <span className="text-xs text-slate-500 font-mono flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-600" />
              <span>Ready for incoming audio</span>
            </span>
          </div>
        )}
      </div>

      {/* Chunk Buffer Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>3.0s Chunking Window</span>
          <span>{chunkProgressSec.toFixed(1)}s / 3.0s</span>
        </div>
        <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              riskScore >= 0.7 ? 'bg-rose-500' : riskScore >= 0.3 ? 'bg-amber-500' : 'bg-cyan-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

