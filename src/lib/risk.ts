import { circleRing, distanceKm, insideRing, type LngLat } from './geo';
import type { GcovData } from '../types';

// Disaster risk as UNDRR (Sendai Framework) and IPCC AR6 define it:
//   Risk = f(Hazard, Exposure, Vulnerability, Capacity)
// Neither body fixes a formula. We use an equal-weight geometric mean of
// H, E, V and (1 − C), so a near-zero factor (nobody exposed, no hazard)
// pulls risk towards zero, as it should.

export interface RiskFactors {
  /** Physical trigger: thaw-driven ground motion, erosion, slope creep (0–1). */
  hazard: number;
  /** People and assets in harm's way: buildings, roads, pipelines, population (0–1). */
  exposure: number;
  /** Susceptibility: poverty, age, building type, isolation (0–1). */
  vulnerability: number;
  /** Ability to cope: hospitals, monitoring, local plans (0–1, higher is better). */
  capacity: number;
}

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export function riskScore({ hazard, exposure, vulnerability, capacity }: RiskFactors) {
  const terms = [hazard, exposure, vulnerability, 1 - capacity].map((value) => Math.min(1, Math.max(0.001, value)));
  return terms.reduce((product, value) => product * value, 1) ** (1 / terms.length);
}

export const riskLevel = (score: number): RiskLevel => (score >= 0.6 ? 'High' : score >= 0.4 ? 'Moderate' : 'Low');

export interface Hotspot extends RiskFactors {
  id: string;
  name: string;
  region: string;
  center: LngLat;
  /** Radius of the danger zone, km. */
  radiusKm: number;
  /** What is happening on the ground. */
  hazards: string;
  safety: string;
  health: string;
  economy: string;
}

// Rings of the probability halo, as fractions of the radius, from the core out.
const HALO = [0.35, 0.65, 1] as const;

export function hotspotFeatures(hotspots: Hotspot[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const spot of hotspots) {
    const risk = riskScore(spot);
    HALO.forEach((fraction, ring) => {
      features.push({
        type: 'Feature',
        properties: { id: spot.id, risk, ring },
        geometry: { type: 'Polygon', coordinates: [circleRing(spot.center, spot.radiusKm * fraction, 64)] },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

export function hotspotPoints(hotspots: Hotspot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((spot) => ({ type: 'Feature', properties: { id: spot.id, risk: riskScore(spot) }, geometry: { type: 'Point', coordinates: spot.center } })),
  };
}

/** Hotspots whose danger zone overlaps the selected ring, highest risk first. */
export function hotspotsInArea(hotspots: Hotspot[], ring: LngLat[], center: LngLat) {
  const reach = Math.max(...ring.map((point) => distanceKm(point, center)));
  return hotspots
    .filter((spot) => insideRing(spot.center, ring) || distanceKm(spot.center, center) <= reach + spot.radiusKm)
    .map((spot) => ({ spot, score: riskScore(spot) }))
    .sort((a, b) => b.score - a.score);
}

const BUILT_UP = 50;

/**
 * Measured danger cells inside a NISAR site: summer radar change (hazard proxy)
 * weighted by how much of the 1 km cell is built up (exposure). Cells with no
 * buildings still show faintly, because roads and trails are not yet mapped.
 */
export function nisarHotspotPoints(gcov: GcovData, ring: LngLat[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const cell of gcov.cells) {
    if (!cell.lc?.length || !insideRing(cell.center, ring)) continue;
    const blocks = cell.lc.reduce((sum, [, count]) => sum + count, 0);
    const changed = cell.lc.filter(([, , change]) => change !== null);
    if (!blocks || !changed.length) continue;
    const change = changed.reduce((sum, [, count, value]) => sum + count * Math.abs(value as number), 0) / changed.reduce((sum, [, count]) => sum + count, 0);
    const built = cell.lc.filter(([code]) => code === BUILT_UP).reduce((sum, [, count]) => sum + count, 0) / blocks;
    const hazard = Math.min(1, change / 3);
    const weight = hazard * (0.25 + 0.75 * Math.min(1, built * 4));
    if (weight < 0.08) continue;
    features.push({ type: 'Feature', properties: { weight }, geometry: { type: 'Point', coordinates: cell.center } });
  }
  return { type: 'FeatureCollection', features };
}
