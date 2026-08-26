import React, { useState, useEffect } from 'react';
import { SessionHistory, ActiveSessionSummary, SecurityAlert } from '../types';
import { api } from '../services/api';
import {
  History,
  PhoneCall,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Layers,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-cyan-400" />
            <span>Call Monitoring &amp; Fraud Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete compliance audit trail of analyzed phone calls, chunk timelines, and security alerts
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search session ID or alert..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active & Ongoing Sessions (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Monitoring Sessions</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
              {activeSessions.length} Active
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No live monitoring sessions currently ongoing. Start a call in the Threat Simulator.
            </div>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {activeSessions.map((sess) => (
                <div
                  key={sess.sessionId}
                  onClick={() => handleOpenDetail(sess.sessionId)}
                  className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span className="text-xs font-bold text-white font-mono">{sess.sessionId}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
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

                  <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px] font-mono text-slate-400">
                    <div>
                      <span>Claimed Identity:</span>
                      <div className="text-slate-200 font-bold">{sess.personName || 'Unenrolled'}</div>
                    </div>
                    <div>
                      <span>Call Intent:</span>
                      <div className="text-cyan-300 font-bold truncate">{sess.callType || 'N/A'}</div>
                    </div>
                    <div>
                      <span>Transaction Amount:</span>
                      <div className="text-white font-bold">
                        {sess.amount ? `₹${sess.amount.toLocaleString('en-IN')}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span>Chunks Processed:</span>
                      <div className="text-slate-300 font-bold">#{sess.chunkCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Alerts Feed (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Logged Security Alerts</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold">
              {filteredAlerts.length} Alerts
            </span>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No security alerts recorded. All analyzed calls remained within safe parameters.
            </div>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {filteredAlerts.map((alt, idx) => (
                <div
                  key={alt.id || idx}
                  onClick={() => handleOpenDetail(alt.sessionId)}
                  className="p-3.5 bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 rounded-xl cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px]">
                        {alt.alertType}
                      </span>
                      <span className="text-xs font-mono text-slate-300">Session: {alt.sessionId}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(alt.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-rose-300/90 mt-2 font-medium">
                    {alt.reason || 'Deepfake voice cloning probability exceeded risk threshold.'}
                  </p>
                  <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400">
                    <span>Chunk Sequence: #{alt.chunkSeq}</span>
                    {alt.riskScore && (
                      <span className="text-rose-400 font-bold">
                        Trigger Risk: {(alt.riskScore * 100).toFixed(1)}%
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
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseDetail}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading || !sessionDetail ? (
              <div className="py-16 text-center text-slate-400 font-mono flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span>Loading Session Audit Timeline...</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                      {sessionDetail.status}
                    </span>
                    <h3 className="text-base font-bold text-white font-mono">
                      Session ID: {sessionDetail.sessionId}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Claimed Identity: <strong>{sessionDetail.personName || 'Unenrolled Profile'}</strong> | Intent: <strong>{sessionDetail.callType}</strong> | Amount: <strong>{sessionDetail.amount ? `₹${sessionDetail.amount.toLocaleString('en-IN')}` : 'N/A'}</strong>
                  </p>
                </div>

                {/* Chunks Timeline Table */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Sequential Chunk Analysis ({sessionDetail.chunks.length} Total Chunks)
                  </h4>

                  {sessionDetail.chunks.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono py-4">No chunk records for this session.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs font-mono text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">Seq #</th>
                            <th className="p-2.5">WavLM Synth %</th>
                            <th className="p-2.5">Speaker Match %</th>
                            <th className="p-2.5">Composite Risk</th>
                            <th className="p-2.5">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                          {sessionDetail.chunks.map((c) => (
                            <tr key={c.chunkSeq} className="hover:bg-slate-800/40">
                              <td className="p-2.5 font-bold text-white">#{c.chunkSeq}</td>
                              <td className="p-2.5 text-purple-400 font-bold">
                                {(c.syntheticScore * 100).toFixed(1)}%
                              </td>
                              <td className="p-2.5 text-cyan-400 font-bold">
                                {(c.speakerMatchScore * 100).toFixed(1)}%
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                              <td className="p-2.5 text-slate-500 text-[10px]">
                                {new Date(c.createdAt).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Alerts Fired */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Security Alerts Logged ({sessionDetail.alertsFired.length})
                  </h4>
                  {sessionDetail.alertsFired.length === 0 ? (
                    <p className="text-xs text-emerald-400 font-mono">✓ Zero security alerts fired during this session.</p>
                  ) : (
                    <div className="space-y-2">
                      {sessionDetail.alertsFired.map((alt, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-rose-300">
                              Chunk #{alt.chunkSeq}: {alt.alertType}
                            </span>
                            <p className="text-slate-300 text-[11px] mt-0.5">{alt.reason}</p>
                          </div>
                          <span className="text-slate-500 text-[10px] font-mono">
                            {new Date(alt.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
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
