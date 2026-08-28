import React, { useState, useEffect, useCallback } from 'react';
import {
  VoiceProfile,
  ChunkScoringResult,
  SecurityAlert,
  SystemHealth,
} from './types';
import { api } from './services/api';
import { wsClient } from './services/webSocketClient';
import { audioCaptureEngine, AudioChunkPayload } from './services/audioCapture';
import { Navbar, ActiveTab } from './components/Navbar';
import { ThreatSimulator } from './components/ThreatSimulator';
import { SecurityDashboard } from './components/SecurityDashboard';
import { EnrollmentView } from './components/EnrollmentView';
import { SessionHistoryView } from './components/SessionHistoryView';
import { ArchitectureView } from './components/ArchitectureView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('defense');

  // Voice profiles
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Active Session State
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeCallContext, setActiveCallContext] = useState<{
    callerNumber: string;
    amount: number;
    callType: string;
  }>({
    callerNumber: '+91 98765 43210',
    amount: 5000000,
    callType: 'fund_transfer_approval',
  });

  // Real-time Scoring Telemetry
  const [currentResult, setCurrentResult] = useState<ChunkScoringResult | null>(null);
  const [chunkHistory, setChunkHistory] = useState<ChunkScoringResult[]>([]);
  const [sessionAlerts, setSessionAlerts] = useState<SecurityAlert[]>([]);

  // System Health
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Load profiles and system health on mount
  const refreshProfiles = useCallback(async () => {
    try {
      const res = await api.listProfiles();
      setProfiles(res.profiles || []);
      if (res.profiles && res.profiles.length > 0 && !selectedProfileId) {
        setSelectedProfileId(res.profiles[0].profileId);
      }
    } catch (err) {
      console.warn('Profiles fetch error:', err);
    }
  }, [selectedProfileId]);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      setSystemHealth(health);
    } catch (err) {
      console.warn('Health check error:', err);
      setSystemHealth(null);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
    refreshHealth();
    const interval = setInterval(refreshHealth, 10000);
    return () => clearInterval(interval);
  }, [refreshProfiles, refreshHealth]);

  // Selected Profile metadata
  const currentProfile = profiles.find((p) => p.profileId === selectedProfileId) || null;

  // Start Call Handler
  const handleStartCall = async (config: {
    claimedIdentity: string;
    callType: string;
    amount: number;
    callerNumber: string;
  }) => {
    // 1. Reset chunk telemetry
    setCurrentResult(null);
    setChunkHistory([]);
    setSessionAlerts([]);
    setActiveCallContext({
      callerNumber: config.callerNumber,
      amount: config.amount,
      callType: config.callType,
    });

    // 2. Call backend POST /api/session/start
    const sessionRes = await api.startSession({
      claimedIdentity: config.claimedIdentity || undefined,
      context: {
        callType: config.callType,
        amount: config.amount,
        callerNumber: config.callerNumber,
      },
    });

    const sessionId = sessionRes.sessionId;
    setCurrentSessionId(sessionId);

    // Format WebSocket URL: if backend returns http://, replace with ws://
    let wsUrl = sessionRes.websocketUrl;
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    }

    // 3. Connect WebSocket client
    await wsClient.connect(wsUrl, {
      onMessage: (scoringResult) => {
        setCurrentResult(scoringResult);
        setChunkHistory((prev) => [...prev, scoringResult]);

        // If alert was fired, record it
        if (scoringResult.alertTriggered) {
          const alertDesc =
            scoringResult.verdict === 'CRITICAL_AI_CLONE' || scoringResult.syntheticScore >= 0.60
              ? `AI Voice Clone: Neural vocoder synthesis detected (${(scoringResult.syntheticScore * 100).toFixed(0)}%)`
              : scoringResult.verdict === 'IMPOSTER_MISMATCH' || scoringResult.speakerMatchScore < 0.50
              ? `Voiceprint mismatch: biometric divergence from profile (${(scoringResult.speakerMatchScore * 100).toFixed(1)}% match)`
              : 'Elevated transaction impersonation risk';

          const newAlert: SecurityAlert = {
            sessionId: scoringResult.sessionId,
            chunkSeq: scoringResult.chunkSeq,
            alertType: scoringResult.recommendation,
            riskScore: scoringResult.runningRisk,
            reason: alertDesc,
            createdAt: new Date().toISOString(),
          };
          setSessionAlerts((prev) => [...prev, newAlert]);
        }
      },
      onOpen: () => {
        setIsStreaming(true);
      },
      onClose: () => {
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error('WebSocket connection error:', err);
      },
    });
  };

  // End Call Handler
  const handleEndCall = async () => {
    setIsStreaming(false);
    audioCaptureEngine.stop();
    wsClient.disconnect();

    if (currentSessionId) {
      try {
        await api.endSession(currentSessionId);
      } catch (err) {
        console.warn('Session end API warning:', err);
      }
      setCurrentSessionId(null);
    }
  };

  // Chunk Ready Handler
  const handleChunkReady = (chunk: AudioChunkPayload) => {
    // Send binary frame: [4 bytes seq (big-endian)][16kHz PCM WAV bytes]
    const sent = wsClient.sendBinary(chunk.binaryFrame);
    if (!sent) {
      // Fallback to text JSON frame
      wsClient.sendJson({
        chunkSeq: chunk.chunkSeq,
        audio: chunk.base64Wav,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-x-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemHealth={systemHealth}
        isStreaming={isStreaming}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1640px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 z-10">
        {activeTab === 'defense' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Split Screen Left: Threat Simulator (5 cols) */}
            <div className="lg:col-span-5 h-full">
              <ThreatSimulator
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onSelectProfileId={setSelectedProfileId}
                isStreaming={isStreaming}
                onStartCall={handleStartCall}
                onEndCall={handleEndCall}
                onChunkReady={handleChunkReady}
                currentRisk={currentResult?.runningRisk || 0.0}
              />
            </div>

            {/* Split Screen Right: Security Defense Dashboard (7 cols) */}
            <div className="lg:col-span-7 h-full">
              <SecurityDashboard
                currentResult={currentResult}
                chunkHistory={chunkHistory}
                alerts={sessionAlerts}
                isStreaming={isStreaming}
                selectedProfile={currentProfile}
                callerNumber={activeCallContext.callerNumber}
                amount={activeCallContext.amount}
              />
            </div>
          </div>
        )}

        {activeTab === 'enrollment' && (
          <EnrollmentView
            profiles={profiles}
            onRefreshProfiles={refreshProfiles}
          />
        )}

        {activeTab === 'history' && <SessionHistoryView />}

        {activeTab === 'architecture' && <ArchitectureView />}
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#05080f]/80 border-t border-slate-800/60 py-3.5 text-center text-xs font-mono text-slate-500 z-10 backdrop-blur-md">
        <div className="max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            VoiceShield AI • SIH26104 Voice Cloning Detection &amp; Prevention
          </span>
          <span className="text-cyan-400/80 font-medium">
            WavLM + ECAPA-TDNN In-Process Engine
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;

