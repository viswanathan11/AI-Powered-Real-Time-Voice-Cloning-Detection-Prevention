export interface DemoScenario {
  id: string;
  name: string;
  category: 'genuine' | 'clone_attack' | 'impersonator';
  description: string;
  claimedIdentityName: string;
  claimedRole: string;
  callType: string;
  amount: number;
  callerNumber: string;
  filename: string;
  expectedRiskLevel: 'LOW' | 'HIGH' | 'CRITICAL';
  expectedRecommendation: 'ALLOW' | 'VERIFY_CALLBACK' | 'ESCALATE';
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'scenario_cfo_clone_attack',
    name: '🔴 AI Voice Clone Attack (Neural Vocoder)',
    category: 'clone_attack',
    description: 'Attackers playing high-fidelity synthesized deepfake clone of CFO requesting urgent ₹50 Lakhs wire transfer.',
    claimedIdentityName: 'Ramesh Kumar',
    claimedRole: 'CFO',
    callType: 'fund_transfer_approval',
    amount: 5000000,
    callerNumber: '+91 98765 43210',
    filename: 'cfo_ai_clone_attack_chunk.wav',
    expectedRiskLevel: 'CRITICAL',
    expectedRecommendation: 'VERIFY_CALLBACK',
  },
  {
    id: 'scenario_cfo_genuine',
    name: '🟢 Genuine Executive Call (Authentic Voice)',
    category: 'genuine',
    description: 'Real CFO calling for routine vendor invoice approval. Acoustic features and 192-d voiceprint match authentic profile.',
    claimedIdentityName: 'Ramesh Kumar',
    claimedRole: 'CFO',
    callType: 'vendor_invoice_approval',
    amount: 250000,
    callerNumber: '+91 98765 43210',
    filename: 'cfo_genuine_live_chunk.wav',
    expectedRiskLevel: 'LOW',
    expectedRecommendation: 'ALLOW',
  },
  {
    id: 'scenario_different_impersonator',
    name: '🟠 Unknown Impersonator (Voice Mismatch)',
    category: 'impersonator',
    description: 'Social engineering scammer attempting to impersonate CFO with distinct acoustic pitch and vocal tract geometry.',
    claimedIdentityName: 'Ramesh Kumar',
    claimedRole: 'CFO',
    callType: 'wire_transfer',
    amount: 1500000,
    callerNumber: '+91 91234 56789',
    filename: 'attacker_different_voice_chunk.wav',
    expectedRiskLevel: 'HIGH',
    expectedRecommendation: 'VERIFY_CALLBACK',
  },
];

let cachedPayloads: Record<string, string> | null = null;

export async function getDemoAudioPayloads(): Promise<Record<string, string>> {
  if (cachedPayloads) {
    return cachedPayloads;
  }
  try {
    const res = await fetch('/sample_payloads.json');
    if (res.ok) {
      cachedPayloads = await res.json();
      return cachedPayloads!;
    }
  } catch (err) {
    console.warn('Could not fetch /sample_payloads.json from public directory:', err);
  }
  return {};
}

export async function getScenarioAudioBase64(filename: string): Promise<string> {
  const payloads = await getDemoAudioPayloads();
  if (payloads[filename]) {
    return payloads[filename];
  }
  try {
    const res = await fetch(`/samples/${filename}`);
    if (res.ok) {
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (err) {
    console.error('Error fetching sample wav:', err);
  }
  throw new Error(`Sample audio for "${filename}" not found.`);
}
