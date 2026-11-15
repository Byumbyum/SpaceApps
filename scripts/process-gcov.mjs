// Turn NISAR L2 GCOV subsets into small web layers.
//
//   node --env-file=.env scripts/process-gcov.mjs [--site=fairbanks] [--dry-run]
//   … --job=<harmony job id>  reattach to a Harmony job already submitted for this site
//   node scripts/process-gcov.mjs --source=local [--raw=data/raw] [--out=…]
//
// Sources (scripts/lib/nasa-sources.mjs):
//   api (default)  CMR finds the granules for the site in scripts/sites.mjs; NASA Harmony crops
//                  them to the site and returns GeoTIFFs, read straight into memory. Land cover
//                  is range-read from the public ESA WorldCover bucket. Nothing is saved to disk.
//   local          NISAR_L2_PR_GCOV_*_frequencyA_{HHHH,HVHV}_subsetted.tif in --raw, and
//                  ESA_WorldCover_10m_2021_v200_*_Map.tif in --raw/landcover.
// Inputs are gamma0 in linear power on EPSG:3413.
// Outputs: public/data/nisar/gcov.json          passes, footprint, 1 km cell time series + land-cover breakdown
//          public/data/nisar/gcov-composite.png latest 10 m pass, dual-pol false colour
//          public/data/nisar/gcov-change.png    early → late summer HH change (dB), per-track then median
//          public/data/nisar/landcover.png      ESA WorldCover classes on the same grid
//
// Permanent water (WorldCover class 80) is removed from every permafrost statistic, so
// "likely open water" measures water appearing on land. Built-up land is kept on purpose:
// infrastructure on thawing ground is the safety question.
//
// GCOV is backscatter, not displacement. Brightness responds to soil moisture, standing
// water, vegetation and freeze/thaw; it is an indicator for follow-up, never proof of thaw.
// Changes are always computed within one track (same viewing geometry) before averaging.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { findGranules, harmonySubset, harmonyUrl, listLocal, preferTenMetre, worldcoverTiles } from './lib/nasa-sources.mjs';
import { writeSiteIndex } from './lib/site-index.mjs';
import { SITES } from './sites.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value] = arg.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const SITE_ID = args.site ?? 'fairbanks';
const SITE = SITES[SITE_ID];
if (!SITE) throw new Error(`Unknown site "${SITE_ID}". Known: ${Object.keys(SITES).join(', ')}`);
const SOURCE = args.source ?? 'api';
const RAW = path.resolve(args.raw ?? 'data/raw');
const OUT = path.resolve(args.out ?? SITE.out);
const VARIABLES = ['/science/LSAR/GCOV/grids/frequencyA/HHHH', '/science/LSAR/GCOV/grids/frequencyA/HVHV'];
const BLOCK_M = 40; // working grid for change maps
const CELL_BLOCKS = 25; // 25 × 40 m = 1 km summary cells
const WATER_DB = -18; // HH gamma0 below this is treated as likely open water (dark, smooth surface)
const GAP = ['2026-07-27', '2026-08-10']; // NISAR permanent thaw-season gap
const NAME = /NISAR_L2_PR_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_\w_(\d{8})T(\d{6})_.*_frequencyA_(HHHH|HVHV)(_[a-z]+)*\.tiff?$/;

// EPSG:3413 (WGS 84 / NSIDC Sea Ice Polar Stereographic North) → lon/lat.
const A = 6378137, E = 0.0818191908426, LAT_TS = (70 * Math.PI) / 180, LON0 = (-45 * Math.PI) / 180;
const MC = Math.cos(LAT_TS) / Math.sqrt(1 - E * E * Math.sin(LAT_TS) ** 2);
const TC = Math.tan(Math.PI / 4 - LAT_TS / 2) / ((1 - E * Math.sin(LAT_TS)) / (1 + E * Math.sin(LAT_TS))) ** (E / 2);
function toLonLat(x, y) {
  const t = (Math.hypot(x, y) * TC) / (A * MC);
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 8; i += 1) phi = Math.PI / 2 - 2 * Math.atan(t * ((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi))) ** (E / 2));
  return [Number((((LON0 + Math.atan2(x, -y)) * 180) / Math.PI).toFixed(5)), Number(((phi * 180) / Math.PI).toFixed(5))];
}

