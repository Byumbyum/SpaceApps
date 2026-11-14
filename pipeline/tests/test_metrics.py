import numpy as np
import pytest

from permafrost_pipeline.metrics import (
    accumulated_degree_days,
    apply_los_corrections,
    fit_trend_and_thermal_term,
    los_to_vertical,
    segment_anomaly,
)


def test_addt_resets_each_year():
    result = accumulated_degree_days([-2, 4, 5, 3], [2025, 2025, 2026, 2026])
    assert result.tolist() == [0, 4, 5, 8]


def test_fit_recovers_known_terms():
    years = np.array([2020.0, 2020.2, 2021.0, 2021.2, 2022.0, 2022.2])
    addt = np.array([0, 100, 0, 100, 0, 100])
    displacement = -0.5 * (years - 2020) - 0.2 * np.sqrt(addt) + 1.0
    fit = fit_trend_and_thermal_term(years, displacement, addt)
    assert fit.rate_cm_per_year == pytest.approx(-0.5)
    assert fit.thermal_sensitivity == pytest.approx(-0.2)
    assert fit.r_squared == pytest.approx(1.0)


def test_corrections_vertical_guard_and_segment_z():
    corrected = apply_los_corrections(
        np.array([2.0, 2.0]), np.array([0.2, 0.2]), np.array([0.1, 0.1]), np.array([0.1, 0.1])
    )
    assert corrected.tolist() == pytest.approx([1.6, 1.6])
    vertical = los_to_vertical(corrected, np.array([60.0, 60.0]), np.array([False, True]))
    assert vertical[0] == pytest.approx(3.2)
    assert np.isnan(vertical[1])
    anomaly, z_score = segment_anomaly(-2.0, -0.5, 0.5)
    assert anomaly == pytest.approx(-1.5)
    assert z_score == pytest.approx(-3.0)
