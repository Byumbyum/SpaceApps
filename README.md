# Ground Truth North

An evidence-aware NASA Space Apps 2026 prototype for the **Dancing with the SARs** challenge. The app combines a synthetic demonstration of historical Sentinel-1 context with the shape and provenance of NISAR summer 2026 observations to show relative ground motion along Alaska's northern Dalton corridor.

> **Project objective:** We identify and explain radar-observed ground changes that may indicate emerging permafrost-related hazards, and show clearly which observations are trustworthy.

The current web dataset is intentionally synthetic. A yellow **DEMO DATA** banner remains visible in Story, Explore, and About modes, and the NISAR analogue is always labelled **PROVISIONAL**. Do not use the demonstration values for decisions.

## What is implemented

- Nine-chapter, evidence-labelled Story mode for policymakers and the public.
- Map-first Explore landing experience with familiar drag, scroll/pinch zoom, recenter, scale, and floating map controls.
- Predefined Alaska focus area bounded by `(73,-176)`, `(73,-124)`, `(50,-124)`, and `(50,-176)`, plus a separate Northern Dalton processed-data extent.
- Interactive MapLibre exploration map with paint-to-select and paint-to-deselect tools.
- Immediate on-map selection insight for safety, health, and economic context; detailed datasets remain optional in a collapsible right drawer.
- Georeferenced analysis cells over an attributed OpenStreetMap reference basemap, with centroid latitude/longitude markers and popups.
- Sentinel-1 2016–2026 synthetic baseline and a separately labelled NISAR summer 2026 series.
- Explicit 27 July–10 August 2026 NISAR data gap.
- Relative ground-motion heatmap with measurement quality (`Q`) as opacity.
- Separate, config-driven measurement-quality (`Q`) and thaw-interpretation (`E`) indices.
- Factor-level **Why?** panel, including not-assessed evidence and the limiting factors.
- Highway and pipeline monitoring-priority overlay with uncertainty and valid-coverage disclosure.
- About page with provenance, reference, methods, limitations, sources, and open decisions.
- Deterministic Python demo generator and an offline scientific-processing package.
- Matching TypeScript/Python scoring behavior with automated tests.

## Quick start

Requirements: Node.js 20+ and Python 3.11+.

```powershell
npm install
npm run demo:generate
npm run dev
```

Open `http://127.0.0.1:5173/`.

The analysis data is local and precomputed. The real-world OpenStreetMap context tiles require an internet connection; when WebGL is unavailable, the compatibility view uses only the small set of tiles needed for the current MVP extent. It does not prefetch or bulk-download tiles.

Production checks:

```powershell
npm test
npm run build
python -m pytest pipeline/tests
```

## Repository map

```text
config/scoring.config.json       One scoring contract for Q, E, bands and priority
demo/generate_demo.py            Deterministic synthetic cells, segments and series
pipeline/permafrost_pipeline/    Offline science and provenance helpers
pipeline/tests/                  Scoring and numerical guardrail tests
public/data/                     Generated demo manifest and static web layers
src/components/                  Story, map, analysis and About experiences
src/lib/scoring.ts               Pure frontend scoring implementation
src/lib/modules.ts               Analysis-module registry and planned extensions
CHECKPOINT.md                    Handover state for long-running implementation
```

## Scoring contract

Hard exclusions are applied before an index is summarized. `Q` asks whether a relative displacement measurement is usable. `E` asks how much independent context supports a permafrost-thaw interpretation. Neither is a probability.

Factors use transforms and weights from [`config/scoring.config.json`](config/scoring.config.json). For each index:

```text
Index = product(normalized_factor ^ effective_weight)
```

- An available positive-weight factor that is truly zero makes the index zero.
- An unavailable factor is shown as **not assessed**; it is not silently converted to zero.
- Weights renormalize across the factors that are available.
- High/medium/low bands are team-defined screening categories, not validated performance thresholds.
- Infrastructure priority uses the segment anomaly relative to nearby reference ground, divided by combined uncertainty. It is never a structural safety rating.

Changing the config changes both calculated indices and the factor rows in the **Why?** panel without a code edit.

