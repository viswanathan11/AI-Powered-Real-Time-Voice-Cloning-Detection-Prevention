import React, { useState, useEffect } from 'react';
import { SessionHistory, ActiveSessionSummary, SecurityAlert } from '../types';
import { api } from '../services/api';
import {
  History,
  PhoneCall,
  ShieldAlert,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';

export const SessionHistoryView: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<ActiveSessionSummary[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [activeRes, alertRes] = await Promise.all([
        api.listActiveSessions().catch(() => ({ sessions: [], total: 0 })),
        api.listAlerts(undefined, 50).catch(() => ({ alerts: [], total: 0 })),
      ]);
      setActiveSessions(activeRes.sessions || []);
      setAlerts(alertRes.alerts || []);
    } catch (err) {
      console.error('Error loading session logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDetail = async (sessionId: string) => {
    try {
      setSelectedSessionId(sessionId);
      setDetailLoading(true);
      const history = await api.getSessionHistory(sessionId);
      setSessionDetail(history);
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSessionId(null);
    setSessionDetail(null);
  };

  // Filtered alerts
  const filteredAlerts = alerts.filter(
    (a) =>
      a.sessionId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.alertType.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (a.reason && a.reason.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Call Monitoring &amp; Fraud Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of analyzed sessions, chunk telemetry, and security alerts
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sessions or alerts..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Active & Ongoing Sessions (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Monitoring Sessions</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">
              {activeSessions.length} Active
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No live monitoring sessions ongoing. Start a call in Live Defense.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {activeSessions.map((sess) => (
                <div
                  key={sess.sessionId}
                  onClick={() => handleOpenDetail(sess.sessionId)}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/50 rounded-xl cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span className="text-xs font-bold text-white font-mono">{sess.sessionId.substring(0, 16)}...</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        sess.riskLevel === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300'
                          : sess.riskLevel === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      Risk: {(sess.currentRisk * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono text-slate-400">
                    <div>
                      <span>Identity: <strong className="text-slate-200">{sess.personName || 'Unenrolled'}</strong></span>
                    </div>
                    <div>
                      <span>Intent: <strong className="text-cyan-300">{sess.callType || 'N/A'}</strong></span>
                    </div>
                    <div>
                      <span>Amount: <strong className="text-white">{sess.amount ? `₹${sess.amount.toLocaleString('en-IN')}` : 'N/A'}</strong></span>
                    </div>
                    <div>
                      <span>Chunks: <strong className="text-slate-300">#{sess.chunkCount}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Alerts Feed (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Security Alerts Log</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 font-mono">
              {filteredAlerts.length} Alerts
            </span>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No security alerts recorded. Analyzed calls remained within safe parameters.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredAlerts.map((alt, idx) => (
                <div
                  key={alt.id || idx}
                  onClick={() => handleOpenDetail(alt.sessionId)}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-rose-500/50 rounded-xl cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px]">
                        {alt.alertType}
                      </span>
                      <span className="text-xs font-mono text-slate-300">{alt.sessionId.substring(0, 12)}...</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(alt.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-rose-300/90 mt-1.5">
                    {alt.reason || 'Deepfake voice cloning risk exceeded threshold.'}
                  </p>
                  <div className="flex justify-between items-center mt-1.5 text-[10px] font-mono text-slate-400">
                    <span>Chunk: #{alt.chunkSeq}</span>
                    {alt.riskScore && (
                      <span className="text-rose-400 font-semibold">
                        Risk: {(alt.riskScore * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session Drill-Down Inspection Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 relative max-h-[85vh] overflow-y-auto space-y-4">
            <button
              onClick={handleCloseDetail}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {detailLoading || !sessionDetail ? (
              <div className="py-12 text-center text-slate-400 font-mono flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Loading session details...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                      {sessionDetail.status}
                    </span>
                    <h3 className="text-sm font-bold text-white font-mono">
                      Session: {sessionDetail.sessionId}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Identity: <strong>{sessionDetail.personName || 'Unenrolled'}</strong> • Intent: <strong>{sessionDetail.callType}</strong>
                  </p>
                </div>

                {/* Chunks Timeline Table */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Sequential Chunk Scoring ({sessionDetail.chunks.length} Chunks)
                  </h4>

                  {sessionDetail.chunks.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono py-2">No chunk records.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-52 rounded-xl border border-slate-800/80">
                      <table className="w-full text-left text-xs font-mono text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-2">Seq</th>
                            <th className="p-2">WavLM Synth</th>
                            <th className="p-2">Speaker Match</th>
                            <th className="p-2">Composite Risk</th>
                            <th className="p-2">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 bg-slate-900/40">
                          {sessionDetail.chunks.map((c) => (
                            <tr key={c.chunkSeq} className="hover:bg-slate-800/30">
                              <td className="p-2 font-bold text-white">#{c.chunkSeq}</td>
                              <td className="p-2 text-purple-400">
                                {(c.syntheticScore * 100).toFixed(1)}%
                              </td>
                              <td className="p-2 text-cyan-400">
                                {(c.speakerMatchScore * 100).toFixed(1)}%
                              </td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    c.runningRisk >= 0.7
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : c.runningRisk >= 0.3
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {(c.runningRisk * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-2 text-slate-500 text-[10px]">
                                {new Date(c.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

