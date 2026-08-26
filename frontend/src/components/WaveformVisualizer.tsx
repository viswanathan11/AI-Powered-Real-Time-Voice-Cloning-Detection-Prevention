import React, { useEffect, useRef } from 'react';
import { Activity, Mic, Radio } from 'lucide-react';

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
      time += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark tech grid background
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid lines
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Determine waveform color based on risk
      let strokeColor = '#06B6D4'; // Cyan
      let glowColor = 'rgba(6, 182, 212, 0.4)';
      if (riskScore >= 0.7) {
        strokeColor = '#EF4444'; // Red
        glowColor = 'rgba(239, 68, 68, 0.5)';
      } else if (riskScore >= 0.3) {
        strokeColor = '#F59E0B'; // Amber
        glowColor = 'rgba(245, 158, 11, 0.4)';
      }

      if (isActive && analyserNode) {
        // Real Live AnalyserNode Data
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        // Draw Oscilloscope Waveform
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // 0.0 to 2.0 (1.0 center)
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

        // Draw Frequency Spectrum Bars at bottom
        const freqArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(freqArray);
        const barWidth = (width / 48);
        for (let i = 0; i < 48; i++) {
          const barHeight = (freqArray[i * 2] / 255) * (height * 0.4);
          ctx.fillStyle = `${strokeColor}44`;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } else if (isActive) {
        // Synthesized animated live wave for scenario playback simulation
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = strokeColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const points = 100;
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * width;
          const amp = Math.max(0.1, rmsLevel * 3.5) * (height * 0.35);
          const y =
            height / 2 +
            Math.sin(i * 0.15 + time * 3) * amp * 0.6 +
            Math.sin(i * 0.3 - time * 2) * amp * 0.3 +
            (Math.random() - 0.5) * (amp * 0.1);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Idle flatline with subtle breathing animation
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height / 2 + Math.sin(x * 0.05 + time) * 1.5;
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

  // Format chunk 3s progress
  const progressPercent = Math.min(100, Math.round((chunkProgressSec / 3.0) * 100));

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner flex flex-col space-y-2">
      {/* Visualizer Status Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {isActive ? (
            <span className="flex items-center space-x-1 text-emerald-400 font-mono">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span className="font-bold text-[11px]">
                {mode === 'mic' ? 'LIVE MIC (16kHz PCM)' : 'AUDIO STREAM ACTIVE'}
              </span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-slate-500 font-mono">
              <Mic className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px]">STREAM IDLE</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <span>SR: <strong>16,000 Hz</strong></span>
          <span>CH: <strong>1 (Mono)</strong></span>
          <span>RMS: <strong>{(rmsLevel * 100).toFixed(1)}%</strong></span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-800/80">
        <canvas ref={canvasRef} width={600} height={100} className="w-full h-full block" />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] pointer-events-none">
            <span className="text-xs text-slate-500 font-mono tracking-wider flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-slate-600" />
              <span>Awaiting Audio Capture...</span>
            </span>
          </div>
        )}
      </div>

      {/* 3-Second Chunk Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>3.0s Chunk Buffer Window</span>
          <span>{chunkProgressSec.toFixed(1)}s / 3.0s ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
