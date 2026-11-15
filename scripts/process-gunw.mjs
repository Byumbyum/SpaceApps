// NISAR L2 GUNW → summer ground movement for one site, pulled through NASA's APIs.
//
//   npm run data:gunw -- --site=fairbanks [--dry-run] [--job=<harmony job id>]
//
// For each orbit track it picks one unbroken chain of consecutive interferograms
// (12-day pairs, bridging the thaw-season gap where NISAR flew a longer pair), asks
// Harmony for small cut-outs of four layers, and adds the pairs up into cumulative
// line-of-sight (LOS) displacement:
//
//   1. corrected phase = unwrappedPhase − ionospherePhaseScreen  (both radians; the
//      ionosphere estimate ships in the product but is not applied to it)
//   2. keep pixels with coherence ≥ 0.35 in the pair's largest connected component
//      (other components carry unknown 2π offsets)
//   3. LOS displacement = −λ/(4π) × phase, positive = toward the satellite
//      (MintPy / ASF HyP3 convention; NISAR L-band λ = 0.2384 m)
//   4. reference each pair to its own scene median, so values are relative motion
//
// Troposphere and solid-earth-tide corrections are not applied yet; over a few tens of
// km they mostly cancel in the scene-median reference. Output: <site>/gunw.json (1 km
// cells, cumulative cm per track) and gunw-motion.png (80 m map of the longest chain).

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { findGranules, harmonySubset, harmonyUrl } from './lib/nasa-sources.mjs';
import { writeSiteIndex } from './lib/site-index.mjs';
import { addStefan } from './lib/stefan.mjs';
import { SITES } from './sites.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value] = arg.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const SITE_ID = args.site ?? 'fairbanks';
const SITE = SITES[SITE_ID];
if (!SITE) throw new Error(`Unknown site "${SITE_ID}". Known: ${Object.keys(SITES).join(', ')}`);
const OUT = path.resolve(args.out ?? SITE.out);

const LAYERS = ['unwrappedPhase', 'coherenceMagnitude', 'connectedComponents', 'ionospherePhaseScreen'];
const VARIABLES = LAYERS.map((layer) => `/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/${layer}`);
const WAVELENGTH_M = 0.2384;
const MIN_COHERENCE = 0.35;
const BLOCK_M = 80; // GUNW posting
const CELL_BLOCKS = 12; // 12 × 80 m ≈ 1 km summary cells
const MIN_CELL_PIXELS = 15;
const NOMINAL_INCIDENCE_DEG = 37; // mid-swath; only used to show a rough vertical equivalent
// ref cycle, track, dir, frame, sec cycle, mode, pol, ref date, sec date
const GRANULE = /NISAR_L2_PR_GUNW_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{3})_(\d{4})_(\w{2})_(\d{8})T\d{6}_\d{8}T\d{6}_(\d{8})T\d{6}/;
const LAYER = new RegExp(`unwrappedInterferogram_HH_(${LAYERS.join('|')})(_[a-z]+)*\\.tiff?$`);

const isoDate = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
const round2 = (value) => (value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100);

// Polar stereographic (EPSG:3413) → lon/lat, as in process-gcov.
const A = 6378137, E = 0.0818191908426, LAT_TS = (70 * Math.PI) / 180, LON0 = (-45 * Math.PI) / 180;
const MC = Math.cos(LAT_TS) / Math.sqrt(1 - E * E * Math.sin(LAT_TS) ** 2);
const TC = Math.tan(Math.PI / 4 - LAT_TS / 2) / ((1 - E * Math.sin(LAT_TS)) / (1 + E * Math.sin(LAT_TS))) ** (E / 2);
function toLonLat(x, y) {
  const t = (Math.hypot(x, y) * TC) / (A * MC);
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 8; i += 1) phi = Math.PI / 2 - 2 * Math.atan(t * ((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi))) ** (E / 2));
  return [Number((((LON0 + Math.atan2(x, -y)) * 180) / Math.PI).toFixed(5)), Number(((phi * 180) / Math.PI).toFixed(5))];
}