const db = (power) => 10 * Math.log10(power);
const round1 = (value) => (value === null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10);

// ---- 1. Inventory -------------------------------------------------------------
let rasters, landcoverRasters;
if (SOURCE === 'local') {
  rasters = await listLocal(RAW);
  landcoverRasters = (await listLocal(path.join(RAW, 'landcover'))).filter((item) => /ESA_WorldCover_.*_Map\.tif$/.test(item.name));
} else {
  const { collectionId, granules: found } = await findGranules({ shortName: 'NISAR_L2_GCOV_PROVISIONAL_V1', ...SITE });
  const granules = preferTenMetre(found);
  console.log(`${SITE.label}: CMR found ${found.length} GCOV granules ${SITE.start} → ${SITE.end}, requesting ${granules.length} (10 m preferred)`);
  if (!granules.length) throw new Error('No NISAR GCOV granules cover this site and date range yet.');
  if (args['dry-run']) {
    granules.forEach((granule) => console.log(`  ${granule.name}  (${(granule.sizeMb / 1024).toFixed(1)} GB full)`));
    console.log(`Harmony request:\n  ${harmonyUrl({ collectionId, granules, variables: VARIABLES, ...SITE })}`);
    process.exit(0);
  }
  rasters = await harmonySubset({ token: process.env.NASA_TOKEN, jobId: args.job, collectionId, granules, variables: VARIABLES, ...SITE });
  landcoverRasters = worldcoverTiles(SITE.bbox);
}
const files = rasters.map((item) => ({ item, name: item.name, match: NAME.exec(item.name) })).filter((entry) => entry.match);
const passes = new Map(); // key: track|dir|date → { files: {HHHH: [], HVHV: []} }
for (const { item, match } of files) {
  const [, cycle, track, dir, frame, mode, pol, ymd, hms, band] = match;
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  const key = `${track}|${dir}|${date}`;
  if (!passes.has(key)) passes.set(key, { key, cycle, track, dir, date, time: hms, frames: new Set(), pols: new Set(), byMode: {} });
  const pass = passes.get(key);
  pass.frames.add(frame);
  pass.pols.add(pol);
  (pass.byMode[mode] ??= { HHHH: [], HVHV: [] })[band].push(item);
}
// Prefer the 10 m (4005) acquisition when a pass also has 20 m files: modes calibrate differently.
for (const pass of passes.values()) {
  const mode = pass.byMode['4005']?.HHHH.length && pass.byMode['4005']?.HVHV.length ? '4005' : '2005';
  pass.files = pass.byMode[mode] ?? { HHHH: [], HVHV: [] };
  pass.resolution = mode === '4005' ? '10 m' : '20 m';
}
const passList = [...passes.values()].filter((pass) => pass.files.HHHH.length && pass.files.HVHV.length).sort((a, b) => a.date.localeCompare(b.date) || a.track.localeCompare(b.track));
if (!passList.length) throw new Error(`No GCOV frequencyA HHHH/HVHV pairs found (${SOURCE === 'local' ? RAW : 'Harmony output'})`);
console.log(`${files.length} GCOV layers → ${passList.length} passes on ${new Set(passList.map((p) => p.track + p.dir)).size} tracks`);

// ---- 2. Common 40 m grid from the first file's footprint ------------------------
const firstImage = await (await passList[0].files.HHHH[0].open()).getImage();
if (firstImage.getGeoKeys().ProjectedCSTypeGeoKey !== 3413) throw new Error("GCOV rasters are not on EPSG:3413; set outputCrs: 'EPSG:3413' for this site in scripts/sites.mjs");
const [X0, Y0, X1, Y1] = firstImage.getBoundingBox();
const GW = Math.round((X1 - X0) / BLOCK_M);
const GH = Math.round((Y1 - Y0) / BLOCK_M);
const CW = Math.ceil(GW / CELL_BLOCKS);
const CH = Math.ceil(GH / CELL_BLOCKS);
console.log(`Grid ${GW}×${GH} at ${BLOCK_M} m, ${CW}×${CH} cells of 1 km`);

