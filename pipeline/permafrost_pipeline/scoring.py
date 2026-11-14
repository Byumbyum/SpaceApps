"""Pure, config-driven index calculations shared conceptually with the web app.

The newer project redline requires observed zero factors to produce an index of
zero. Missing factors are not treated as zeros; available weights are
renormalized and the missing evidence is returned explicitly.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import exp, log
from typing import Any, Mapping


@dataclass(frozen=True)
class FactorScore:
    id: str
    label: str
    raw: float | None
    normalized: float | None
    configured_weight: float
    effective_weight: float
    explanation: str


@dataclass(frozen=True)
class IndexScore:
    value: float | None
    band: str
    factors: tuple[FactorScore, ...]
    limited_by: str | None
    missing: tuple[str, ...]


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def transform(raw: float, spec: Mapping[str, Any]) -> float:
    kind = spec["transform"]
    params = spec.get("params", {})
    if kind == "identity":
        return _clamp(raw)
    if kind == "linear_rescale":
        minimum = float(params.get("min", 0.0))
        maximum = float(params.get("max", 1.0))
        return _clamp((raw - minimum) / (maximum - minimum))
    if kind == "exp_decay":
        return _clamp(exp(-raw / float(params.get("scale", 1.0))))
    if kind == "one_minus_exp":
        return _clamp(1.0 - exp(-raw / float(params.get("scale", 1.0))))
    if kind == "inverse":
        return _clamp(1.0 / (1.0 + raw / float(params.get("scale", 1.0))))
    if kind == "boolean":
        return 1.0 if raw > 0 else 0.0
    raise ValueError(f"Unsupported transform: {kind}")


def _band(value: float | None, config: Mapping[str, Any]) -> str:
    if value is None:
        return "not-assessed"
    if value >= float(config["bands"]["high"]):
        return "high"
    if value >= float(config["bands"]["medium"]):
        return "medium"
    return "low"


def compute_index(
    index: str,
    raw_values: Mapping[str, float | None],
    config: Mapping[str, Any],
) -> IndexScore:
    specs = [factor for factor in config["factors"] if factor["index"] == index]
    available_specs = [spec for spec in specs if raw_values.get(spec["id"]) is not None]
    weight_sum = sum(float(spec["weight"]) for spec in available_specs)
    factors: list[FactorScore] = []

    for spec in specs:
        raw = raw_values.get(spec["id"])
        normalized = None if raw is None else transform(float(raw), spec)
        effective = float(spec["weight"]) / weight_sum if raw is not None and weight_sum else 0.0
        factors.append(
            FactorScore(
                id=spec["id"],
                label=spec["label"],
                raw=None if raw is None else float(raw),
                normalized=normalized,
                configured_weight=float(spec["weight"]),
                effective_weight=effective,
                explanation=spec["explanation"],
            )
        )

    if not available_specs or weight_sum <= 0:
        return IndexScore(
            value=None,
            band="not-assessed",
            factors=tuple(factors),
            limited_by=None,
            missing=tuple(spec["label"] for spec in specs),
        )

    present = [factor for factor in factors if factor.normalized is not None]
    if any(factor.normalized == 0 and factor.configured_weight > 0 for factor in present):
        value = 0.0
    else:
        epsilon = float(config.get("epsilon", 0.01))
        value = exp(
            sum(
                factor.effective_weight * log(max(float(factor.normalized), epsilon))
                for factor in present
            )
        )
    weakest = min(present, key=lambda factor: float(factor.normalized)) if present else None
    return IndexScore(
        value=value,
        band=_band(value, config),
        factors=tuple(factors),
        limited_by=None if weakest is None else weakest.id,
        missing=tuple(factor.label for factor in factors if factor.normalized is None),
    )


def monitoring_priority(z_score: float, median_q: float, config: Mapping[str, Any]) -> str:
    thresholds = config["monitoring_priority"]
    if median_q < float(thresholds["minimum_q"]):
        return "insufficient"
    magnitude = abs(z_score)
    if magnitude >= float(thresholds["higher_z"]):
        return "higher"
    if magnitude >= float(thresholds["moderate_z"]):
        return "moderate"
    return "lower"
