"""Numerical metrics that do not perform I/O."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np


@dataclass(frozen=True)
class TrendFit:
    rate_cm_per_year: float
    thermal_sensitivity: float
    intercept: float
    r_squared: float
    residual_standard_error: float
    count: int


def accumulated_degree_days(temperatures_c: Iterable[float], years: Iterable[int]) -> np.ndarray:
    """Return yearly-reset running sums of max(air temperature, 0)."""
    temperatures = np.asarray(list(temperatures_c), dtype=float)
    year_values = np.asarray(list(years), dtype=int)
    if temperatures.shape != year_values.shape:
        raise ValueError("temperatures_c and years must have the same length")
    result = np.zeros_like(temperatures, dtype=float)
    for year in np.unique(year_values):
        mask = year_values == year
        result[mask] = np.cumsum(np.maximum(temperatures[mask], 0.0))
    return result


def fit_trend_and_thermal_term(
    decimal_year: Iterable[float],
    displacement_cm: Iterable[float],
    addt_c_days: Iterable[float],
) -> TrendFit:
    """Fit d(t) = v(t-t0) + A*sqrt(ADDT) + c using least squares."""
    time = np.asarray(list(decimal_year), dtype=float)
    displacement = np.asarray(list(displacement_cm), dtype=float)
    addt = np.asarray(list(addt_c_days), dtype=float)
    valid = np.isfinite(time) & np.isfinite(displacement) & np.isfinite(addt) & (addt >= 0)
    if valid.sum() < 4:
        raise ValueError("At least four valid observations are required")
    time = time[valid]
    displacement = displacement[valid]
    addt = addt[valid]
    design = np.column_stack((time - time.min(), np.sqrt(addt), np.ones_like(time)))
    coefficients, _, _, _ = np.linalg.lstsq(design, displacement, rcond=None)
    fitted = design @ coefficients
    residuals = displacement - fitted
    total = np.sum((displacement - displacement.mean()) ** 2)
    residual_sum = np.sum(residuals**2)
    r_squared = 1.0 - residual_sum / total if total > 0 else 0.0
    dof = max(1, len(displacement) - design.shape[1])
    return TrendFit(
        rate_cm_per_year=float(coefficients[0]),
        thermal_sensitivity=float(coefficients[1]),
        intercept=float(coefficients[2]),
        r_squared=float(r_squared),
        residual_standard_error=float(np.sqrt(residual_sum / dof)),
        count=int(len(displacement)),
    )


def apply_los_corrections(
    raw_los_cm: np.ndarray,
    ionosphere_cm: np.ndarray,
    troposphere_cm: np.ndarray,
    solid_earth_tide_cm: np.ndarray,
    correction_sign: float = -1.0,
) -> np.ndarray:
    """Apply product corrections after their metadata units and sign are verified."""
    arrays = [np.asarray(value, dtype=float) for value in (raw_los_cm, ionosphere_cm, troposphere_cm, solid_earth_tide_cm)]
    if len({array.shape for array in arrays}) != 1:
        raise ValueError("All correction arrays must share a grid")
    return arrays[0] + correction_sign * (arrays[1] + arrays[2] + arrays[3])


def los_to_vertical(los_cm: np.ndarray, incidence_angle_degrees: np.ndarray, steep_slope_mask: np.ndarray) -> np.ndarray:
    """Convert LOS to vertical only outside explicitly supplied steep-slope cells."""
    los = np.asarray(los_cm, dtype=float)
    angle = np.asarray(incidence_angle_degrees, dtype=float)
    steep = np.asarray(steep_slope_mask, dtype=bool)
    if not (los.shape == angle.shape == steep.shape):
        raise ValueError("LOS, incidence angle, and slope mask must share a grid")
    vertical = los / np.cos(np.deg2rad(angle))
    vertical[steep] = np.nan
    return vertical


def segment_anomaly(segment_mean: float, reference_median: float, combined_uncertainty: float) -> tuple[float, float]:
    if combined_uncertainty <= 0:
        raise ValueError("combined_uncertainty must be positive")
    anomaly = segment_mean - reference_median
    return anomaly, anomaly / combined_uncertainty
