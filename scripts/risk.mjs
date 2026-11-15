// Computed risk per 1 km cell at NISAR sites → <site>/risk.json + public/data/nisar/risk-zones.geojson
//
//   npm run data:risk
//
// Risk index = f(Hazard, Exposure, Vulnerability), the IPCC (AR5, AR6) climate-risk framework;
// IPCC vulnerability includes lack of capacity to cope. The IPCC prescribes no formula; the
// geometric mean is our choice (no factor can make up for another being zero).
//
//   Hazard = P × T × M, permafrost thaw under the cell. Every condition must hold:
//     P  permafrost present: ESA CCI Permafrost v5 (2023) fraction of the 1 km cell.
//        No permafrost → no permafrost hazard (seasonal frost and other movement drop out).
//     T  ground close to thawing: ERA5-Land soil layer 4 (1–2.89 m), Jan–Oct mean at the site.
//        0 at −5 °C or colder, 1 at −1 °C or warmer ("warm permafrost" is above −2 °C).
//     M  movement evidence of thaw, from two radars:
//        - D, degradation: multi-year net sinking that does not recover (Sentinel-1 InSAR,
//          OPERA DISP-S1, 2016–2025), 1 cm/yr or more = 1. This is the hazard signal.
//        - I, ground ice: NISAR 2026 thaw-shaped seasonal sinking (Stefan fit sinks with
//          √ADDT, r² ≥ 0.3), 5 cm or more = 1. Seasonal sinking is the normal active-layer
//          cycle; its size indicates how much ice the thawing layer holds (ReSALT).
//        With a trend: M = D × (0.5 + 0.5·I), degrading ground scores higher the more ice it
//        has to lose. Without one: M = I, marked "trend pending" until a trend exists
//        (Sentinel-1 for the past, NISAR's own record from 2026 onwards).
//   Exposure      ESA WorldCover built-up share of the cell (via the GCOV cell statistics);
//                 a floor of 0.05 keeps roads and trails in empty-looking cells in play.
//   Vulnerability  IPCC: susceptibility and lack of capacity to cope, √(V × (1 − C)) from the
//                  site's researched estimates (scripts/sites.mjs) until census and
//                  health-facility data are added.
// Risk is smoothed over neighbouring cells and contoured, so danger zones follow the land.
// Sites without GUNW are skipped: their hotspot stays a demo estimate.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { contours } from 'd3-contour';
import { permafrostLookup } from './lib/permafrost-map.mjs';
import { writeSiteIndex } from './lib/site-index.mjs';
import { SITES } from './sites.mjs';

const SINK_FULL_CM = 5;       // seasonal thaw-shaped sinking that counts fully (ice indicator)
const TREND_FULL_CM_YR = 1;   // multi-year net sinking rate that counts fully
const MIN_THAW_R2 = 0.3;      // Stefan fit must explain the movement for it to count as thaw
const T_COLD = -5;
const T_WARM = -1;
const BUILT_UP = 50;
const EXPOSURE_FLOOR = 0.05;
const LEVELS = [0.3, 0.4, 0.6]; // watch, moderate, high (the app's risk bands)
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const riskOf = (h, e, v) => h <= 0 ? 0 : [h, e, v].map((x) => Math.min(1, Math.max(0.001, x))).reduce((p, x) => p * x, 1) ** (1 / 3);
const ipccVulnerability = (susceptibility, copingCapacity) => Math.round(Math.sqrt(susceptibility * (1 - copingCapacity)) * 100) / 100;

