// Stefan thaw model for NISAR ground movement.
//
// Thaw depth grows with the square root of accumulated degree days of thaw (ADDT), so
// seasonal thaw subsidence follows  d(t) = A·√ADDT(t) + c  (Stefan solution; used in
// InSAR permafrost work since Liu et al. 2012). Air temperature comes from NASA POWER
// (daily 2 m temperature, MERRA-2 / GEOS-IT), one series per site: no account needed.
//
// One summer cannot separate a long-term trend from the seasonal term (they rise
// together), so only A and c are fitted; the trend term is added once NISAR has
// several seasons. Movement is line-of-sight relative to the area's median, so A is a
// relative thaw sensitivity: negative = sinks more than the surroundings as it thaws.
//
//   node scripts/lib/stefan.mjs [site …]     add the fit to existing gunw.json files

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITES } from '../sites.mjs';

const POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const MIN_POINTS = 4;

/** Daily mean 2 m air temperature (°C) at a point, keyed by YYYY-MM-DD. */
export async function powerTemperatures([lon, lat], year) {
  const query = new URLSearchParams({ parameters: 'T2M', community: 'AG', longitude: lon.toFixed(3), latitude: lat.toFixed(3), start: `${year}0101`, end: `${year}1231`, format: 'JSON' });
  const response = await fetch(`${POWER}?${query}`);
  if (!response.ok) throw new Error(`NASA POWER ${response.status}`);
  const values = (await response.json()).properties.parameter.T2M;
  return Object.fromEntries(Object.entries(values).filter(([, t]) => t > -900).map(([day, t]) => [`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`, t]));
}

/** Running sum of max(T, 0) from 1 January: ADDT (°C·days) at each date. */
export function addtByDate(temperatures) {
  const out = {};
  let sum = 0;
  for (const day of Object.keys(temperatures).sort()) { sum += Math.max(0, temperatures[day]); out[day] = sum; }
  return out;
}

/** Least-squares d = A·x + c with x = √ADDT. Returns null with too few points. */
export function fitStefan(addt, cumulativeCm) {
  const points = cumulativeCm.map((d, i) => [Math.sqrt(addt[i]), d]).filter(([x, d]) => Number.isFinite(x) && d !== null && Number.isFinite(d));
  if (points.length < MIN_POINTS) return null;
  const n = points.length;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, d]) => s + d, 0) / n;
  const sxx = points.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const a = points.reduce((s, [x, d]) => s + (x - mx) * (d - my), 0) / sxx;
  const c = my - a * mx;
  const sst = points.reduce((s, [, d]) => s + (d - my) ** 2, 0);
  const sse = points.reduce((s, [x, d]) => s + (d - (a * x + c)) ** 2, 0);
  return { a, c, r2: sst > 0 ? 1 - sse / sst : 0, n };
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Fit every cell against one ADDT source; trackField/cellField name where results go. */
function fitCells(summary, addt, trackField, cellField) {
  for (const track of summary.tracks) track[trackField] = track.dates.map((date) => (addt[date] === undefined ? null : Math.round(addt[date])));
  let fitted = 0;
  for (const cell of summary.cells) {
    // The track that saw this cell on the most dates.
    const best = summary.tracks
      .map((track) => ({ track, series: cell.los[track.key] ?? [] }))
      .sort((a, b) => b.series.filter((v) => v !== null).length - a.series.filter((v) => v !== null).length)[0];
    const values = best?.track[trackField];
    const fit = values && values.every((v) => v !== null) ? fitStefan(values, best.series) : null;
    if (!fit) continue;
    const seasonal = fit.a * (Math.sqrt(values[values.length - 1]) - Math.sqrt(values[0]));
    cell[cellField] = { track: best.track.key, a: round(fit.a, 4), r2: round(fit.r2, 2), seasonal: round(seasonal, 2) };
    fitted += 1;
  }
  return fitted;
}

/**
 * Add ADDT per track date and Stefan fits per cell to a gunw.json summary (in place):
 * NASA POWER always (stefan / addt), and ERA5-Land when the site has climate.json
 * (stefanEra5 / addtEra5, from `npm run data:climate`).
 */
export async function addStefan(summary, site) {
  const [west, south, east, north] = site.bbox;
  const center = [(west + east) / 2, (south + north) / 2];
  const years = [...new Set(summary.tracks.flatMap((track) => track.dates.map((date) => Number(date.slice(0, 4)))))];
  const power = {};
  for (const year of years) Object.assign(power, addtByDate(await powerTemperatures(center, year)));
  const fitted = fitCells(summary, power, 'addt', 'stefan');
  const sources = ['NASA POWER daily T2M (MERRA-2 / GEOS-IT)'];

  const climateFile = path.join(site.out, 'climate.json');
  if (existsSync(climateFile)) {
    const { addtDaily } = JSON.parse(readFileSync(climateFile, 'utf8'));
    if (addtDaily && Object.keys(addtDaily).length) {
      fitCells(summary, addtDaily, 'addtEra5', 'stefanEra5');
      sources.push('ERA5-Land hourly 2 m temperature (Copernicus / ECMWF)');
    }
  }
  summary.thaw_model = {
    name: 'Stefan: d = A·√ADDT + c',
    temperature: `${sources.join(' and ')}, at the site centre`,
    addt_reset: '1 January',
    note: 'One season: trend term not fitted. A is relative to the area median (line of sight).',
  };
  return fitted;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SITES);
  for (const id of ids) {
    const site = SITES[id];
    const file = path.join(site.out, 'gunw.json');
    if (!existsSync(file)) continue;
    const summary = JSON.parse(readFileSync(file, 'utf8'));
    const fitted = await addStefan(summary, site);
    writeFileSync(file, JSON.stringify(summary));
    const seasonal = summary.cells.map((cell) => cell.stefan?.seasonal).filter((v) => v !== undefined).sort((a, b) => a - b);
    const good = summary.cells.filter((cell) => cell.stefan?.r2 >= 0.6).length;
    console.log(`${id}: ADDT ${summary.tracks[0].addt[0]} → ${summary.tracks[0].addt.at(-1)} °C·days; Stefan fit for ${fitted} cells, ${good} with R² ≥ 0.6; seasonal thaw movement median ${seasonal[seasonal.length >> 1]} cm (relative)`);
  }
}