// ---- 2b. Land cover (ESA WorldCover 2021, 10 m) resampled to the 40 m grid by majority -----
const WATER_CLASS = 80;
const LANDCOVER_CLASSES = {
  10: { label: 'Tree cover', color: '#006400' },
  20: { label: 'Shrubland', color: '#ffbb22' },
  30: { label: 'Grassland', color: '#ffff4c' },
  40: { label: 'Cropland', color: '#f096ff' },
  50: { label: 'Built-up', color: '#fa0000' },
  60: { label: 'Bare / sparse', color: '#b4b4b4' },
  70: { label: 'Snow and ice', color: '#f0f0f0' },
  80: { label: 'Permanent water', color: '#0064c8' },
  90: { label: 'Wetland', color: '#0096a0' },
  95: { label: 'Mangroves', color: '#00cf75' },
  100: { label: 'Moss and lichen', color: '#fae6a0' },
};
const landcover = new Uint8Array(GW * GH); // 0 = unknown
const lcFiles = [];
if (landcoverRasters.length) {
  const footprint = [toLonLat(X0, Y0), toLonLat(X1, Y0), toLonLat(X0, Y1), toLonLat(X1, Y1)];
  const lonMin = Math.min(...footprint.map(([lon]) => lon)) - 0.01, lonMax = Math.max(...footprint.map(([lon]) => lon)) + 0.01;
  const latMin = Math.min(...footprint.map(([, lat]) => lat)) - 0.01, latMax = Math.max(...footprint.map(([, lat]) => lat)) + 0.01;
  const tiles = [];
  for (const raster of landcoverRasters) {
    let image;
    try { image = await (await raster.open()).getImage(); } catch (error) { console.log(`  land cover tile ${raster.name} unavailable (${error.message})`); continue; }
    const [west, south, east, north] = image.getBoundingBox();
    if (east < lonMin || west > lonMax || north < latMin || south > latMax) continue;
    const [rx, ry] = image.getResolution();
    const window = [
      Math.max(0, Math.floor((lonMin - west) / rx)), Math.max(0, Math.floor((north - latMax) / -ry)),
      Math.min(image.getWidth(), Math.ceil((lonMax - west) / rx)), Math.min(image.getHeight(), Math.ceil((north - latMin) / -ry)),
    ];
    const [data] = await image.readRasters({ window, samples: [0] });
    lcFiles.push(raster.name);
    tiles.push({ west: west + window[0] * rx, north: north + window[1] * ry, rx, ry, width: window[2] - window[0], height: window[3] - window[1], data });
  }
  const sample = (lon, lat) => {
    for (const tile of tiles) {
      const col = Math.floor((lon - tile.west) / tile.rx), row = Math.floor((lat - tile.north) / tile.ry);
      if (col >= 0 && row >= 0 && col < tile.width && row < tile.height) return tile.data[row * tile.width + col];
    }
    return 0;
  };
  // Four 10 m samples per 40 m block; the most common class wins.
  const offsets = [[-15, -15], [15, -15], [-15, 15], [15, 15]];
  for (let by = 0; by < GH; by += 1) {
    for (let bx = 0; bx < GW; bx += 1) {
      const cx = X0 + (bx + 0.5) * BLOCK_M, cy = Y1 - (by + 0.5) * BLOCK_M;
      const votes = new Map();
      for (const [dx, dy] of offsets) {
        const value = sample(...toLonLat(cx + dx, cy + dy));
        if (value) votes.set(value, (votes.get(value) ?? 0) + 1);
      }
      let best = 0, bestVotes = 0;
      for (const [value, count] of votes) if (count > bestVotes) { best = value; bestVotes = count; }
      landcover[by * GW + bx] = best;
    }
  }
  console.log(`Land cover from ${tiles.length} WorldCover tile(s)`);
} else {
  console.log('No WorldCover tile found — skipping land cover');
}