const zones = [];
for (const [id, site] of Object.entries(SITES)) {
  const gunwFile = path.join(site.out, 'gunw.json');
  const gcovFile = path.join(site.out, 'gcov.json');
  if (!existsSync(gunwFile) || !existsSync(gcovFile)) continue;
  const gunw = JSON.parse(readFileSync(gunwFile, 'utf8'));
  const gcov = JSON.parse(readFileSync(gcovFile, 'utf8'));

  const vulnerability = ipccVulnerability(site.vulnerability, site.capacity);
  // P: permafrost fraction per cell.
  const lons = gunw.corners.map(([lon]) => lon);
  const lats = gunw.corners.map(([, lat]) => lat);
  const permafrostAt = await permafrostLookup([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
  if (!permafrostAt) throw new Error('ESA CCI permafrost map missing: see scripts/lib/permafrost-map.mjs');
  // T: one value per site from ERA5-Land deep soil.
  const climateFile = path.join(site.out, 'climate.json');
  const deepSoilC = existsSync(climateFile) ? JSON.parse(readFileSync(climateFile, 'utf8')).current?.deepSoilC : null;
  const thermal = deepSoilC === null || deepSoilC === undefined ? 0 : clamp01((deepSoilC - T_COLD) / (T_WARM - T_COLD));
  // M (trend): per-cell net sinking rate from OPERA DISP-S1, where processed (scripts/opera-trend.mjs).
  const trendFile = path.join(site.out, 'trend.json');
  const trend = existsSync(trendFile) ? JSON.parse(readFileSync(trendFile, 'utf8')) : null;
  const trendNear = ([lon, lat]) => {
    if (!trend) return null;
    let best = null;
    let bestKm = Infinity;
    for (const cell of trend.cells) {
      const km = Math.hypot((cell.center[0] - lon) * Math.cos((lat * Math.PI) / 180), cell.center[1] - lat) * 111;
      if (km < bestKm) { bestKm = km; best = cell; }
    }
    return best && bestKm < 1 ? best.rateCmYr : null;
  };

  // Built-up share of each GCOV cell, looked up by nearest centre.
  const builtCells = gcov.cells.filter((cell) => cell.lc?.length).map((cell) => {
    const total = cell.lc.reduce((sum, [, blocks]) => sum + blocks, 0);
    const built = cell.lc.filter(([code]) => code === BUILT_UP).reduce((sum, [, blocks]) => sum + blocks, 0);
    return { center: cell.center, built: total ? built / total : 0 };
  });
  const builtNear = ([lon, lat]) => {
    let best = null;
    let bestKm = Infinity;
    for (const cell of builtCells) {
      const km = Math.hypot((cell.center[0] - lon) * Math.cos((lat * Math.PI) / 180), cell.center[1] - lat) * 111;
      if (km < bestKm) { bestKm = km; best = cell; }
    }
    return best && bestKm < 1 ? best.built : 0;
  };

  // Score every cell; ids are m<row>-<col> on the GUNW grid.
  const cells = [];
  let rows = 0;
  let cols = 0;
  for (const cell of gunw.cells) {
    const fit = cell.stefanEra5 ?? cell.stefan;
    const movement = fit?.seasonal;
    if (movement === undefined) continue;
    const [, r, c] = /m(\d+)-(\d+)/.exec(cell.id).map(Number);
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
    const permafrost = permafrostAt(cell.center) ?? 0;
    const thawShaped = fit.a < 0 && fit.r2 >= MIN_THAW_R2;
    const seasonalEvidence = thawShaped ? clamp01(-movement / SINK_FULL_CM) : 0;
    const rate = trendNear(cell.center);
    const trendEvidence = rate === null ? null : clamp01(-rate / TREND_FULL_CM_YR);
    const evidence = trendEvidence === null ? seasonalEvidence : trendEvidence * (0.5 + 0.5 * seasonalEvidence);
    const hazard = permafrost * thermal * evidence;
    const built = builtNear(cell.center);
    const exposure = clamp01(EXPOSURE_FLOOR + 3 * built);
    cells.push({ id: cell.id, r, c, center: cell.center, movement, rate, permafrost, hazard, exposure, built, trendPending: rate === null, risk: riskOf(hazard, exposure, vulnerability) });
  }
  if (!cells.length) continue;

  // Grid, gently smoothed (3×3 weighted) so zones are areas rather than single noisy cells.
  const grid = new Float64Array(rows * cols);
  const has = new Uint8Array(rows * cols);
  for (const cell of cells) { grid[cell.r * cols + cell.c] = cell.risk; has[cell.r * cols + cell.c] = 1; }
  const smooth = new Float64Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      let weight = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || !has[rr * cols + cc]) continue;
          const w = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
          sum += w * grid[rr * cols + cc];
          weight += w;
        }
      }
      smooth[r * cols + c] = weight ? sum / weight : 0;
    }
  }

  // Grid (col, row) → lon/lat by bilinear interpolation of the footprint corners
  // (top-left, top-right, bottom-right, bottom-left); cell centres sit at +0.5.
  const [tl, tr, br, bl] = gunw.corners;
  const toLonLat = (x, y) => {
    const u = x / cols;
    const v = y / rows;
    const lon = (1 - v) * ((1 - u) * tl[0] + u * tr[0]) + v * ((1 - u) * bl[0] + u * br[0]);
    const lat = (1 - v) * ((1 - u) * tl[1] + u * tr[1]) + v * ((1 - u) * bl[1] + u * br[1]);
    return [round(lon, 5), round(lat, 5)];
  };
  // Point-in-ring in grid coordinates (cell centres sit at col + 0.5, row + 0.5).
  const inRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // One feature per zone, carrying what the map shows on hover: its cells' peak risk,
  // typical ground movement and how built-up it is.
  for (const band of contours().size([cols, rows]).thresholds(LEVELS)(Array.from(smooth))) {
    for (const polygon of band.coordinates) {
      const [outer, ...holes] = polygon;
      const inside = cells.filter((cell) => inRing(cell.c + 0.5, cell.r + 0.5, outer) && !holes.some((hole) => inRing(cell.c + 0.5, cell.r + 0.5, hole)));
      if (!inside.length) continue;
      const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
      zones.push({
        type: 'Feature',
        properties: {
          site: id,
          siteLabel: site.label,
          level: band.value,
          band: LEVELS.indexOf(band.value),
          cells: inside.length,
          peak: round(Math.max(...inside.map((cell) => cell.risk)), 2),
          movementCm: round(mean(inside.map((cell) => cell.movement)), 1),
          permafrostPct: Math.round(mean(inside.map((cell) => cell.permafrost)) * 100),
          trendCmYr: inside.some((cell) => cell.rate !== null) ? round(mean(inside.filter((cell) => cell.rate !== null).map((cell) => cell.rate)), 2) : null,
          trendPending: inside.every((cell) => cell.trendPending),
          builtPct: Math.round(mean(inside.map((cell) => cell.built)) * 100),
        },
        geometry: { type: 'Polygon', coordinates: polygon.map((ring) => ring.map(([x, y]) => toLonLat(x, y))) },
      });
    }
  }
  // Zoom morph: far out, one glow per site like every other hotspot (at the risk-weighted
  // centre of its watch-level cells, strength = peak risk); closer in, a glow per cell that
  // traces the land; closest, the zone outlines above.
  const watched = cells.filter((item) => item.risk >= LEVELS[0]);
  for (const cell of watched) {
    zones.push({ type: 'Feature', properties: { site: id, kind: 'cell', risk: round(cell.risk, 2) }, geometry: { type: 'Point', coordinates: cell.center } });
  }
  if (watched.length) {
    const weight = watched.reduce((sum, cell) => sum + cell.risk, 0);
    const centre = [0, 1].map((axis) => round(watched.reduce((sum, cell) => sum + cell.center[axis] * cell.risk, 0) / weight, 5));
    zones.push({ type: 'Feature', properties: { site: id, kind: 'site', siteLabel: site.label, risk: round(Math.max(...cells.map((cell) => cell.risk)), 2) }, geometry: { type: 'Point', coordinates: centre } });
  }

  const summary = {
    method: 'Risk index = (H·E·V)^⅓ (our geometric mean; factors from the IPCC climate-risk framework)',
    inputs: {
      hazard: `H = P × T × M. P: ESA CCI permafrost fraction. T: ERA5-Land 1–2.89 m soil ${deepSoilC} °C → ${round(thermal, 2)} (${T_COLD} °C = 0, ${T_WARM} °C = 1). M: ${trend ? `Sentinel-1 (OPERA DISP-S1) multi-year net sinking, ${TREND_FULL_CM_YR} cm/yr = 1, × (0.5 + 0.5 × NISAR ground-ice indicator)` : `trend pending; NISAR 2026 thaw-shaped seasonal sinking (r² ≥ ${MIN_THAW_R2}), ${SINK_FULL_CM} cm = 1, as a ground-ice indicator`}`,
      exposure: `ESA WorldCover built-up share ×3, floor ${EXPOSURE_FLOOR}`,
      vulnerability: `${vulnerability} (IPCC: susceptibility ${site.vulnerability} and coping capacity ${site.capacity}, researched estimates)`,
    },
    levels: LEVELS,
    trendSource: trend?.source ?? null,
    cells: cells.map(({ id: cellId, center, movement, rate, permafrost, hazard, exposure, risk }) => ({ id: cellId, center, movement: round(movement, 2), trendCmYr: rate === null ? null : round(rate, 2), p: round(permafrost, 2), h: round(hazard, 2), e: round(exposure, 2), risk: round(risk) })),
  };
  writeFileSync(path.join(site.out, 'risk.json'), JSON.stringify(summary));
  const sorted = cells.map((cell) => cell.risk).sort((a, b) => a - b);
  const count = (level) => cells.filter((cell) => cell.risk >= level).length;
  console.log(`${id}: T ${round(thermal, 2)} (${deepSoilC} °C), permafrost cells ${cells.filter((cell) => cell.permafrost > 0).length}, trend ${trend ? 'OPERA' : 'pending'}; ${cells.length} cells, median risk ${round(sorted[sorted.length >> 1], 2)}, max ${round(sorted.at(-1), 2)}; ≥0.3: ${count(0.3)}, ≥0.4: ${count(0.4)}, ≥0.6: ${count(0.6)} cells`);
}
writeFileSync('public/data/nisar/risk-zones.geojson', JSON.stringify({ type: 'FeatureCollection', features: zones }));
console.log(`Wrote public/data/nisar/risk-zones.geojson (${zones.length} bands)`);
writeSiteIndex();
