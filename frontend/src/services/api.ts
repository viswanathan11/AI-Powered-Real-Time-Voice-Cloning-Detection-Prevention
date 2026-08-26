import {
  VoiceProfile,
  VoiceProfileListResponse,
  EnrollVoiceprintRequest,
  StartSessionRequest,
  StartSessionResponse,
  SessionHistory,
  ActiveSessionSummary,
  SecurityAlert,
  SystemHealth,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        errMsg = errorData.detail || errorData.message || errMsg;
      } catch {
        // ignore JSON parse errors on non-json response
      }
      throw new Error(errMsg);
    }
    return res.json() as Promise<T>;
  }

  async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
  }

  async listProfiles(skip = 0, limit = 50, orgId?: string): Promise<VoiceProfileListResponse> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (orgId) params.append('orgId', orgId);
    return this.request<VoiceProfileListResponse>(`/api/voiceprint/profiles?${params.toString()}`);
  }

  async getProfile(profileId: string): Promise<VoiceProfile> {
    return this.request<VoiceProfile>(`/api/voiceprint/${profileId}`);
  }

  async enrollVoiceprint(req: EnrollVoiceprintRequest): Promise<VoiceProfile> {
    return this.request<VoiceProfile>('/api/voiceprint/enroll', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async deleteProfile(profileId: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(`/api/voiceprint/${profileId}`, {
      method: 'DELETE',
    });
  }

  async startSession(req: StartSessionRequest): Promise<StartSessionResponse> {
    return this.request<StartSessionResponse>('/api/session/start', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async listActiveSessions(): Promise<{ sessions: ActiveSessionSummary[]; total: number }> {
    return this.request<{ sessions: ActiveSessionSummary[]; total: number }>('/api/session/active');
  }

  async getSessionHistory(sessionId: string): Promise<SessionHistory> {
    return this.request<SessionHistory>(`/api/session/${sessionId}/history`);
  }

  async endSession(sessionId: string): Promise<{
    sessionId: string;
    status: string;
    finalRisk: number;
    riskLevel: string;
    totalChunks: number;
    totalAlerts: number;
    endedAt: string;
  }> {
    return this.request(`/api/session/${sessionId}/end`, {
      method: 'POST',
    });
  }

  async listAlerts(sessionId?: string, limit = 50): Promise<{ alerts: SecurityAlert[]; total: number }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sessionId) params.append('sessionId', sessionId);
    return this.request<{ alerts: SecurityAlert[]; total: number }>(`/api/alerts?${params.toString()}`);
  }
}

export const api = new ApiService();
