# Space Apps implementation checkpoint

Last updated: 2026-11-14 (Asia/Makassar)

## Scope and constraints confirmed

- Preserve every existing file. If a file ever needs to be removed, move it into `recycle/`; do not delete it.
- Build the full local repository described by `# Mega prompt NISAR permafrost grou.txt`, `ui.txt`, and the newer revisions in `Dalton_Corridor_Permafrost_Plan_Redline.html`.
- Treat the redline as the newest requirement where it changes the mega prompt.
- Explore mode is the default landing experience and treats the interactive map as the primary interface; Story remains available from navigation.
- Use separate measurement-quality (`Q`) and thaw-interpretation (`E`) indices. Neither is a probability.
- Hard exclusions precede scoring. A true zero in an available positive-weight factor yields zero. Missing factors are shown as not assessed and weights are renormalized over available factors.
- Every result is labelled `OBSERVED`, `INFERRED`, or `PUBLISHED`.
- Demo data must be visibly labelled on every app screen.
- NISAR summer 2026 is always marked `PROVISIONAL`; the 27 Jul–10 Aug 2026 gap must be visible anywhere that series appears.

## Source files reviewed

- `# Mega prompt NISAR permafrost grou.txt`
- `ui.txt`
- `Dalton_Corridor_Permafrost_Plan_Redline.html`
- `README.md`

## Completed sections

- React 19 + TypeScript + Vite scaffold with MapLibre, Recharts, Zustand, Vitest, and responsive styling.
- Shared `config/scoring.config.json` for Q, E, exclusions, bands, and infrastructure monitoring priority.
- Matching TypeScript and Python scoring implementations and unit tests.
- Offline Python pipeline package with ADDT, trend/thermal fit, LOS corrections, guarded vertical conversion, segment anomaly, and local product provenance inspection.
- Deterministic `demo/generate_demo.py` output in `public/data/`: manifest, 160 map cells, road/pipeline segments, and Sentinel-1/NISAR time series.
- Story-mode landing page with all nine chapters and observation/inference/published evidence splits.
- Explore mode with 2D MapLibre map, paint select/deselect tools, time and season controls, map layers, time series, gap marker, Q/E summaries, factor-level Why panel, monitoring-priority segments, context, and interpretation guide.
- About-the-data page with source register, reference disclosure, processing order, limitations, and open team decisions.
- Demo banner and NISAR `PROVISIONAL` state are global and remain visible across modes.

## Current execution state

- Demo generation succeeded and all generated JSON/GeoJSON files parse.
- Dependencies installed successfully. MapLibre was upgraded from the requested v5 line to patched v6.18 because `npm audit` found a critical sanitizer advisory affecting versions through 6.4.0.
- `npm audit`: 0 vulnerabilities.
- `npm run build`: passed; Story/About/Explore are split into separate production chunks.
- `npm test`: 6/6 frontend scoring and interaction tests passed across 3 test files.
- `python -m pytest pipeline/tests`: 6/6 Python science/scoring tests passed.
- Wording-rule audit across source, config, data, pipeline, demo and README: no banned phrasing found.
- Local HTTP checks: app root 200; demo cells GeoJSON 200.
- Browser screenshot QA could not be completed because the browser access host was unavailable and Chrome access was not approved by the environment. This is the only outstanding verification limit.
- No file has been deleted or moved out of place. The existing `README.md` was expanded in place; no `recycle/` move has been necessary.

## Handover / next optional section

1. When browser control is available, perform screenshot QA at 1440 × 900, 1280 × 800, and tablet width; verify Story chapter changes, Explore layer switches, map paint/erase, and sidebar scrolling.
2. Review and approve the candidate control-tundra polygon and stable reference area before importing real data.
3. Download a small authenticated NISAR GUNW / OPERA DISP-S1 sample, run the provenance inspector, and map the exact dataset paths for the correction layers.
4. Replace demo layers independently only when their manifest/provenance records are complete; keep the demo banner until no synthetic layer remains.

## Map reliability repair

Completed after the first handover:

