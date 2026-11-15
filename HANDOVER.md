# Prescient — handover notes (2026-11-15)

NASA Space Apps 2026, "Dancing with the SARs". Web app (React 19 + Vite 7 + MapLibre globe +
Zustand) that turns NISAR radar into permafrost risk hotspots. Working copy:
`NASA space apps/SpaceApps` (git branch `claudevamped`, tracking origin). Project docs:
`nisar-risk-predict-users.md` (risk framework + users, parent folder), Google Doc "NASA sac"
(tab "STORY MODE" = Preamble script), funder doc "How Prescient Works"
(https://claude.ai/artifact/4kbow1WmmP2oThERLjy1H9, private until shared).

## OPEN DECISION — read first

**The hazard must be the multi-year TREND, not seasonal movement.** That was the premise from
the start (`nisar-risk-predict-users.md`: long-term ground-motion trend over many 12-day
cycles; seasonal thaw sinking is the normal active-layer cycle). The current risk calculation
(`scripts/risk.mjs`) wrongly uses the *seasonal* Stefan-fit movement as hazard — must be fixed.

- NISAR public data over the sites starts mid-2026: **one season only, no trend possible yet**.
- Multi-year InSAR that exists (the plan was always to use historical InSAR):
  - **OPERA DISP-S1** (Sentinel-1, NASA/JPL, CMR collection `C3294057315-ASF`): Fairbanks
    401 granules 2016-07 → 2025-06; Barry Arm 103 granules 2016-07 → 2023-09; **North America
    only** (no Ulaanbaatar/Asia/Alps). **Harmony cannot subset it** → full-file downloads.
  - Alps: Copernicus EGMS (European Ground Motion Service, Sentinel-1 velocities, free account).
  - Elsewhere: ASF HyP3 on-demand Sentinel-1 InSAR (free with Earthdata login, needs processing).
- Option A (no new data): hazard = permafrost presence (ESA CCI) × closeness of ground to
  thawing (ERA5-Land 1–3 m temperature); NISAR movement shown as "seasonal, normal" context;
  trend "arrives as NISAR builds its record". Option B: OPERA trends for the Alaska sites.
  User leaned toward wanting historical InSAR trends; not yet decided. User does NOT want more
  feature creep — fix the science with minimal additions.

Scientifically sound chain agreed with the user (each must pass for *permafrost* hazard):
1. Permafrost present? (ESA CCI PFR) — none → permafrost hazard 0.
2. Thermal state: how close to 0 °C (ERA5-Land deep soil), thaw-season anomaly.
3. Attribution: movement shaped like thaw (Stefan, √ADDT); 4. ground ice (IPA map NSIDC
   GGD318 is behind a login form — not downloaded; NISAR cannot measure ice directly, only
   infer via seasonal sinking ≈ 0.09 × ice/water content × thaw depth, ReSALT idea);
5. rule out look-alikes (groundwater: steady; construction: local/sudden; landslide: sideways,
   orbits disagree; seasonal frost: fails step 1). Hazard → Risk = f(H, E, V, C) (UNDRR/IPCC).
   The real danger signal is net non-recovering sinking + acceleration (multi-year).

## Data pipeline (all via APIs, nothing large stored)

| Script | What | Notes |
|---|---|---|
| `npm run data:gcov -- --site=X` | NISAR GCOV via CMR + Harmony | all 10 sites done |
| `npm run data:gunw -- --site=X` | NISAR GUNW (`C2854335566-ASF`, provisional) | ionosphere-corrected, coherence ≥ 0.35, largest connected component, LOS = −λ/4π·φ (λ 0.2384 m, + = toward satellite, MintPy/HyP3 convention, sign sanity-checked at Goldstream), scene-median reference, 12-day chains, 1 km cells, then Stefan + risk. Done: fairbanks, ulaanbaatar, barry-arm, blatten, hohe-tauern, gyirong. Queue was running almaty → ala-archa → khorog → hunza (background shell; restart with the loop below if it died). |
| `node scripts/lib/stefan.mjs [sites]` | Stefan fit d = A·√ADDT + c per cell | NASA POWER T2M (no key) + ERA5-Land; one season → no trend term |
| `npm run data:climate` | ERA5-Land point time series (CDS, `reanalysis-era5-land-timeseries`) | t2m, soil L1, soil L4, 2016 → latest; zip of one CSV per variable; key in `.env` as `CDS_KEY`. Barry Arm grid cell is glacier (−7 °C) — flagged in app |
| `npm run data:capacity` | OSM Overpass: hospitals, clinics, fire/ambulance, police (+0.5° buffer) | all 10 done (`<site>/capacity.json`); Barry Arm 0 facilities. **Not yet used in risk.mjs** |
| `npm run data:risk` | per-cell risk + contour zones (`risk-zones.geojson`, `<site>/risk.json`) | **uses seasonal movement as hazard — wrong, see above**; V, C from `scripts/sites.mjs` estimates |
| `scripts/lib/permafrost-map.mjs` | ESA CCI Permafrost v5 2023 PFR, 0.01° | file in `data/raw/permafrost/` (git-ignored, from CEDA, 12 MB); 255 = no data → treat as 0; values: Fairbanks downtown 29%, UB centre 0%, UB north ger hills 71%, Goldstream ~3% (model limit). **Not yet wired into risk.** |

Sites (`scripts/sites.mjs`): fairbanks, barry-arm, blatten, hohe-tauern, gyirong, ulaanbaatar,
almaty, ala-archa, khorog, hunza (+ vulnerability/capacity estimates). Queue loop:
`for s in almaty ala-archa khorog hunza; do npm run data:gunw -- --site=$s; done`

Secrets: `NASA space apps/.env` holds `NASA_TOKEN` (Earthdata JWT) and `CDS_KEY`. Never read
or print it; scripts load it with `--env-file-if-exists=../.env`. `.env` is git-ignored.

## App state

- Name **Prescient** (renamed from Ground Truth North → Prescience → Prescient).
- Pages: Preamble (index, scroll story: Nepal flood photos → "Countless deaths…" → title card
  "But it doesn't have to be this way." → Blatten before/after wipe with overlay text →
  "However, not all places…" → "Humanity has the data." → Equal Earth map → "Save communities
  around the world now" → Map), Map, and **More** menu (blue → red glowing Tutorial pill folds
  in after arriving from Preamble → purple; resets every load, no storage/cookies): Tutorial
  (spotlight tour, Space/→/click), Stories (Rasuwa 2026, Norilsk 2020, Denali Pretty Rocks +
  papers), Demo disclaimer (data status + privacy section + "Prescient is still in its demo
  phase"), About (How Prescient works flowchart + old evidence page).
- More pages open/close with a macOS-style genie (WebGL mesh over an html-to-image snapshot
  with embedded Latin fonts; canvas fallback; `src/components/Genie.tsx`).
- Map: hotspot dropdown ("Permafrost risk hotspots", on/off master switch), NISAR sites menu
  (with demo note), layers (hotspots default, NISAR ground movement, brightness change, radar,
  land cover), computed risk zones morph from glow (far) → cell heat → outlined bands (near),
  hover pop-ups on zones and demo glows; demo hotspots (36, hand-built, `src/data/hotspots.ts`)
  are glows only (no rings); open-ocean selections show "Open water".
- Panel: computed risk block (peak-first), demo hotspot block, "This summer's thaw · ERA5-Land",
  "Ground movement · NISAR" with Stefan theory depth + collapsible cross-checks (two orbits;
  NASA POWER vs ERA5-Land thaw timing), NISAR GCOV block, climate phenomena split into
  "What we can predict" / "What we can measure".
- Tests: `npx vitest run` (26 pass), `npx tsc -b`, `npx vite build` all passing at handover.

## Still to do

1. Decide trend source (above) and fix hazard in `scripts/risk.mjs`; wire in ESA CCI
   permafrost presence and OSM capacity; relabel seasonal movement as normal context.
2. Phone layout check (not done yet) — fix layout only.
3. Remaining GUNW sites (queue), then `npm run data:risk`.
4. Verify facts/figures before presenting: death tolls and dates in hotspots/stories (from
   memory), Stefan edaphic range 0.02–0.035, ReSALT citations, AP/Planet image copyright for
   public deployment.
5. User preferences: don't over-add features; keep wording non-contradictory; label every
   estimate; no cookies/tracking; never read `.env`; ask before large downloads/pushes.

## Update 2026-11-15 (evening, submission day)

- Hazard fixed in `scripts/risk.mjs`: H = P (ESA CCI permafrost fraction) × T (ERA5-Land 1–2.89 m
  soil, −5 °C → 0, −1 °C → 1) × M (OPERA multi-year net sinking, 1 cm/yr = 1, from
  `<site>/trend.json`; else NISAR 2026 thaw-shaped seasonal sinking, r² ≥ 0.3, 5 cm = 1, marked
  "trend pending"). H = 0 → risk 0. Capacity stays a hand estimate; OSM capacity not used.
- Scope split: (1) thaw under people = scored; (2) downstream floods/landslides/avalanches =
  listed under "What we can predict" as not yet available (needs flow paths).
- Citations: UNDRR only for the four-factor H, E, V, C; IPCC counts capacity inside vulnerability.
  Score called a "risk index"; geometric mean stated as our choice.
- `npm run data:trend -- --site=fairbanks` (scripts/opera-trend.mjs) reads 14 DISP-S1 files
  (7 ministacks chained, late-summer dates 2016–2025). BLOCKED: ASF download returns 401 →
  approve "Alaska Satellite Facility Data Access" in Earthdata (Applications). Sign convention
  and variable names (displacement, x, y, spatial_ref) unverified until a file is opened.
