from typing import Tuple, Optional, Dict, Any
from backend.config import settings


class RiskEngine:
    """
    Real-Time Risk Scoring Engine.
    Calculates composite impersonation risk from ML acoustic models (WavLM & ECAPA-TDNN)
    and incorporates contextual transaction metadata (amount, call intent, caller number).
    """

    def __init__(
        self,
        synthetic_weight: float = settings.SYNTHETIC_WEIGHT,
        speaker_mismatch_weight: float = settings.SPEAKER_MISMATCH_WEIGHT,
        low_threshold: float = settings.RISK_THRESHOLD_LOW,
        medium_threshold: float = settings.RISK_THRESHOLD_MEDIUM,
        high_threshold: float = settings.RISK_THRESHOLD_HIGH,
        ema_alpha: float = settings.RISK_EMA_ALPHA
    ):
        self.synthetic_weight = synthetic_weight
        self.speaker_mismatch_weight = speaker_mismatch_weight
        self.low_threshold = low_threshold
        self.medium_threshold = medium_threshold
        self.high_threshold = high_threshold
        self.ema_alpha = ema_alpha

    def calculate_raw_risk(
        self,
        synthetic_score: float,
        speaker_match_score: float,
        has_enrolled_profile: bool = True
    ) -> Tuple[float, str, str]:
        """
        Calculates raw composite risk based on 3-way triage:
        1. AI Voice Clone (synthetic >= 0.60): Critical Risk [0.85 - 1.0]
        2. Human Imposter (match < 0.50): High Risk [0.70 - 0.90]
        3. Authentic Voice (match >= 0.50, synthetic < 0.35): Low Risk [0.05 - 0.20]
        4. General caller: Pure synthetic score
        """
        synthetic_score = max(0.0, min(1.0, float(synthetic_score)))
        speaker_match_score = max(0.0, min(1.0, float(speaker_match_score)))

        if not has_enrolled_profile:
            verdict = "CRITICAL_AI_CLONE" if synthetic_score >= 0.60 else "GENERAL_HUMAN"
            label = "Critical: AI Voice Synthesis" if synthetic_score >= 0.60 else "Natural Human Voice (Unenrolled)"
            return round(synthetic_score, 4), verdict, label

        # 3-Way Triage Evaluation
        if synthetic_score >= settings.SYNTHETIC_SCORE_THRESHOLD or synthetic_score >= 0.60:
            raw_risk = max(0.85, synthetic_score)
            verdict = "CRITICAL_AI_CLONE"
            label = "Critical: AI Voice Clone Attack"
        elif speaker_match_score < 0.50:
            raw_risk = max(0.70, round(0.85 * (1.0 - speaker_match_score), 4))
            verdict = "IMPOSTER_MISMATCH"
            label = "Warning: Voiceprint Mismatch (Imposter)"
        else:
            raw_risk = max(0.05, round(0.25 * synthetic_score + 0.20 * (1.0 - speaker_match_score), 4))
            verdict = "AUTHENTIC_EXECUTIVE"
            label = "Authentic Executive Verified"

        return max(0.0, min(1.0, round(raw_risk, 4))), verdict, label

    def apply_contextual_modifiers(
        self,
        base_risk: float,
        synthetic_score: float,
        speaker_match_score: float,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, Optional[str]]:
        """
        Adjusts risk score based on transaction context:
        - High-value transactions (e.g. > 500,000 INR)
        - Sensitive call types (fund_transfer_approval, wire_transfer, credential_reset)
        - Unknown / suspicious caller ID
        """
        if not context:
            return base_risk, None

        modified_risk = base_risk
        reasons = []

        amount = context.get("amount")
        call_type = str(context.get("callType", "")).lower()

        # 1. High value fund transfer modifier
        if amount is not None and float(amount) >= settings.HIGH_VALUE_TRANSACTION_THRESHOLD:
            if modified_risk >= 0.35:
                modified_risk = min(1.0, modified_risk + 0.08)
                reasons.append(f"High-value transaction (₹{amount:,.0f})")

        # 2. Critical call type modifier
        if any(h_type in call_type for h_type in settings.HIGH_RISK_CALL_TYPES):
            if modified_risk >= 0.35:
                modified_risk = min(1.0, modified_risk + 0.06)
                reasons.append(f"High-risk intent ({call_type})")

        reason_str = "; ".join(reasons) if reasons else None
        return max(0.0, min(1.0, round(modified_risk, 4))), reason_str

    def calculate_running_risk(
        self,
        synthetic_score: float,
        speaker_match_score: float,
        previous_running_risk: Optional[float] = None,
        context: Optional[Dict[str, Any]] = None,
        has_enrolled_profile: bool = True,
        is_silent: bool = False
    ) -> Dict[str, Any]:
        """
        End-to-end evaluation for an incoming audio chunk.
        Calculates raw risk, context adjustments, EMA smoothing, risk category, and recommendation.
        """
        if is_silent:
            current_risk = previous_running_risk if previous_running_risk is not None else 0.0
            risk_level, recommendation = self.classify_risk(current_risk)
            return {
                "runningRisk": round(current_risk, 4),
                "rawRisk": 0.0,
                "riskLevel": risk_level,
                "recommendation": recommendation,
                "verdict": "AWAITING_SPEECH",
                "verdictLabel": "Silence / Speech Pause",
                "alertTriggered": False,
                "alertType": None,
                "reason": "Silence detected in chunk"
            }

        # 1. Compute 3-way triage risk
        raw_risk, verdict, verdict_label = self.calculate_raw_risk(
            synthetic_score=synthetic_score,
            speaker_match_score=speaker_match_score,
            has_enrolled_profile=has_enrolled_profile
        )

        # 2. Apply contextual risk adjustments
        adjusted_risk, context_reason = self.apply_contextual_modifiers(
            base_risk=raw_risk,
            synthetic_score=synthetic_score,
            speaker_match_score=speaker_match_score,
            context=context
        )

        # 3. Apply Exponential Moving Average (EMA) smoothing if previous risk exists
        if previous_running_risk is not None:
            effective_alpha = 0.85 if adjusted_risk > 0.70 else self.ema_alpha
            running_risk = effective_alpha * adjusted_risk + (1.0 - effective_alpha) * previous_running_risk
        else:
            running_risk = adjusted_risk

        running_risk = max(0.0, min(1.0, round(running_risk, 4)))

        # 4. Classify risk level and tactical recommendation
        risk_level, recommendation = self.classify_risk(running_risk)

        # 5. Determine if an alert should be triggered
        alert_triggered = False
        alert_type = None
        alert_reason = None

        if recommendation in ("VERIFY_CALLBACK", "ESCALATE"):
            alert_triggered = True
            alert_type = recommendation
            if context_reason:
                alert_reason = f"{verdict_label} — {context_reason}"
            elif synthetic_score >= 0.60:
                alert_reason = f"Neural vocoder synthesis detected ({synthetic_score * 100:.1f}%)"
            elif speaker_match_score < 0.50:
                alert_reason = f"Voiceprint mismatch with claimed identity ({speaker_match_score * 100:.1f}% match)"
            else:
                alert_reason = f"Elevated impersonation risk: {running_risk * 100:.1f}%"

        return {
            "runningRisk": running_risk,
            "rawRisk": raw_risk,
            "riskLevel": risk_level,
            "recommendation": recommendation,
            "verdict": verdict,
            "verdictLabel": verdict_label,
            "alertTriggered": alert_triggered,
            "alertType": alert_type,
            "reason": alert_reason
        }

    def classify_risk(self, risk_score: float) -> Tuple[str, str]:
        """
        Maps a 0.0-1.0 risk score to UI level and operational recommendation.
        """
        if risk_score < self.low_threshold:
            return "LOW", "ALLOW"
        elif risk_score < self.medium_threshold:
            return "MEDIUM", "MONITOR"
        elif risk_score < self.high_threshold:
            return "HIGH", "VERIFY_CALLBACK"
        else:
            return "CRITICAL", "ESCALATE"


risk_engine = RiskEngine()
