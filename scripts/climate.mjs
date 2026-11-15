// ERA5-Land climate context per site → public/data/nisar/<site>/climate.json
//
//   npm run data:climate [-- --site=fairbanks]
//
// Hourly 2 m air temperature and soil temperature (level 1: 0–7 cm, level 4: 1–2.9 m)
// at the site centre, 2016 → latest, from the Copernicus Climate Data Store. Gives:
//   • degree days of thaw (ADDT) each year to 30 Sep, and 2026 against the 2016–2025 normal
//   • thaw onset: first day the top soil layer averages above 0 °C
//   • deep ground temperature (Jan–Oct mean at 1–2.9 m) and its trend per decade
//   • 2026 daily ADDT, used for a second Stefan fit of the NISAR ground movement
// If the site already has gunw.json, the ERA5-Land Stefan fit is added to it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { era5Timeseries } from './lib/era5.mjs';
import { writeSiteIndex } from './lib/site-index.mjs';
import { addStefan } from './lib/stefan.mjs';
import { SITES } from './sites.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value] = arg.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const START = '2016-01-01';
const CURRENT = 2026;
const LATENCY_DAYS = 8; // ERA5-Land runs about a week behind real time
const VARIABLES = ['2m_temperature', 'soil_temperature_level_1', 'soil_temperature_level_4'];
const COLUMN = { t2m: 'air', stl1: 'soil1', stl4: 'soil4' };

const end = new Date(Date.now() - LATENCY_DAYS * 86400000).toISOString().slice(0, 10);
const round = (value, digits = 1) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

function slopePerDecade(points) {
  if (points.length < 3) return null;
  const mx = mean(points.map(([x]) => x));
  const my = mean(points.map(([, y]) => y));
  const sxx = points.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return sxx ? (points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / sxx) * 10 : null;
}

const ids = args.site ? [args.site] : Object.keys(SITES);
for (const id of ids) {
  const site = SITES[id];
  const [west, south, east, north] = site.bbox;
  const center = [(west + east) / 2, (south + north) / 2];
  console.log(`=== ${id}: ${site.label}`);
  let rows;
  try {
    rows = await era5Timeseries({ lon: center[0], lat: center[1], start: START, end, variables: VARIABLES });
  } catch (error) {
    console.log(`  skipped: ${error.message}`);
    continue;
  }

  // Hourly kelvin → daily mean °C.
  const daily = new Map();
  for (const row of rows) {
    const day = String(row.valid_time).slice(0, 10);
    const entry = daily.get(day) ?? { air: [], soil1: [], soil4: [] };
    for (const [column, key] of Object.entries(COLUMN)) if (Number.isFinite(row[column])) entry[key].push(row[column] - 273.15);
    daily.set(day, entry);
  }
  const days = [...daily.keys()].sort();
  const dayMean = (day, key) => mean(daily.get(day)[key]);

  const years = [];
  for (let year = Number(START.slice(0, 4)); year <= CURRENT; year += 1) {
    const inYear = days.filter((day) => day.startsWith(`${year}-`));
    const toSep = inYear.filter((day) => day <= `${year}-09-30`);
    const janOct = inYear.filter((day) => day <= `${year}-10-31`);
    if (!toSep.length || toSep.at(-1) < `${year}-09-30`) continue; // need a complete thaw season
    const onset = inYear.find((day) => day >= `${year}-03-01` && dayMean(day, 'soil1') > 0) ?? null;
    years.push({
      year,
      addt: Math.round(toSep.reduce((s, day) => s + Math.max(0, dayMean(day, 'air') ?? 0), 0)),
      thawOnset: onset,
      deepSoilC: round(mean(janOct.map((day) => dayMean(day, 'soil4')).filter(Number.isFinite)), 2),
    });
  }
  const past = years.filter((entry) => entry.year < CURRENT);
  const now = years.find((entry) => entry.year === CURRENT) ?? null;
  const normalAddt = mean(past.map((entry) => entry.addt));
  const onsetDay = (date) => (date ? Math.round((Date.parse(date) - Date.parse(`${date.slice(0, 4)}-01-01`)) / 86400000) : null);
  const normalOnset = mean(past.map((entry) => onsetDay(entry.thawOnset)).filter((v) => v !== null));

  // 2026 running ADDT by date, for the Stefan fit.
  const addtDaily = {};
  let sum = 0;
  for (const day of days.filter((d) => d.startsWith(`${CURRENT}-`))) { sum += Math.max(0, dayMean(day, 'air') ?? 0); addtDaily[day] = Math.round(sum * 10) / 10; }

  const climate = {
    source: 'ERA5-Land hourly time series (Copernicus Climate Change Service / ECMWF), site centre',
    grid_point: [round(rows[0]?.longitude, 2), round(rows[0]?.latitude, 2)],
    period: [days[0], days.at(-1)],
    years,
    current: now && {
      year: CURRENT,
      addt: now.addt,
      addtVsNormalPct: normalAddt ? round(((now.addt - normalAddt) / normalAddt) * 100, 0) : null,
      thawOnset: now.thawOnset,
      thawOnsetVsNormalDays: now.thawOnset && normalOnset !== null ? Math.round(onsetDay(now.thawOnset) - normalOnset) : null,
      deepSoilC: now.deepSoilC,
    },
    normal: { years: past.length ? [past[0].year, past.at(-1).year] : null, addt: normalAddt ? Math.round(normalAddt) : null, deepSoilC: round(mean(past.map((entry) => entry.deepSoilC).filter(Number.isFinite)), 2) },
    deepSoilTrendPerDecade: round(slopePerDecade(years.filter((entry) => entry.deepSoilC !== null).map((entry) => [entry.year, entry.deepSoilC])), 2),
    addtDaily,
  };
  mkdirSync(site.out, { recursive: true });
  writeFileSync(path.join(site.out, 'climate.json'), JSON.stringify(climate));
  const c = climate.current;
  console.log(`  ${days.length} days; ${CURRENT} ADDT ${c?.addt} °C·days (${c?.addtVsNormalPct > 0 ? '+' : ''}${c?.addtVsNormalPct}% vs ${climate.normal.years?.join('–')}), soil thaw onset ${c?.thawOnset} (${c?.thawOnsetVsNormalDays} d vs normal), deep soil ${c?.deepSoilC} °C, trend ${climate.deepSoilTrendPerDecade} °C/decade`);

  // Second Stefan fit for sites with ground movement.
  const gunwFile = path.join(site.out, 'gunw.json');
  if (existsSync(gunwFile)) {
    const gunw = JSON.parse(readFileSync(gunwFile, 'utf8'));
    await addStefan(gunw, site);
    writeFileSync(gunwFile, JSON.stringify(gunw));
    const good = (key) => gunw.cells.filter((cell) => cell[key]?.r2 >= 0.6).length;
    console.log(`  Stefan fits updated: NASA POWER ${good('stefan')} / ERA5-Land ${good('stefanEra5')} cells with R² ≥ 0.6`);
  }
}
writeSiteIndex();