- MapLibre now starts from and refits to the exact MVP bounds instead of relying on a hard-coded zoom.
- The style object is cloned for each map instance, avoiding development-mode remount reuse.
- Map initialization and layer creation are guarded; loading, timeout, and error states are visible rather than appearing as a blank panel.
- A non-WebGL compatibility map now preserves layer colouring, high-quality filtering, cell inspection, paint selection, and deselection when MapLibre cannot start.
- Added an automated fallback interaction test. Frontend result: 5/5 tests passing; production build passing.
- Follow-up black-panel repair: the compatibility grid is now rendered immediately underneath MapLibre, and the WebGL canvas is revealed only after `queryRenderedFeatures` confirms at least one visible analysis cell. A second bounds fit is attempted before falling back permanently.

## Real-map reference overlay

- Added the official OpenStreetMap raster tile endpoint as the contextual basemap, below all analysis layers, with visible attribution.
- Added explicit WGS 84 centroid `latitude` and `longitude` fields to all 160 generated cells.
- Added point markers and safe coordinate popups to the MapLibre view.
- Added coordinate disclosure for the focused cell in the Why panel.
- Added a small attributed OSM tile mosaic beneath the compatibility grid so real geographic context remains visible without WebGL.
- Reduced analysis-fill opacity so roads, rivers and place context remain legible beneath the data.
- Production build and 5/5 frontend tests pass after regeneration.

## Map-first Alaska exploration redesign

Completed after the real-map overlay:

- Explore is now the default route/state. The map occupies the viewport beneath the persistent header, while tools and results float above it.
- The initial camera and `Alaska overview` control use the exact requested focus rectangle: `(73,-176)`, `(73,-124)`, `(50,-124)`, `(50,-176)`.
- The focus rectangle is drawn as a pale dashed overlay. A separate red outline marks the much smaller Northern Dalton extent for which demo analysis cells are currently precomputed, preventing Alaska-wide coverage from being implied.
- Familiar map interactions remain native: pointer/touch pan, wheel/pinch zoom, compass, zoom buttons, scale, recenter, and two extent shortcuts.
- Paint-select and paint-deselect remain custom cursors. Choosing either tool from the Alaska overview automatically brings the processed cells into a usable view.
- Selecting cells now opens a prominent on-map insight card with median relative motion plus explicitly limited safety, health, and economy interpretations.
- Detailed charts, quality factors, time series, coordinates, and source evidence stay available in an optional right-side drawer opened with `Explore data` or the insight card.
- Added an automated selection-insight test covering the three impact summaries and optional drawer action.
- Verification: production build passes; frontend tests pass 6/6 across 3 test files.
- No files were deleted or replaced; `recycle/` remains available if a future removal is required.

## Google-Maps-style map revamp (2026-11-14)

- Root cause of the unusable map: MapLibre 6 resolves its web worker relative to its own module; Vite dependency pre-bundling broke that path, so the WebGL map never started and the app always showed the fake "compatibility grid". Fixed with `maplibregl.setWorkerUrl()` pointing at the shipped worker (`maplibre-gl-worker.mjs?url`).
- New full-bleed map: OpenFreeMap Liberty vector basemap (no API key) and an Esri World Imagery satellite view with the vector roads/labels on top (hybrid). Globe projection at low zoom. Google-style search (local permafrost places + Nominatim on Enter), zoom/compass controls, Map/Satellite thumbnail toggle, layers menu (Northern Dalton demo grid, off by default).
- Selection: click anywhere selects a circle scaled to the zoom level; "Draw area" drags a box. Areas are reverse-geocoded for a readable name.
- Insights panel (left): permafrost metrics + Safety/Health/Economy impact rows, "View detailed insights" opens the right drawer, and a bottom "Climate phenomenon" toggle. Non-permafrost phenomena show "Coming soon… View other parameters!" on the map.
- All numbers in the panel/drawer come from `src/lib/placeholderInsights.ts` (deterministic sample values, labelled as such). Replace that module when real products are processed.
- UI restyled to a clean light theme; all eyebrow/kicker labels removed. Demo-data notice is now a header chip.
- Windows Application Control blocks Rollup's native binary in this folder, so `rollup` is aliased to `@rollup/wasm-node` (devDependency + override). The previous lockfile is in `recycle/package-lock.native-rollup.json`; pre-revamp copies of replaced files are in `recycle/pre-map-revamp/`.
- `ToolDock`, `SelectionInsight` and `AnalysisSidebar` are no longer rendered but are kept in place.
- Verification: `npm test` 9/9 passing; `npm run build` passing; checked in Chrome (map, search, click/draw selection, satellite, drawer, coming-soon, Story, About).
