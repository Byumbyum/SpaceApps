export type LngLat = [number, number];

export interface SelectedArea {
  id: string;
  shape: 'circle' | 'box';
  center: LngLat;
  ring: LngLat[];
  areaKm2: number;
  name: string;
  region: string;
}

export interface Place {
  name: string;
  region: string;
  center: LngLat;
}

// Well-known permafrost places for instant local search; anything else falls back to geocoding.
export const PLACES: Place[] = [
  { name: 'Prudhoe Bay', region: 'Alaska, United States', center: [-148.34, 70.26] },
  { name: 'Deadhorse', region: 'Alaska, United States', center: [-148.46, 70.2] },
  { name: 'Utqiaġvik (Barrow)', region: 'Alaska, United States', center: [-156.79, 71.29] },
  { name: 'Fairbanks', region: 'Alaska, United States', center: [-147.72, 64.84] },
  { name: 'Bethel', region: 'Alaska, United States', center: [-161.76, 60.79] },
  { name: 'Nome', region: 'Alaska, United States', center: [-165.41, 64.5] },
  { name: 'Kotzebue', region: 'Alaska, United States', center: [-162.6, 66.9] },
  { name: 'Toolik Lake', region: 'Alaska, United States', center: [-149.6, 68.63] },
  { name: 'Anaktuvuk River fire scar', region: 'Alaska, United States', center: [-150.6, 69.1] },
  { name: 'Newtok', region: 'Alaska, United States', center: [-164.63, 60.94] },
  { name: 'Inuvik', region: 'Northwest Territories, Canada', center: [-133.72, 68.36] },
  { name: 'Tuktoyaktuk', region: 'Northwest Territories, Canada', center: [-133.03, 69.44] },
  { name: 'Yellowknife', region: 'Northwest Territories, Canada', center: [-114.37, 62.45] },
  { name: 'Dawson City', region: 'Yukon, Canada', center: [-139.43, 64.06] },
  { name: 'Iqaluit', region: 'Nunavut, Canada', center: [-68.52, 63.75] },
  { name: 'Ilulissat', region: 'Greenland', center: [-51.1, 69.22] },
  { name: 'Longyearbyen', region: 'Svalbard, Norway', center: [15.63, 78.22] },
  { name: 'Vorkuta', region: 'Komi Republic, Russia', center: [64.0, 67.5] },
  { name: 'Norilsk', region: 'Krasnoyarsk Krai, Russia', center: [88.2, 69.35] },
  { name: 'Yakutsk', region: 'Sakha Republic, Russia', center: [129.73, 62.03] },
  { name: 'Batagaika crater', region: 'Sakha Republic, Russia', center: [134.78, 67.58] },
  { name: 'Salekhard', region: 'Yamalo-Nenets, Russia', center: [66.6, 66.53] },
  { name: 'Yamal Peninsula', region: 'Yamalo-Nenets, Russia', center: [69.5, 70.5] },
  { name: 'Qinghai–Tibet Plateau', region: 'China', center: [92.0, 34.8] },
  { name: 'Ulaanbaatar', region: 'Mongolia', center: [106.92, 47.92] },
];

const EARTH_RADIUS_KM = 6371;

export function circleRing(center: LngLat, radiusKm: number, steps = 72): LngLat[] {
  const [lng, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const ring: LngLat[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * 2 * Math.PI;
    const dLat = (radiusKm / EARTH_RADIUS_KM) * Math.cos(angle);
    const dLng = ((radiusKm / EARTH_RADIUS_KM) * Math.sin(angle)) / Math.cos(latRad);
    ring.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return ring;
}

export function boxRing(a: LngLat, b: LngLat): LngLat[] {
  const west = Math.min(a[0], b[0]);
  const east = Math.max(a[0], b[0]);
  const south = Math.min(a[1], b[1]);
  const north = Math.max(a[1], b[1]);
  return [[west, north], [east, north], [east, south], [west, south], [west, north]];
}

export function boxAreaKm2(ring: LngLat[]) {
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const south = (Math.min(...lats) * Math.PI) / 180;
  const north = (Math.max(...lats) * Math.PI) / 180;
  const width = ((Math.max(...lngs) - Math.min(...lngs)) * Math.PI) / 180;
  return EARTH_RADIUS_KM ** 2 * width * Math.abs(Math.sin(north) - Math.sin(south));
}

export function distanceKm(a: LngLat, b: LngLat) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function nearestPlace(center: LngLat, withinKm = 120) {
  let best: { place: Place; km: number } | null = null;
  for (const place of PLACES) {
    const km = distanceKm(center, place.center);
    if (km <= withinKm && (!best || km < best.km)) best = { place, km };
  }
  return best;
}

export function formatCoordinate([lng, lat]: LngLat) {
  return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;
}

export function formatArea(km2: number) {
  if (km2 >= 10000) return `${Math.round(km2 / 1000).toLocaleString()}k km²`;
  if (km2 >= 100) return `${Math.round(km2).toLocaleString()} km²`;
  return `${km2.toFixed(1)} km²`;
}