// Average one or more files (frames / pol modes of the same pass) into the 40 m grid, in linear power.
async function toBlocks(rasters) {
  const sum = new Float64Array(GW * GH);
  const count = new Uint32Array(GW * GH);
  for (const raster of rasters) {
    const image = await (await raster.open()).getImage();
    const [fx0, , , fy1] = image.getBoundingBox();
    const [rx, ry] = image.getResolution();
    const width = image.getWidth();
    const [data] = await image.readRasters({ samples: [0] });
    for (let row = 0; row < image.getHeight(); row += 1) {
      const by = Math.floor((Y1 - (fy1 + (row + 0.5) * ry)) / BLOCK_M);
      if (by < 0 || by >= GH) continue;
      for (let col = 0; col < width; col += 1) {
        const value = data[row * width + col];
        if (!(value > 0) || !Number.isFinite(value)) continue;
        const bx = Math.floor((fx0 + (col + 0.5) * rx - X0) / BLOCK_M);
        if (bx < 0 || bx >= GW) continue;
        sum[by * GW + bx] += value;
        count[by * GW + bx] += 1;
      }
    }
  }
  const blocks = new Float32Array(GW * GH).fill(Number.NaN);
  for (let i = 0; i < blocks.length; i += 1) if (count[i] >= 2) blocks[i] = sum[i] / count[i];
  return blocks;
}

// ---- 3. Per-pass 40 m blocks and 1 km cell statistics ---------------------------
const cellStats = Array.from({ length: CW * CH }, () => ({ hh: [], hv: [], water: [] }));
const blocksByPass = [];
for (const [index, pass] of passList.entries()) {
  process.stdout.write(`\r  reading pass ${index + 1}/${passList.length} (${pass.date} track ${pass.track}${pass.dir})   `);
  const hh = await toBlocks(pass.files.HHHH);
  const hv = await toBlocks(pass.files.HVHV);
  blocksByPass.push({ hh, hv });
  const acc = Array.from({ length: CW * CH }, () => ({ hh: 0, hv: 0, n: 0, water: 0 }));
  let valid = 0;
  for (let by = 0; by < GH; by += 1) {
    for (let bx = 0; bx < GW; bx += 1) {
      const i = by * GW + bx;
      if (!(hh[i] > 0) || !(hv[i] > 0)) continue;
      valid += 1;
      if (landcover[i] === WATER_CLASS) continue;
      const cell = acc[Math.floor(by / CELL_BLOCKS) * CW + Math.floor(bx / CELL_BLOCKS)];
      cell.hh += hh[i];
      cell.hv += hv[i];
      cell.n += 1;
      if (db(hh[i]) < WATER_DB) cell.water += 1;
    }
  }
  pass.validFraction = valid / (GW * GH);
  acc.forEach((cell, c) => {
    const enough = cell.n >= CELL_BLOCKS * CELL_BLOCKS * 0.3;
    cellStats[c].hh.push(enough ? round1(db(cell.hh / cell.n)) : null);
    cellStats[c].hv.push(enough ? round1(db(cell.hv / cell.n)) : null);
    cellStats[c].water.push(enough ? Math.round((cell.water / cell.n) * 1000) / 10 : null);
  });
}
process.stdout.write('\n');