## Demo data

Generate the complete static dataset with:

```powershell
python demo/generate_demo.py
```

The generator writes:

- `manifest.json`: mode, grid, product status, reference, sources and limitations.
- `cells.geojson`: a 10 × 16 synthetic analysis grid with raw factors, Q, E, exclusions, motion and uncertainty.
- `segments.geojson`: synthetic highway/pipeline segments with z-scores, valid coverage and priority.
- `time-series.json`: Sentinel-1 context and NISAR 2026 points with a null gap marker.

The seed is fixed, so test and presentation results are reproducible. Generated values imitate plausible data ranges but are not observations.

## Offline pipeline

Install the Python package for development:

```powershell
python -m pip install -e "pipeline[test]"
```

Available scientific helpers include:

- yearly-reset accumulated degree-days of thaw (ADDT);
- least-squares fitting of `d(t) = v(t−t0) + A√ADDT + c` with R² and residual error kept as diagnostics;
- explicit ionosphere, troposphere and solid-earth-tide correction application;
- LOS-to-vertical conversion that returns no value for supplied steep-slope cells;
- segment/reference anomaly and z-score calculation;
- pure config-driven Q/E and monitoring-priority scoring;
- fail-closed local inspection of NISAR GUNW HDF5 and OPERA DISP-S1 GeoTIFF provenance.

Inspect already-downloaded products before they enter a workflow:

```powershell
dalton-pipeline inspect nisar-gunw path\to\product.h5 --output inventory.json
dalton-pipeline inspect opera-disp path\to\displacement.tif
```

Earthdata and Copernicus credentials are deliberately not stored in this repository. Product download should use `asf_search`, `earthaccess`, or `cdsapi` in the operator's authenticated environment. Each real-data export must retain acquisition dates, footprint, units, reference, CRID/processing version, applied corrections, masks, uncertainty, and maturity.

### Real-data promotion rule

A demo layer may be replaced independently only when its manifest entry is complete and the relevant checks pass. Never silently mix synthetic values with observations. Real NISAR thaw-season output must remain labelled `PROVISIONAL`, must expose the July–August gap, and must be compared with corrected and uncorrected diagnostics before publication.

## Science guardrails

- InSAR measures relative line-of-sight displacement, not thaw.
- Convert LOS to vertical only where negligible horizontal movement is plausible and incidence geometry is valid; do not use that conversion for steep-slope movement.
- Report seasonal sinking amplitude separately from residual change between comparable dates.
- Use ADDT only as an association test, not as standalone climate attribution.
- Brightness/backscatter can respond to rain, wet snow, vegetation, roughness and geometry.
- A road or pipeline segment near observed motion may warrant closer investigation; the app cannot certify asset condition.
- The long-term carbon panel is published context. The app does not measure carbon or a tipping-point probability.

## Open team decisions

The interface deliberately surfaces these instead of guessing:

1. Exact control-tundra polygons and the stable reference area.
2. Final 100 m grid versus H3 selection cells.
3. Whether real NISAR GUNW pairs over the MVP box pass the known-issue and quality checks.
4. Reliable sources for small-community facility locations.
5. Whether later terrain chapters justify CesiumJS instead of MapLibre.

## Main references

- [NASA Space Apps: Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/)
- [ASF NISAR GUNW product guide](https://nisar-docs.asf.alaska.edu/gunw/)
- [ASF NISAR availability overview](https://hyp3-docs.asf.alaska.edu/nisar-docs/availability-overview/)
- [NASA OPERA DISP product suite](https://www.earthdata.nasa.gov/data/projects/nsite/solutions/opera-north-america-disp-product-suite)
- [Sadeghi Chorsi, Meyer and Dixon (2024)](https://tc.copernicus.org/articles/18/3723/2024/)
- [Liu et al. (2014), Anaktuvuk fire subsidence](https://pubs.usgs.gov/publication/70114502)
- [Hjort et al. (2022), permafrost and infrastructure](https://www.nature.com/articles/s43017-021-00247-8)

## Preservation rule

No project file should be deleted during this build. If a future change removes a file from active use, move it into `recycle/` so it remains recoverable.

