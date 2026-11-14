"""Generate deterministic, realistic-looking *synthetic* data for the web app.

No output from this script is an observation. The visible application banner and
manifest mode prevent synthetic and real products from being mixed silently.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

from permafrost_pipeline.scoring import compute_index, monitoring_priority  # noqa: E402


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def rectangle(west: float, south: float, east: float, north: float) -> list[list[list[float]]]:
    return [[[west, south], [east, south], [east, north], [west, north], [west, south]]]


def build_cells(config: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    rows, columns = 10, 16
    west, south, east, north = -152.0, 68.5, -147.0, 70.5
    width, height = (east - west) / columns, (north - south) / rows
    features = []
    for row in range(rows):
        for col in range(columns):
            lon = west + (col + 0.5) * width
            lat = south + (row + 0.5) * height
            road_distance = abs(lon - (-149.45 + 0.12 * math.sin((lat - 68.5) * 2.4)))
            anomaly = math.exp(-((road_distance / 0.26) ** 2)) * (0.5 + 0.5 * math.sin(row * 0.9))
            fire_context = math.exp(-(((lon + 150.7) / 0.65) ** 2 + ((lat - 69.15) / 0.34) ** 2))
            coherence = max(0.18, min(0.88, 0.62 + rng.gauss(0, 0.1) - fire_context * 0.08))
            water = ((row * 7 + col * 5) % 41 == 0) or (row == 8 and col in (2, 3))
            snow = row == 9 and col % 6 == 0
            low_coherence = coherence < 0.3
            excluded = water or snow or low_coherence
            exclusion_reason = "Mostly open water" if water else "Snow on one radar date" if snow else "Radar coherence below 0.30" if low_coherence else None
            raw = {
                "coherence": round(coherence, 3),
                "valid_pair_share": round(max(0.35, min(1, 0.76 + rng.gauss(0, 0.12))), 3),
                "reference_stability": round(max(0.45, min(0.96, 0.81 + rng.gauss(0, 0.07))), 3),
                "temporal_consistency": round(max(0.35, min(0.97, 0.77 + rng.gauss(0, 0.1))), 3),
                "correction_magnitude_cm": round(max(0.05, 0.45 + rng.random() * 1.2 + (0.3 if row > 7 else 0)), 3),
                "sensor_agreement": round(max(0.25, min(0.98, 0.72 + rng.gauss(0, 0.13))), 3),
                "permafrost_fraction": round(max(0.55, min(1, 0.88 + rng.gauss(0, 0.06))), 3),
                "addt_c_days": round(120 + row * 7 + rng.uniform(-10, 14), 1),
                "persistence": round(max(0.12, min(0.95, 0.35 + anomaly * 0.38 + fire_context * 0.22 + rng.random() * 0.18)), 3),
                "ground_ice_or_fire_context": round(max(0.3, min(1, 0.52 + fire_context * 0.42 + rng.random() * 0.15)), 3),
                "field_agreement": None if (row + col) % 5 else round(0.58 + rng.random() * 0.25, 3),
                "recent_rain_mm": round(rng.random() * 24, 2),
            }
            q_score = compute_index("Q", raw, config)
            e_score = compute_index("E", raw, config)
            motion = -0.25 - 2.2 * anomaly - 1.4 * fire_context + rng.gauss(0, 0.2)
            if excluded:
                motion = 0
            properties = {
                "id": f"cell-{row:02d}-{col:02d}",
                "row": row,
                "col": col,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "motion_cm_yr": round(motion, 2),
                "motion_uncertainty_cm": round(0.28 + (1 - (q_score.value or 0)) * 1.2, 2),
                "q": round(q_score.value or 0, 3),
                "e": round(e_score.value or 0, 3),
                "q_band": q_score.band,
                "e_band": e_score.band,
                "excluded": excluded,
                "exclusion_reason": exclusion_reason,
                "area_name": "Control tundra" if col < 5 else "Prudhoe Bay oilfield and highway" if col > 10 else "Northern Dalton corridor",
                "provisional": True,
                **raw,
            }
            cell_west, cell_south = west + col * width, south + row * height
            features.append({
                "type": "Feature",
                "id": row * columns + col,
                "properties": properties,
                "geometry": {"type": "Polygon", "coordinates": rectangle(cell_west, cell_south, cell_west + width, cell_south + height)},
            })
    return {"type": "FeatureCollection", "features": features}


def build_segments(config: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    features = []
    for index in range(14):
        lat0 = 68.55 + index * 0.135
        lat1 = lat0 + 0.11
        centre = (lat0 + lat1) / 2
        road_lon = -149.45 + 0.12 * math.sin((centre - 68.5) * 2.4)
        for asset, offset in (("highway", 0.0), ("pipeline", 0.12)):
            z_score = -2.8 * math.sin(index * 0.73 + (0.3 if asset == "pipeline" else 0)) + rng.gauss(0, 0.28)
            median_q = max(0.32, min(0.91, 0.69 + rng.gauss(0, 0.1)))
            priority = monitoring_priority(z_score, median_q, config)
            features.append({
                "type": "Feature",
                "properties": {
                    "id": f"{asset}-{index + 1:02d}",
                    "name": f"{asset.title()} segment {index + 1:02d}",
                    "asset": asset,
                    "motion_cm_yr": round(-0.35 + z_score * 0.35, 2),
                    "uncertainty_cm": round(0.42 + (1 - median_q) * 0.8, 2),
                    "z": round(z_score, 2),
                    "median_q": round(median_q, 2),
                    "priority": priority,
                    "valid_coverage": round(0.56 + rng.random() * 0.4, 2),
                },
                "geometry": {"type": "LineString", "coordinates": [[road_lon + offset, lat0], [road_lon + offset, lat1]]},
            })
    return {"type": "FeatureCollection", "features": features}


def build_time_series() -> list[dict[str, Any]]:
    points = []
    for year in range(2016, 2027):
        drift = -(year - 2016) * 0.18
        points.append({
            "date": f"{year}-08-15",
            "year": year,
            "observed": round(drift - 1.2 - 0.15 * math.sin(year), 2),
            "control": round(-(year - 2016) * 0.04 - 0.55, 2),
            "lower": round(drift - 1.7, 2),
            "upper": round(drift - 0.7, 2),
            "source": "Sentinel-1",
            "provisional": False,
        })
    nisar_dates = ("2026-06-17", "2026-06-29", "2026-07-11", "2026-07-23", "2026-08-22", "2026-09-03", "2026-09-15")
    for index, day in enumerate(nisar_dates):
        after_gap = index >= 4
        effective_index = index + (2 if after_gap else 0)
        observed = -0.35 - effective_index * 0.31
        points.append({
            "date": day,
            "year": 2026 + effective_index / 20,
            "observed": round(observed, 2),
            "control": round(-0.22 - effective_index * 0.08, 2),
            "lower": round(observed - 0.38, 2),
            "upper": round(observed + 0.38, 2),
            "source": "NISAR",
            "provisional": True,
        })
    points.append({"date": "2026-08-03", "year": 2026.62, "observed": None, "control": None, "lower": None, "upper": None, "source": "NISAR", "provisional": True, "gap": True})
    return sorted(points, key=lambda point: point["date"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="public/data")
    args = parser.parse_args()
    output = ROOT / args.output
    config = json.loads((ROOT / "config" / "scoring.config.json").read_text(encoding="utf-8"))
    rng = random.Random(6712026)

    manifest = {
        "dataset_mode": "demo",
        "generated_at": date.today().isoformat(),
        "processing_version": "demo-2026.11.1",
        "grid": {"crs": "EPSG:3338", "cell_size_m": 100, "mvp_bbox": [-152.0, 68.5, -147.0, 70.5]},
        "reference": {"name": "Candidate control tundra reference (team review required)", "latitude": 69.68, "longitude": -148.7, "date": "2016-07-01", "stability": "Not independently validated"},
        "nisar_status": {"maturity": "PROVISIONAL", "thaw_season": "summer 2026", "gap": ["2026-07-27", "2026-08-10"], "posting_m": 80},
        "layers": [
            {"id": "nisar_motion", "label": "NISAR relative LOS displacement", "source": "Synthetic analogue of NISAR L2 GUNW", "evidence": "OBSERVED", "status": "DEMO / PROVISIONAL analogue"},
            {"id": "sentinel_baseline", "label": "Historical radar baseline", "source": "Synthetic analogue of OPERA DISP-S1", "evidence": "OBSERVED", "status": "DEMO"},
            {"id": "measurement_q", "label": "Measurement quality Q", "source": "Team-defined scoring config", "evidence": "INFERRED", "status": "DEMO"},
            {"id": "interpretation_e", "label": "Thaw interpretation E", "source": "Team-defined scoring config", "evidence": "INFERRED", "status": "DEMO"},
        ],
        "limitations": [
            "All map and chart values are synthetic and must not be used for decisions.",
            "The candidate control and stable reference areas require team and field review.",
            "NISAR 2026 thaw-season products are provisional and contain a permanent 27 July–10 August data gap.",
            "Ground motion is relative displacement, not a direct measurement of thaw or asset safety.",
        ],
    }
    write_json(output / "manifest.json", manifest)
    write_json(output / "cells.geojson", build_cells(config, rng))
    write_json(output / "segments.geojson", build_segments(config, rng))
    write_json(output / "time-series.json", build_time_series())
    print(f"Wrote demo layers to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