// ---- 4. Early → late summer change map, computed per track then averaged ---------
const tracks = new Map();
passList.forEach((pass, index) => {
  const key = `${pass.track}${pass.dir} ${pass.resolution}`;
  if (!tracks.has(key)) tracks.set(key, { early: [], late: [] });
  if (pass.date < GAP[0]) tracks.get(key).early.push(index);
  else if (pass.date > GAP[1]) tracks.get(key).late.push(index);
});
const trackDiffs = []; // one Float32Array of dB change per usable track
let tracksUsed = 0;
for (const { early, late } of tracks.values()) {
  if (!early.length || !late.length) continue;
  tracksUsed += 1;
  const mean = (indices, i) => {
    let sum = 0, n = 0;
    for (const index of indices) { const v = blocksByPass[index].hh[i]; if (v > 0) { sum += v; n += 1; } }
    return n ? sum / n : Number.NaN;
  };
  const diff = new Float32Array(GW * GH).fill(Number.NaN);
  for (let i = 0; i < GW * GH; i += 1) {
    const before = mean(early, i), after = mean(late, i);
    if (before > 0 && after > 0) diff[i] = db(after) - db(before);
  }
  trackDiffs.push(diff);
}
// Median across tracks: a radiometric seam in a single track cannot print through.
const change = new Float32Array(GW * GH).fill(Number.NaN);
const changeCount = new Uint16Array(GW * GH);
for (let i = 0; i < GW * GH; i += 1) {
  const values = trackDiffs.map((diff) => diff[i]).filter(Number.isFinite).sort((a, b) => a - b);
  changeCount[i] = values.length;
  if (values.length) change[i] = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
}
console.log(`Change map uses ${tracksUsed} tracks with passes before and after the gap`);

// ---- 5. PNG overlays -------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
function writePng(file, pixel) {
  const png = new PNG({ width: GW, height: GH });
  for (let i = 0; i < GW * GH; i += 1) {
    const [r, g, b, a] = pixel(i);
    png.data.set([r, g, b, a], i * 4);
  }
  writeFileSync(path.join(OUT, file), PNG.sync.write(png));
}
const scale = (value, lo, hi) => Math.max(0, Math.min(255, Math.round(((value - lo) / (hi - lo)) * 255)));

const latest = passList.reduce((best, pass, index) => (pass.resolution === '10 m' && pass.validFraction > 0.5 ? index : best), passList.length - 1);
const { hh: lhh, hv: lhv } = blocksByPass[latest];
// 2–98 % stretch per channel so the false colour reflects this scene, not fixed limits.
const channels = { r: [], g: [], b: [] };
for (let i = 0; i < GW * GH; i += 1) {
  if (!(lhh[i] > 0) || !(lhv[i] > 0)) continue;
  const h = db(lhh[i]), v = db(lhv[i]);
  channels.r.push(h); channels.g.push(v); channels.b.push(h - v);
}
const limits = Object.fromEntries(Object.entries(channels).map(([key, values]) => {
  values.sort((a, b) => a - b);
  return [key, [values[Math.floor(values.length * 0.02)], values[Math.floor(values.length * 0.98)]]];
}));
writePng('gcov-composite.png', (i) => {
  if (!(lhh[i] > 0) || !(lhv[i] > 0)) return [0, 0, 0, 0];
  const h = db(lhh[i]), v = db(lhv[i]);
  return [scale(h, ...limits.r), scale(v, ...limits.g), scale(h - v, ...limits.b), 240];
});

// Diverging ramp: darker (orange) ← 0 → brighter (blue). ±2 dB saturates; |change| < 0.3 dB is transparent.
const ramp = (d) => {
  const t = Math.max(-1, Math.min(1, d / 2));
  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  return t < 0 ? [mix(247, 230, -t), mix(247, 97, -t), mix(247, 1, -t)] : [mix(247, 26, t), mix(247, 115, t), mix(247, 232, t)];
};
// Only show pixels seen by most tracks, so swath edges do not print as stripes.
const minTracks = Math.max(1, Math.ceil(tracksUsed * 0.6));
writePng('gcov-change.png', (i) => {
  if (changeCount[i] < minTracks || landcover[i] === WATER_CLASS) return [0, 0, 0, 0];
  const d = change[i];
  if (Math.abs(d) < 0.3) return [0, 0, 0, 0];
  return [...ramp(d), Math.round(70 + Math.min(1, Math.abs(d) / 2) * 185)];
});

