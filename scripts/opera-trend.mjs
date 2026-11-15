// Multi-year ground-motion trend per 1 km cell from OPERA DISP-S1 (NASA/JPL, Sentinel-1 InSAR,
// 2016 onwards, United States and nearby border areas only) → <site>/trend.json, read by scripts/risk.mjs.
//
//   npm run data:trend -- --site=fairbanks [--dry-run]
//
// DISP-S1 comes in "ministacks": every file holds displacement since its ministack's reference
// date, and each ministack's reference is the last date of the one before. Chaining the last
// file of every ministack gives one continuous record. Of those dates we fit the trend only
// to late-summer ones (1 Aug – 15 Oct, end of the thaw season), one per year, so the normal
// seasonal sink-and-heave cycle does not leak into the trend. Seasonal dates are added from
// inside the ministacks where a year has none.
//
// Files are downloaded whole (Harmony cannot subset DISP-S1) into data/raw/opera/
// (git-ignored) and only the site window is read. Needs NASA_TOKEN and the Earthdata app
// "Alaska Satellite Facility Data Access" approved.

import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import h5wasm from 'h5wasm/node';
import { SITES } from './sites.mjs';

const COLLECTION = 'C3294057315-ASF';
const RAW = 'data/raw/opera';
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const site = SITES[args.site];
if (!site) throw new Error(`--site=<${Object.keys(SITES).join('|')}>`);
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

// ---- 1. Granules over the site, best frame, files to fetch ----
const query = new URLSearchParams({ collection_concept_id: COLLECTION, bounding_box: site.bbox.join(','), page_size: '2000' });
const items = (await (await fetch(`https://cmr.earthdata.nasa.gov/search/granules.umm_json?${query}`)).json()).items ?? [];
if (!items.length) throw new Error('No OPERA DISP-S1 over this site (OPERA covers the US and nearby border areas only).');
const granules = items.map((item) => {
  const parts = item.umm.GranuleUR.split('_');
  const url = item.umm.RelatedUrls.find((u) => u.Type === 'GET DATA' && u.URL.startsWith('https') && u.URL.endsWith('.nc'))?.URL;
  return { name: item.umm.GranuleUR, frame: parts[4], ref: parts[6].slice(0, 8), sec: parts[7].slice(0, 8), url };
}).filter((g) => g.url);
const frames = Object.groupBy(granules, (g) => g.frame);
const span = (list) => Number(list.map((g) => g.sec).sort().at(-1)) - Number(list.map((g) => g.ref).sort()[0]);
const [frame, inFrame] = Object.entries(frames).sort(([, a], [, b]) => span(b) - span(a) || b.length - a.length)[0];

const stacks = Object.entries(Object.groupBy(inFrame, (g) => g.ref)).sort(([a], [b]) => a.localeCompare(b));
const lateSummer = (d) => { const md = d.slice(4); return md >= '0801' && md <= '1015'; };
const wanted = new Map();
for (const [, list] of stacks) {
  const sorted = list.sort((a, b) => a.sec.localeCompare(b.sec));
  wanted.set(sorted.at(-1).name, sorted.at(-1)); // chaining file
  // latest late-summer date of each year inside this ministack
  for (const year of new Set(sorted.map((g) => g.sec.slice(0, 4)))) {
    const late = sorted.filter((g) => g.sec.startsWith(year) && lateSummer(g.sec)).at(-1);
    if (late) wanted.set(late.name, late);
  }
}
const files = [...wanted.values()].sort((a, b) => a.sec.localeCompare(b.sec));
console.log(`${args.site}: frame ${frame}, ${stacks.length} ministacks ${stacks[0][0]} → ${inFrame.map((g) => g.sec).sort().at(-1)}, ${files.length} files to read`);
if (args['dry-run']) { files.forEach((g) => console.log(' ', g.ref, '→', g.sec)); process.exit(0); }

