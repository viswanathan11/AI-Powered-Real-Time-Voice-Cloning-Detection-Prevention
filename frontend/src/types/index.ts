export interface VoiceProfile {
  profileId: string;
  personName: string;
  role?: string;
  orgId?: string;
  sampleCount: number;
  enrolledAt: string;
}

export interface VoiceProfileListResponse {
  profiles: VoiceProfile[];
  total: number;
}

export interface EnrollVoiceprintRequest {
  personName: string;
  role?: string;
  orgId?: string;
  audioSamples: string[];
}

export interface SessionContext {
  callType: string;
  amount?: number;
  callerNumber?: string;
}

export interface StartSessionRequest {
  claimedIdentity?: string;
  context?: SessionContext;
}

export interface StartSessionResponse {
  sessionId: string;
  websocketUrl: string;
  claimedIdentity?: string;
  startedAt: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Recommendation = 'ALLOW' | 'MONITOR' | 'VERIFY_CALLBACK' | 'ESCALATE';

export interface ChunkScoringResult {
  sessionId: string;
  chunkSeq: number;
  syntheticScore: number;
  speakerMatchScore: number;
  runningRisk: number;
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  latencyMs: number;
  isSilent: boolean;
  alertTriggered?: boolean;
  rawRisk?: number;
  timestamp?: string;
}

export interface SecurityAlert {
  id?: string;
  sessionId: string;
  chunkSeq: number;
  alertType: string;
  riskScore?: number;
  reason?: string;
  createdAt: string;
}

export interface SessionChunkSummary {
  chunkSeq: number;
  syntheticScore: number;
  speakerMatchScore: number;
  runningRisk: number;
  createdAt: string;
}

export interface SessionHistory {
  sessionId: string;
  claimedIdentity?: string;
  personName?: string;
  callType?: string;
  amount?: number;
  callerNumber?: string;
  chunks: SessionChunkSummary[];
  finalRisk: number;
  status: string;
  alertsFired: SecurityAlert[];
  startedAt: string;
  endedAt?: string;
}

export interface ActiveSessionSummary {
  sessionId: string;
  claimedProfileId?: string;
  personName?: string;
  callType?: string;
  amount?: number;
  callerNumber?: string;
  chunkCount: number;
  currentRisk: number;
  riskLevel: RiskLevel;
  status: string;
  startedAt: string;
}

export interface SystemHealth {
  status: string;
  appName: string;
  version: string;
  database: string;
  cache: string;
  mlBridgeMode: string;
}