const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
if (lcFiles.length) {
  writePng('landcover.png', (i) => {
    const entry = LANDCOVER_CLASSES[landcover[i]];
    return entry ? [...hexToRgb(entry.color), 200] : [0, 0, 0, 0];
  });
}

// Per-cell land-cover share and mean summer change per class (permanent water excluded).
const cellClasses = Array.from({ length: CW * CH }, () => new Map());
for (let by = 0; by < GH; by += 1) {
  for (let bx = 0; bx < GW; bx += 1) {
    const i = by * GW + bx;
    const cls = landcover[i];
    if (!cls || cls === WATER_CLASS || !(blocksByPass[latest].hh[i] > 0 || changeCount[i])) continue;
    const classes = cellClasses[Math.floor(by / CELL_BLOCKS) * CW + Math.floor(bx / CELL_BLOCKS)];
    const entry = classes.get(cls) ?? { blocks: 0, changeSum: 0, changeBlocks: 0 };
    entry.blocks += 1;
    if (changeCount[i] >= minTracks && Number.isFinite(change[i])) { entry.changeSum += change[i]; entry.changeBlocks += 1; }
    classes.set(cls, entry);
  }
}

// ---- 6. Summary JSON -----------------------------------------------------------
const cells = [];
for (let cy = 0; cy < CH; cy += 1) {
  for (let cx = 0; cx < CW; cx += 1) {
    const stats = cellStats[cy * CW + cx];
    if (stats.hh.every((value) => value === null)) continue;
    const x = X0 + (cx + 0.5) * CELL_BLOCKS * BLOCK_M;
    const y = Y1 - (cy + 0.5) * CELL_BLOCKS * BLOCK_M;
    const lc = [...cellClasses[cy * CW + cx]].sort((a, b) => b[1].blocks - a[1].blocks)
      .map(([cls, entry]) => [cls, entry.blocks, entry.changeBlocks ? round1(entry.changeSum / entry.changeBlocks) : null]);
    cells.push({ id: `g${cy}-${cx}`, center: toLonLat(x, y), ...stats, lc });
  }
}
const corners = [toLonLat(X0, Y1), toLonLat(X1, Y1), toLonLat(X1, Y0), toLonLat(X0, Y0)];
const summary = {
  product: 'NISAR L2 GCOV',
  maturity: 'PROVISIONAL',
  quantity: 'gamma0 backscatter (dB), frequency A',
  generated_at: new Date().toISOString(),
  site: { id: SITE_ID, label: SITE.label, bbox: SITE.bbox, note: SITE.note ?? null },
  source: SOURCE === 'local' ? 'local GeoTIFF subsets' : 'NASA CMR + Harmony (NISAR_L2_GCOV_PROVISIONAL_V1)',
  crs_source: 'EPSG:3413',
  corners, // top-left, top-right, bottom-right, bottom-left (lon, lat) for map image sources
  gap: GAP,
  landcover: lcFiles.length ? { source: 'ESA WorldCover 10 m 2021 v200 (CC BY 4.0)', excluded: [WATER_CLASS], classes: LANDCOVER_CLASSES } : null,
  water_threshold_db: WATER_DB,
  composite_date: passList[latest].date,
  composite_track: `${passList[latest].track}${passList[latest].dir}`,
  tracks_in_change_map: tracksUsed,
  passes: passList.map((pass) => ({
    date: pass.date,
    track: `${pass.track}${pass.dir}`,
    direction: pass.dir === 'A' ? 'ascending' : 'descending',
    resolution: pass.resolution,
    polarization: [...pass.pols].join('/'),
    valid_fraction: Math.round(pass.validFraction * 1000) / 1000,
  })),
  cells,
};
writeFileSync(path.join(OUT, 'gcov.json'), JSON.stringify(summary));
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: gcov.json (${cells.length} cells), gcov-composite.png (${summary.composite_date}), gcov-change.png`);
if (!args.out) writeSiteIndex();
