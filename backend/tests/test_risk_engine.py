import pytest
from backend.services.risk_engine import RiskEngine


def test_formula_running_risk():
    """
    Tests core formula from task_backend.md:
      runningRisk = 0.5 * syntheticScore + 0.5 * (1 - speakerMatchScore)
    """
    engine = RiskEngine(synthetic_weight=0.5, speaker_mismatch_weight=0.5)

    # Case 1: Pure genuine voice (synthetic=0.0, speaker_match=1.0) -> risk=0.0
    risk1 = engine.calculate_raw_risk(synthetic_score=0.0, speaker_match_score=1.0)
    assert risk1 == 0.0

    # Case 2: Deepfake clone of genuine speaker (synthetic=0.8, speaker_match=0.9)
    # runningRisk = 0.5 * 0.8 + 0.5 * (1 - 0.9) = 0.40 + 0.05 = 0.45
    risk2 = engine.calculate_raw_risk(synthetic_score=0.8, speaker_match_score=0.9)
    assert pytest.approx(risk2, 0.001) == 0.45

    # Case 3: Complete mismatch attacker (synthetic=0.73, speaker_match=0.41)
    # runningRisk = 0.5 * 0.73 + 0.5 * (1 - 0.41) = 0.365 + 0.295 = 0.66
    risk3 = engine.calculate_raw_risk(synthetic_score=0.73, speaker_match_score=0.41)
    assert pytest.approx(risk3, 0.001) == 0.66


def test_risk_classification():
    """Tests risk level thresholds and tactical recommendations."""
    engine = RiskEngine()

    assert engine.classify_risk(0.15) == ("LOW", "ALLOW")
    assert engine.classify_risk(0.45) == ("MEDIUM", "MONITOR")
    assert engine.classify_risk(0.70) == ("HIGH", "VERIFY_CALLBACK")
    assert engine.classify_risk(0.88) == ("CRITICAL", "ESCALATE")


def test_calculate_running_risk_end_to_end():
    """Tests end-to-end chunk risk calculation with alerts."""
    engine = RiskEngine()

    # Low risk genuine call
    res_low = engine.calculate_running_risk(synthetic_score=0.05, speaker_match_score=0.95)
    assert res_low["riskLevel"] == "LOW"
    assert res_low["recommendation"] == "ALLOW"
    assert not res_low["alertTriggered"]

    # High risk deepfake clone
    res_high = engine.calculate_running_risk(synthetic_score=0.85, speaker_match_score=0.30)
    assert res_high["riskLevel"] in ("HIGH", "CRITICAL")
    assert res_high["recommendation"] in ("VERIFY_CALLBACK", "ESCALATE")
    assert res_high["alertTriggered"]
    assert res_high["alertType"] in ("VERIFY_CALLBACK", "ESCALATE")


def test_contextual_modifiers():
    """Tests transaction amount and call type sensitivity boosts."""
    engine = RiskEngine()

    context = {
        "callType": "fund_transfer_approval",
        "amount": 5000000.0,
        "callerNumber": "+919876543210"
    }

    base_risk = 0.45
    modified_risk, reason = engine.apply_contextual_modifiers(
        base_risk=base_risk,
        synthetic_score=0.50,
        speaker_match_score=0.50,
        context=context
    )

    assert modified_risk > base_risk
    assert reason is not None
    assert "High-value transaction" in reason or "High-risk call intent" in reason


def test_exponential_moving_average_smoothing():
    """Tests risk score smoothing across multiple chunks."""
    engine = RiskEngine(ema_alpha=0.6)

    # Chunk 1
    eval1 = engine.calculate_running_risk(synthetic_score=0.20, speaker_match_score=0.80)
    risk1 = eval1["runningRisk"]

    # Chunk 2 with transient spike
    eval2 = engine.calculate_running_risk(
        synthetic_score=0.40,
        speaker_match_score=0.60,
        previous_running_risk=risk1
    )
    risk2 = eval2["runningRisk"]

    # Smoothed risk should be between chunk 1 and current raw risk
    assert risk1 < risk2 < 0.40


def test_silent_audio_chunk():
    """Tests that silent chunks are marked and do not trigger false alarms."""
    engine = RiskEngine()
    eval_silent = engine.calculate_running_risk(
        synthetic_score=0.0,
        speaker_match_score=1.0,
        is_silent=True
    )
    assert eval_silent["riskLevel"] == "LOW"
    assert eval_silent["recommendation"] == "ALLOW"
    assert not eval_silent["alertTriggered"]
