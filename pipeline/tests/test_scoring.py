import json
from pathlib import Path

import pytest

from permafrost_pipeline.scoring import compute_index, monitoring_priority, transform


CONFIG = json.loads((Path(__file__).parents[2] / "config" / "scoring.config.json").read_text(encoding="utf-8"))


def test_missing_factor_renormalizes_weights():
    score = compute_index(
        "E",
        {
            "permafrost_fraction": 0.9,
            "addt_c_days": 120,
            "persistence": 0.7,
            "ground_ice_or_fire_context": 0.7,
            "field_agreement": None,
            "recent_rain_mm": 2,
        },
        CONFIG,
    )
    assert sum(factor.effective_weight for factor in score.factors) == pytest.approx(1.0)
    assert "Field evidence agreement" in score.missing


def test_true_zero_stays_zero():
    score = compute_index(
        "Q",
        {
            "coherence": 0.3,
            "valid_pair_share": 0.8,
            "reference_stability": 0.8,
            "temporal_consistency": 0.8,
            "correction_magnitude_cm": 0.2,
            "sensor_agreement": 0.8,
        },
        CONFIG,
    )
    assert score.value == 0


def test_transform_and_priority_thresholds():
    spec = {"transform": "linear_rescale", "params": {"min": 0.3, "max": 0.7}}
    assert transform(0.5, spec) == pytest.approx(0.5)
    assert monitoring_priority(2.2, 0.8, CONFIG) == "higher"
    assert monitoring_priority(3.0, 0.2, CONFIG) == "insufficient"