// ---- 1. Pick one chain of consecutive pairs per track ---------------------------
const { collectionId, granules } = await findGranules({ shortName: 'NISAR_L2_GUNW_PROVISIONAL_V1', ...SITE });
const parsed = granules.map((granule) => {
  const m = GRANULE.exec(granule.name);
  return m ? { ...granule, track: `${m[2]}${m[3]}`, frame: m[4], mode: m[6], ref: isoDate(m[8]), sec: isoDate(m[9]) } : null;
}).filter(Boolean);
const groups = new Map();
for (const pair of parsed) {
  const key = `${pair.track}|${pair.frame}|${pair.mode}`;
  groups.set(key, [...(groups.get(key) ?? []), pair]);
}
const chains = [];
for (const [key, pairs] of groups) {
  const byRef = new Map();
  for (const pair of pairs) byRef.set(pair.ref, [...(byRef.get(pair.ref) ?? []), pair].sort((a, b) => a.sec.localeCompare(b.sec)));
  const chain = [];
  let at = [...byRef.keys()].sort()[0];
  while (byRef.has(at)) { const next = byRef.get(at)[0]; chain.push(next); at = next.sec; }
  if (chain.length >= 2) chains.push({ key, track: chain[0].track, frame: chain[0].frame, mode: chain[0].mode, pairs: chain });
}
chains.sort((a, b) => b.pairs.length - a.pairs.length);
const wanted = chains.flatMap((chain) => chain.pairs);
console.log(`${SITE.label}: CMR found ${parsed.length} GUNW pairs; ${chains.length} chains → requesting ${wanted.length} pairs`);
chains.forEach((chain) => console.log(`  track ${chain.track} frame ${chain.frame} (mode ${chain.mode}): ${chain.pairs.map((pair) => pair.ref.slice(5)).join(' → ')} → ${chain.pairs.at(-1).sec.slice(5)}`));
if (!wanted.length) throw new Error('No chain of consecutive NISAR GUNW pairs covers this site yet.');
if (args['dry-run']) {
  console.log(`Harmony request:\n  ${harmonyUrl({ collectionId, granules: wanted, variables: VARIABLES, ...SITE, outputCrs: 'EPSG:3413' })}`);
  process.exit(0);
}

// ---- 2. Fetch cut-outs ----------------------------------------------------------
const rasters = await harmonySubset({ token: process.env.NASA_TOKEN, jobId: args.job, collectionId, granules: wanted, variables: VARIABLES, ...SITE, outputCrs: 'EPSG:3413' });
const filesByPair = new Map(); // granule name → { layer: item }
for (const item of rasters) {
  const granule = wanted.find((pair) => item.name.includes(pair.name));
  const layer = LAYER.exec(item.name)?.[1];
  if (!granule || !layer) continue;
  filesByPair.set(granule.name, { ...(filesByPair.get(granule.name) ?? {}), [layer]: item });
}

// Common 80 m grid from the site box (all requests share it, but extents can differ by a pixel).
const firstPair = [...filesByPair.values()].find((files) => files.unwrappedPhase);
if (!firstPair) throw new Error('Harmony returned no unwrappedPhase layers.');
const firstImage = await (await firstPair.unwrappedPhase.open()).getImage();
const crs = firstImage.geoKeys.ProjectedCSTypeGeoKey;
if (crs !== 3413) throw new Error(`Expected EPSG:3413 cut-outs, got EPSG:${crs}`);
const [X0, Y0, X1, Y1] = firstImage.getBoundingBox();
const GW = Math.round((X1 - X0) / BLOCK_M);
const GH = Math.round((Y1 - Y0) / BLOCK_M);
const CW = Math.ceil(GW / CELL_BLOCKS);
const CH = Math.ceil(GH / CELL_BLOCKS);
console.log(`Grid ${GW}×${GH} at ${BLOCK_M} m, ${CW}×${CH} cells of ~1 km`);

