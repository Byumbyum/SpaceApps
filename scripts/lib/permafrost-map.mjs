// ESA CCI Permafrost extent (v5, 2023): permafrost fraction (%) on a 0.01° grid, 25–85°N.
// Modelled by the CryoGrid ground-temperature model driven by MODIS land-surface
// temperature. Free from CEDA (data.ceda.ac.uk/neodc/esacci/permafrost); keep the file in
// data/raw/permafrost/ (git-ignored, 12 MB):
//   https://dap.ceda.ac.uk/neodc/esacci/permafrost/data/permafrost_extent/L4/area4/pp/v05.0/northern_hemisphere/2023/ESACCI-PERMAFROST-L4-PFR-MODISLST_CRYOGRID-AREA4_PP-2023-fv05.0.nc

import { existsSync } from 'node:fs';
import h5wasm from 'h5wasm/node';

export const PERMAFROST_FILE = 'data/raw/permafrost/ESACCI-PFR-2023-fv05.0.nc';
const FILL = 255;

/**
 * Opens the map for a lon/lat box and returns a lookup: mean permafrost fraction (0–1)
 * over a footprint around a point, or null where the map has no data.
 */
export async function permafrostLookup([west, south, east, north], margin = 0.05) {
  if (!existsSync(PERMAFROST_FILE)) return null;
  await h5wasm.ready;
  const file = new h5wasm.File(PERMAFROST_FILE, 'r');
  const lat = file.get('lat').value;
  const lon = file.get('lon').value;
  const dLat = lat[1] - lat[0];
  const dLon = lon[1] - lon[0];
  const row = (la) => Math.round((la - lat[0]) / dLat);
  const col = (lo) => Math.round((lo - lon[0]) / dLon);
  const r0 = Math.max(0, row(south - margin));
  const r1 = Math.min(lat.length - 1, row(north + margin));
  const c0 = Math.max(0, col(west - margin));
  const c1 = Math.min(lon.length - 1, col(east + margin));
  if (r1 < r0 || c1 < c0) { file.close(); return null; }
  const width = c1 - c0 + 1;
  const block = file.get('PFR').slice([[0, 1], [r0, r1 + 1], [c0, c1 + 1]]);
  file.close();

  return ([lo, la], halfKm = 0.5) => {
    const halfLat = halfKm / 111;
    const halfLon = halfKm / (111 * Math.cos((la * Math.PI) / 180));
    let sum = 0;
    let count = 0;
    for (let r = row(la - halfLat); r <= row(la + halfLat); r += 1) {
      for (let c = col(lo - halfLon); c <= col(lo + halfLon); c += 1) {
        if (r < r0 || r > r1 || c < c0 || c > c1) continue;
        const value = block[(r - r0) * width + (c - c0)];
        if (value === FILL || value > 100) continue;
        sum += value;
        count += 1;
      }
    }
    return count ? sum / count / 100 : null;
  };
}
