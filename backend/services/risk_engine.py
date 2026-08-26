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
    ) -> float:
        """
        Calculates raw composite risk based on task_backend.md formula:
          runningRisk = 0.5 * syntheticScore + 0.5 * (1 - speakerMatchScore)
        """
        synthetic_score = max(0.0, min(1.0, float(synthetic_score)))
        speaker_match_score = max(0.0, min(1.0, float(speaker_match_score)))

        if not has_enrolled_profile:
            # Without enrolled reference profile, risk is purely driven by synthetic deepfake artifacts
            return synthetic_score

        speaker_mismatch = 1.0 - speaker_match_score
        raw_risk = (
            self.synthetic_weight * synthetic_score +
            self.speaker_mismatch_weight * speaker_mismatch
        )
        return max(0.0, min(1.0, round(raw_risk, 4)))

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
        caller_number = context.get("callerNumber")

        # 1. High value fund transfer modifier
        if amount is not None and float(amount) >= settings.HIGH_VALUE_TRANSACTION_THRESHOLD:
            # If there is even moderate suspicion, increase sensitivity for high-value transactions
            if modified_risk >= 0.30:
                modified_risk = min(1.0, modified_risk + 0.10)
                reasons.append(f"High-value transaction flagged (Amount: {amount:,.2f})")

        # 2. Critical call type modifier
        if any(h_type in call_type for h_type in settings.HIGH_RISK_CALL_TYPES):
            if modified_risk >= 0.35:
                modified_risk = min(1.0, modified_risk + 0.08)
                reasons.append(f"High-risk call intent ({call_type})")

        # 3. Mismatched voice on claimed profile
        if speaker_match_score < 0.35 and base_risk >= 0.40:
            modified_risk = min(1.0, modified_risk + 0.12)
            reasons.append("Severe voiceprint mismatch with claimed identity")

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

        Returns:
            Dict containing:
                runningRisk, rawRisk, riskLevel, recommendation, alertTriggered, alertType, reason
        """
        if is_silent:
            current_risk = previous_running_risk if previous_running_risk is not None else 0.0
            risk_level, recommendation = self.classify_risk(current_risk)
            return {
                "runningRisk": round(current_risk, 4),
                "rawRisk": 0.0,
                "riskLevel": risk_level,
                "recommendation": recommendation,
                "alertTriggered": False,
                "alertType": None,
                "reason": "Silence detected in chunk"
            }

        # 1. Compute raw formula risk
        raw_risk = self.calculate_raw_risk(
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
            # If current chunk has an acute spike in deepfake detection, react aggressively
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
                alert_reason = context_reason
            elif synthetic_score >= 0.65 and speaker_match_score < 0.50:
                alert_reason = "Synthetic voice artifacts and speaker voiceprint mismatch detected"
            elif synthetic_score >= 0.65:
                alert_reason = f"High synthetic deepfake artifacts detected ({synthetic_score * 100:.1f}%)"
            elif speaker_match_score < 0.40:
                alert_reason = f"Voiceprint mismatch with claimed identity ({speaker_match_score * 100:.1f}% match)"
            else:
                alert_reason = f"Elevated impersonation risk score: {running_risk * 100:.1f}%"

        return {
            "runningRisk": running_risk,
            "rawRisk": raw_risk,
            "riskLevel": risk_level,
            "recommendation": recommendation,
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
