import React, { useState } from 'react';
import { VoiceProfile, EnrollVoiceprintRequest } from '../types';
import { api } from '../services/api';
import { getDemoAudioPayloads } from '../data/demoAudio';
import { audioCaptureEngine } from '../services/audioCapture';
import {
  UserCheck,
  UserPlus,
  Trash2,
  Lock,
  Mic,
  Square,
  CheckCircle,
  Sparkles,
  Upload,
  RefreshCw,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react';

interface EnrollmentViewProps {
  profiles: VoiceProfile[];
  onRefreshProfiles: () => Promise<void>;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  profiles,
  onRefreshProfiles,
}) => {
  // Form fields
  const [personName, setPersonName] = useState('Ramesh Kumar');
  const [role, setRole] = useState('Chief Financial Officer (CFO)');
  const [orgId, setOrgId] = useState('org_hdfc_bank');

  // Audio samples in base64
  const [audioSamples, setAudioSamples] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load demo CFO samples into form for instant 1-click enrollment testing
  const handleLoadDemoSamples = async () => {
    try {
      setLoading(true);
      const payloads = await getDemoAudioPayloads();
      const samples = [
        payloads['cfo_enrollment_1.wav'],
        payloads['cfo_enrollment_2.wav'],
        payloads['cfo_enrollment_3.wav'],
      ].filter(Boolean);

      if (samples.length === 0) {
        throw new Error('Demo CFO samples not found in /sample_payloads.json');
      }

      setPersonName('Ramesh Kumar');
      setRole('Chief Financial Officer (CFO)');
      setOrgId('org_enterprise_01');
      setAudioSamples(samples);
      setSuccessMessage('Loaded 3 authentic CFO voice clips ready for enrollment!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to load demo samples: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Record a single clip from live mic
  const startRecordingClip = async (index: number) => {
    try {
      setRecordingIndex(index);
      setIsRecording(true);
      setErrorMessage(null);

      await audioCaptureEngine.startMicrophone({
        onChunkReady: (chunk) => {
          audioCaptureEngine.stop();
          setIsRecording(false);
          setRecordingIndex(null);

          const updated = [...audioSamples];
          updated[index] = chunk.base64Wav;
          setAudioSamples(updated);
        },
        onError: (err) => {
          setErrorMessage(`Microphone capture error: ${err.message}`);
          setIsRecording(false);
          setRecordingIndex(null);
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setIsRecording(false);
      setRecordingIndex(null);
    }
  };

  const stopRecordingClip = () => {
    audioCaptureEngine.stop();
    setIsRecording(false);
    setRecordingIndex(null);
  };

  // Handle custom file upload for an audio sample
  const handleSampleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const chunks = await audioCaptureEngine.sliceAudioIntoChunks(file);
      if (chunks.length > 0) {
        const updated = [...audioSamples];
        updated[index] = chunks[0].base64Wav;
        setAudioSamples(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Error processing file: ${msg}`);
    }
  };

  // Submit Enrollment
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setErrorMessage('Please enter the executive name.');
      return;
    }
    if (audioSamples.filter(Boolean).length === 0) {
      setErrorMessage('Please record or upload at least 1 audio clip (3 recommended for higher accuracy).');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const req: EnrollVoiceprintRequest = {
        personName,
        role,
        orgId,
        audioSamples: audioSamples.filter(Boolean),
      };

      const profile = await api.enrollVoiceprint(req);
      setSuccessMessage(
        `✓ Voiceprint successfully enrolled for "${profile.personName}" (${profile.role})! Numerical 192-d embedding saved.`
      );
      setAudioSamples([]);
      await onRefreshProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Enrollment failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to remove this executive voiceprint?')) return;
    try {
      await api.deleteProfile(id);
      await onRefreshProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Delete failed: ${msg}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Clean Privacy Assurance Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white">
                Zero Raw Voice Storage (DPDP &amp; GDPR Compliant)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                Mandate #4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ECAPA-TDNN extracts 192-d mathematical embeddings and permanently deletes raw voice audio.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLoadDemoSamples}
          disabled={loading || isRecording}
          className="shrink-0 px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Load Demo CFO Clips</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Enrollment Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2.5 pb-3 mb-4 border-b border-slate-800/70">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Enroll Executive Voiceprint</h3>
                <p className="text-xs text-slate-400">Record 1-3 voice clips to generate biometric voiceprint</p>
              </div>
            </div>

            {/* Notification Messages */}
            {successMessage && (
              <div className="p-3 mb-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="p-3 mb-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Executive Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. CFO"
                  />
                </div>

                {/* Org ID */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Organization ID
                  </label>
                  <input
                    type="text"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. org_bank_01"
                  />
                </div>
              </div>

              {/* 3 Voice Samples Capture Section */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">
                    Voice Sample Clips (3-second 16kHz WAVs):
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {audioSamples.filter(Boolean).length} / 3 clips ready
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[0, 1, 2].map((idx) => {
                    const hasSample = !!audioSamples[idx];
                    const isRecThis = isRecording && recordingIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition ${
                          hasSample
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-slate-950/50 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Clip #{idx + 1}
                          </span>
                          {hasSample ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                              ✓ Ready
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Empty
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {!isRecThis ? (
                            <button
                              type="button"
                              onClick={() => startRecordingClip(idx)}
                              disabled={isRecording || loading}
                              className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-xs font-medium rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Mic className="w-3 h-3" />
                              <span>{hasSample ? 'Re-Record' : 'Record'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopRecordingClip}
                              className="flex-1 py-1.5 px-2 bg-red-600 text-white text-xs font-bold rounded-lg animate-pulse flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Square className="w-3 h-3" />
                              <span>Recording...</span>
                            </button>
                          )}

                          <label className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer transition">
                            <Upload className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => handleSampleFileUpload(idx, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || isRecording}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-xs tracking-wide cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4" />
                  )}
                  <span>EXTRACT 192-D EMBEDDING &amp; ENROLL PROFILE</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Enrolled Profiles Directory (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/70">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Registered Executive Profiles</h3>
              </div>
              <button
                type="button"
                onClick={() => onRefreshProfiles()}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Refresh Profile List"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                No voice profiles enrolled yet. Complete the form to register an executive.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {profiles.map((p) => (
                  <div
                    key={p.profileId}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{p.personName}</h4>
                        <p className="text-[11px] text-cyan-400">{p.role || 'Executive'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteProfile(p.profileId)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                      <div>
                        <span>Samples:</span>
                        <div className="text-emerald-400 font-semibold">{p.sampleCount} clips (192-d)</div>
                      </div>
                      <div>
                        <span>Enrolled:</span>
                        <div className="text-slate-400">{new Date(p.enrolledAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Total: {profiles.length} Profiles</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vault Active</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