// ---- 2. Download (Earthdata token sent only to NASA hosts) ----
async function download(granule) {
  const file = path.join(RAW, `${granule.name}.nc`);
  if (existsSync(file)) return file;
  mkdirSync(RAW, { recursive: true });
  let url = granule.url;
  for (let hop = 0; hop < 6; hop += 1) {
    const host = new URL(url).host;
    const nasa = host.endsWith('earthdatacloud.nasa.gov') || host.endsWith('urs.earthdata.nasa.gov');
    const response = await fetch(url, { headers: nasa ? { Authorization: `Bearer ${process.env.NASA_TOKEN}` } : {}, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location'), url).href; continue; }
    if (!response.ok) throw new Error(`${response.status} downloading ${granule.name}: approve "Alaska Satellite Facility Data Access" at urs.earthdata.nasa.gov → Applications`);
    console.log(`  downloading ${granule.sec} (${Math.round(Number(response.headers.get('content-length')) / 1e6)} MB)`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${file}.part`));
    const { renameSync } = await import('node:fs');
    renameSync(`${file}.part`, file);
    return file;
  }
  throw new Error('Too many redirects');
}

// ---- 3. UTM forward projection (WGS84, Krüger series) ----
function toUtm(lon, lat, zone, north) {
  const a = 6378137; const f = 1 / 298.257223563; const k0 = 0.9996;
  const e2 = f * (2 - f); const ep2 = e2 / (1 - e2);
  const phi = (lat * Math.PI) / 180; const lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2); const T = Math.tan(phi) ** 2; const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * ((lon * Math.PI) / 180 - lam0);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const x = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const y = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720)) + (north ? 0 : 10000000);
  return [x, y];
}

// ---- 4. Cells: same 1 km cells as the NISAR GUNW grid ----
const { readFileSync } = await import('node:fs');
const gunw = JSON.parse(readFileSync(path.join(site.out, 'gunw.json'), 'utf8'));
const cells = gunw.cells.map((cell) => ({ id: cell.id, center: cell.center }));

await h5wasm.ready;
const series = cells.map(() => []); // per cell: [date, cumulative LOS m] at each file
let offsets = null; // per cell cumulative offset from earlier ministacks
let lastRef = null;
let signNote = '';
const dates = [];
for (const granule of files) {
  const file = new h5wasm.File(await download(granule), 'r');
  const disp = file.get('displacement');
  if (!signNote) signNote = JSON.stringify(disp.attrs?.description?.value ?? disp.attrs?.long_name?.value ?? '');
  const xs = file.get('x').value; const ys = file.get('y').value;
  const wkt = String(file.get('spatial_ref')?.attrs?.crs_wkt?.value ?? '');
  const zoneMatch = /UTM zone (\d+)([NS])/i.exec(wkt);
  if (!zoneMatch) throw new Error(`No UTM zone in spatial_ref: ${wkt.slice(0, 120)}`);
  const zone = Number(zoneMatch[1]); const north = zoneMatch[2].toUpperCase() === 'N';
  const dx = xs[1] - xs[0]; const dy = ys[1] - ys[0];
  const utm = cells.map((cell) => toUtm(cell.center[0], cell.center[1], zone, north));
  const colsOf = (x) => Math.round((x - xs[0]) / dx); const rowsOf = (y) => Math.round((y - ys[0]) / dy);
  const allC = utm.flatMap(([x]) => [colsOf(x - 500), colsOf(x + 500)]); const allR = utm.flatMap(([, y]) => [rowsOf(y - 500), rowsOf(y + 500)]);
  const c0 = Math.max(0, Math.min(...allC)); const c1 = Math.min(xs.length - 1, Math.max(...allC));
  const r0 = Math.max(0, Math.min(...allR)); const r1 = Math.min(ys.length - 1, Math.max(...allR));
  const block = disp.slice([[r0, r1 + 1], [c0, c1 + 1]]);
  const width = c1 - c0 + 1;
  const mean = utm.map(([x, y]) => {
    let sum = 0; let n = 0;
    const ra = [rowsOf(y - 500), rowsOf(y + 500)].sort((p, q) => p - q); const ca = [colsOf(x - 500), colsOf(x + 500)].sort((p, q) => p - q);
    for (let r = Math.max(r0, ra[0]); r <= Math.min(r1, ra[1]); r += 1) for (let c = Math.max(c0, ca[0]); c <= Math.min(c1, ca[1]); c += 1) {
      const v = block[(r - r0) * width + (c - c0)];
      if (Number.isFinite(v) && v !== 0) { sum += v; n += 1; }
    }
    return n > 20 ? sum / n : null;
  });
  file.close();
  // scene-median reference, as for NISAR
  const valid = mean.filter((v) => v !== null).sort((p, q) => p - q);
  const median = valid[valid.length >> 1] ?? 0;
  if (!offsets) offsets = cells.map(() => 0);
  if (lastRef && granule.ref !== lastRef.ref) {
    // new ministack: its reference is the previous chaining file's date
    if (granule.ref !== lastRef.endSec) console.warn(`  chain gap: ${lastRef.endSec} vs ref ${granule.ref}`);
    offsets = offsets.map((o, i) => o + (lastRef.values[i] ?? 0));
  }
  const values = mean.map((v) => (v === null ? null : v - median));
  values.forEach((v, i) => { if (v !== null) series[i].push([granule.sec, offsets[i] + v]); });
  // remember the chaining file of this ministack (the last one read for it)
  const isChain = files.filter((g) => g.ref === granule.ref).at(-1) === granule;
  if (isChain) lastRef = { ref: granule.ref, endSec: granule.sec, values };
  dates.push(granule.sec);
  console.log(`  ${granule.ref} → ${granule.sec}: ${valid.length}/${cells.length} cells`);
}

// ---- 5. Trend: least-squares slope over late-summer dates, one per year ----
const years = (d) => Number(d.slice(0, 4)) + (Number(d.slice(4, 6)) - 1) / 12 + Number(d.slice(6)) / 365;
const out = [];
cells.forEach((cell, i) => {
  const late = Object.values(Object.groupBy(series[i].filter(([d]) => lateSummer(d)), ([d]) => d.slice(0, 4))).map((list) => list.at(-1));
  if (late.length < 4) return;
  const t = late.map(([d]) => years(d)); const v = late.map(([, m]) => m * 100);
  const tm = t.reduce((s, x) => s + x, 0) / t.length; const vm = v.reduce((s, x) => s + x, 0) / v.length;
  const slope = t.reduce((s, x, k) => s + (x - tm) * (v[k] - vm), 0) / t.reduce((s, x) => s + (x - tm) ** 2, 0);
  out.push({ id: cell.id, center: cell.center, rateCmYr: round(slope, 2), years: late.length });
});
writeFileSync(path.join(site.out, 'trend.json'), JSON.stringify({
  source: `OPERA DISP-S1 (Sentinel-1, NASA/JPL), frame ${frame}, late-summer dates ${dates.filter(lateSummer)[0]}–${dates.filter(lateSummer).at(-1)}`,
  quantity: 'line-of-sight net movement rate, cm/yr, relative to the scene median; negative = sinking (away from the satellite)',
  signNote,
  cells: out,
}));
const rates = out.map((c) => c.rateCmYr).sort((p, q) => p - q);
console.log(`Wrote ${path.join(site.out, 'trend.json')}: ${out.length} cells, rate p10 ${rates[Math.floor(rates.length * 0.1)]}, median ${rates[rates.length >> 1]}, p90 ${rates[Math.floor(rates.length * 0.9)]} cm/yr`);
console.log(`displacement attribute: ${signNote}`);