/** Read one layer onto the common grid (nearest pixel). */
async function onGrid(item) {
  const image = await (await item.open()).getImage();
  const [fx0, , , fy1] = image.getBoundingBox();
  const [rx, ry] = image.getResolution();
  const width = image.getWidth();
  const [data] = await image.readRasters({ samples: [0] });
  const nodata = image.getGDALNoData();
  const grid = new Float32Array(GW * GH).fill(Number.NaN);
  for (let row = 0; row < image.getHeight(); row += 1) {
    const by = Math.floor((Y1 - (fy1 + (row + 0.5) * ry)) / BLOCK_M);
    if (by < 0 || by >= GH) continue;
    for (let col = 0; col < width; col += 1) {
      const value = data[row * width + col];
      if (!Number.isFinite(value) || value === nodata) continue;
      const bx = Math.floor((fx0 + (col + 0.5) * rx - X0) / BLOCK_M);
      if (bx >= 0 && bx < GW) grid[by * GW + bx] = value;
    }
  }
  return grid;
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** One pair → LOS displacement increment in cm on the grid (NaN where unreliable). */
async function pairIncrement(files) {
  const [phase, coherence, components, ionosphere] = await Promise.all(LAYERS.map((layer) => (files[layer] ? onGrid(files[layer]) : null)));
  if (!phase || !coherence || !components) return null;
  const sizes = new Map();
  for (let i = 0; i < phase.length; i += 1) {
    const component = components[i];
    if (component > 0 && coherence[i] >= MIN_COHERENCE && Number.isFinite(phase[i])) sizes.set(component, (sizes.get(component) ?? 0) + 1);
  }
  const largest = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (largest === undefined) return null;
  const toCm = (-WAVELENGTH_M / (4 * Math.PI)) * 100;
  const increment = new Float32Array(GW * GH).fill(Number.NaN);
  const kept = [];
  for (let i = 0; i < phase.length; i += 1) {
    if (components[i] !== largest || !(coherence[i] >= MIN_COHERENCE) || !Number.isFinite(phase[i])) continue;
    const iono = ionosphere && Number.isFinite(ionosphere[i]) ? ionosphere[i] : 0;
    increment[i] = (phase[i] - iono) * toCm;
    kept.push(increment[i]);
  }
  const reference = median(kept);
  for (let i = 0; i < increment.length; i += 1) if (Number.isFinite(increment[i])) increment[i] -= reference;
  return { increment, validFraction: kept.length / increment.length };
}

// ---- 3. Accumulate each chain ---------------------------------------------------
const tracks = [];
for (const chain of chains) {
  const cumulative = new Float32Array(GW * GH); // 0 until a pixel breaks, then NaN
  const cellSeries = Array.from({ length: CW * CH }, () => [0]);
  const dates = [chain.pairs[0].ref];
  for (const pair of chain.pairs) {
    const files = filesByPair.get(pair.name);
    const result = files && (await pairIncrement(files));
    if (!result) { console.log(`  ${chain.track} ${pair.ref}→${pair.sec}: missing layers, chain stops here`); break; }
    const { increment, validFraction } = result;
    for (let i = 0; i < cumulative.length; i += 1) cumulative[i] = Number.isFinite(increment[i]) ? cumulative[i] + increment[i] : Number.NaN;
    // 1 km cell means of the cumulative map.
    const sums = new Float64Array(CW * CH);
    const counts = new Uint32Array(CW * CH);
    for (let by = 0; by < GH; by += 1) {
      for (let bx = 0; bx < GW; bx += 1) {
        const value = cumulative[by * GW + bx];
        if (!Number.isFinite(value)) continue;
        const cell = Math.floor(by / CELL_BLOCKS) * CW + Math.floor(bx / CELL_BLOCKS);
        sums[cell] += value;
        counts[cell] += 1;
      }
    }
    cellSeries.forEach((series, cell) => series.push(counts[cell] >= MIN_CELL_PIXELS ? round2(sums[cell] / counts[cell]) : null));
    dates.push(pair.sec);
    console.log(`  ${chain.track} ${pair.ref}→${pair.sec}: ${(validFraction * 100).toFixed(0)}% reliable pixels`);
  }
  if (dates.length < 3) continue;
  tracks.push({ key: chain.key, track: chain.track, direction: chain.track.endsWith('A') ? 'ascending' : 'descending', mode: chain.mode, dates, cumulative, cellSeries });
}
if (!tracks.length) throw new Error('No track kept at least two consecutive usable pairs.');

// ---- 4. Map image (longest chain) and outputs -----------------------------------
mkdirSync(OUT, { recursive: true });
const best = tracks.reduce((a, b) => (b.dates.length > a.dates.length ? b : a));
const png = new PNG({ width: GW, height: GH });
const LIMIT_CM = 6;
for (let i = 0; i < GW * GH; i += 1) {
  const value = best.cumulative[i];
  const o = i * 4;
  if (!Number.isFinite(value)) { png.data[o + 3] = 0; continue; }
  // Away from the satellite (likely sinking) = red, toward = blue.
  const t = Math.max(-1, Math.min(1, value / LIMIT_CM));
  const [r, g, b] = t < 0 ? [255, Math.round(255 * (1 + t)), Math.round(255 * (1 + t))] : [Math.round(255 * (1 - t)), Math.round(255 * (1 - t * 0.55)), 255];
  png.data.set([r, g, b, Math.round(90 + 165 * Math.abs(t))], o);
}
writeFileSync(path.join(OUT, 'gunw-motion.png'), PNG.sync.write(png));

const cells = [];
for (let cy = 0; cy < CH; cy += 1) {
  for (let cx = 0; cx < CW; cx += 1) {
    const cell = cy * CW + cx;
    const series = Object.fromEntries(tracks.map((track) => [track.key, track.cellSeries[cell]]));
    if (Object.values(series).every((values) => values.slice(1).every((value) => value === null))) continue;
    const x = X0 + (cx + 0.5) * CELL_BLOCKS * BLOCK_M;
    const y = Y1 - (cy + 0.5) * CELL_BLOCKS * BLOCK_M;
    cells.push({ id: `m${cy}-${cx}`, center: toLonLat(x, y), los: series });
  }
}
const summary = {
  product: 'NISAR L2 GUNW',
  maturity: 'PROVISIONAL',
  quantity: 'cumulative line-of-sight displacement (cm), positive = toward the satellite, relative to the scene median',
  generated_at: new Date().toISOString(),
  site: { id: SITE_ID, label: SITE.label, bbox: SITE.bbox },
  source: 'NASA CMR + Harmony (NISAR_L2_GUNW_PROVISIONAL_V1)',
  corrections: { ionosphere: 'applied (product ionosphere phase screen)', troposphere: 'not applied', solid_earth_tide: 'not applied', reference: 'scene median per pair' },
  wavelength_m: WAVELENGTH_M,
  min_coherence: MIN_COHERENCE,
  nominal_incidence_deg: NOMINAL_INCIDENCE_DEG,
  corners: [toLonLat(X0, Y1), toLonLat(X1, Y1), toLonLat(X1, Y0), toLonLat(X0, Y0)],
  map: { file: 'gunw-motion.png', track: best.key, limit_cm: LIMIT_CM, first: best.dates[0], last: best.dates.at(-1) },
  tracks: tracks.map(({ key, track, direction, mode, dates }) => ({ key, track, direction, mode, dates })),
  cells,
};
// Stefan thaw model against NASA POWER degree days; the movement still stands without it.
try {
  const fitted = await addStefan(summary, SITE);
  console.log(`Stefan thaw model (√ADDT, NASA POWER temperatures): fitted ${fitted} cells`);
} catch (error) {
  console.log(`Stefan thaw model skipped: ${error.message}`);
}
writeFileSync(path.join(OUT, 'gunw.json'), JSON.stringify(summary));
const totals = cells.map((cell) => cell.los[best.key]?.at(-1)).filter((value) => value !== null && value !== undefined);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: gunw.json (${cells.length} cells, ${tracks.length} tracks), gunw-motion.png`);
console.log(`Longest chain ${best.key}: ${best.dates[0]} → ${best.dates.at(-1)}; cell totals median ${round2(median(totals))} cm, range ${round2(Math.min(...totals))} to ${round2(Math.max(...totals))} cm`);
// Recompute risk zones for every site with ground movement (also refreshes the site index).
if (!args.out) await import('./risk.mjs');
