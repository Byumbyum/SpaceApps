// Emergency and health facilities per site from OpenStreetMap → <site>/capacity.json
//
//   npm run data:capacity [-- --site=fairbanks]
//
// One Overpass API query per site (free, no key), over the site box plus a 0.5° buffer so
// that distances near the edges see facilities just outside. Kept: hospitals, clinics and
// doctors (health), fire and ambulance stations (rescue), police. risk.mjs turns distances
// to these into a capacity score per 1 km cell. OpenStreetMap coverage is uneven: thinner in
// remote and lower-income regions, which the app states.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SITES } from './sites.mjs';

// Main public server first, then a mirror when it is busy (it often answers 502/504).
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const BUFFER_DEG = 0.5;
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value] = arg.replace(/^--/, '').split('='); return [key, value ?? true]; }));

function kindOf(tags) {
  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') return 'hospital';
  if (['clinic', 'doctors'].includes(tags.amenity) || ['clinic', 'doctor', 'centre'].includes(tags.healthcare)) return 'clinic';
  if (tags.amenity === 'fire_station' || tags.emergency === 'ambulance_station') return 'rescue';
  if (tags.amenity === 'police') return 'police';
  return null;
}

const ids = args.site ? [args.site] : Object.keys(SITES);
for (const id of ids) {
  const site = SITES[id];
  const [west, south, east, north] = site.bbox;
  const box = [south - BUFFER_DEG, west - BUFFER_DEG, north + BUFFER_DEG, east + BUFFER_DEG].map((v) => v.toFixed(3)).join(',');
  const query = `[out:json][timeout:90];(
    nwr["amenity"~"^(hospital|clinic|doctors|fire_station|police)$"](${box});
    nwr["healthcare"~"^(hospital|clinic|doctor|centre)$"](${box});
    nwr["emergency"="ambulance_station"](${box});
  );out center tags;`;
  let elements;
  try {
    let lastError = null;
    for (const server of OVERPASS) {
      try {
        const response = await fetch(server, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'Prescient NASA Space Apps demo (permafrost risk)' } });
        if (!response.ok) throw new Error(`${new URL(server).host} ${response.status}`);
        elements = (await response.json()).elements;
        break;
      } catch (error) { lastError = error; }
    }
    if (!elements) throw lastError;
  } catch (error) {
    console.log(`${id}: skipped (${error.message})`);
    continue;
  }
  const seen = new Set();
  const facilities = [];
  for (const element of elements) {
    const kind = kindOf(element.tags ?? {});
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!kind || lat === undefined) continue;
    // The same facility is often mapped as a node and a building outline: keep one.
    const key = `${kind}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facilities.push({ kind, name: element.tags.name ?? element.tags['name:en'] ?? null, lon: Number(lon.toFixed(5)), lat: Number(lat.toFixed(5)) });
  }
  const counts = Object.fromEntries(['hospital', 'clinic', 'rescue', 'police'].map((kind) => [kind, facilities.filter((f) => f.kind === kind).length]));
  mkdirSync(site.out, { recursive: true });
  writeFileSync(path.join(site.out, 'capacity.json'), JSON.stringify({ source: 'OpenStreetMap via the Overpass API (ODbL)', fetched: new Date().toISOString().slice(0, 10), buffer_deg: BUFFER_DEG, counts, facilities }));
  console.log(`${id}: ${facilities.length} facilities — ${Object.entries(counts).map(([kind, n]) => `${n} ${kind}`).join(', ')}`);
  await new Promise((resolve) => setTimeout(resolve, 3000)); // be gentle with the public server
}
