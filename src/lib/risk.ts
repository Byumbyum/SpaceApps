import { circleRing, distanceKm, insideRing, type LngLat } from './geo';
import type { GcovData, NisarSite, RiskData } from '../types';

// Climate risk as the IPCC (AR5, AR6) frames it:
//   Risk = f(Hazard, Exposure, Vulnerability)
// where vulnerability includes "sensitivity or susceptibility to harm and lack of capacity
// to cope and adapt". The IPCC fixes no formula, so this is a relative risk index, not a
// probability. We use an equal-weight geometric mean of H, E and V, so a near-zero factor
// (nobody exposed, no hazard) pulls risk towards zero, as it should.

export interface RiskFactors {
  /** Physical trigger: thaw-driven ground motion, erosion, slope creep (0–1). */
  hazard: number;
  /** People and assets in harm's way: buildings, roads, pipelines, population (0–1). */
  exposure: number;
  /** IPCC vulnerability: susceptibility (poverty, age, building type, isolation) and lack of
   *  capacity to cope (hospitals, monitoring, local plans) (0–1). */
  vulnerability: number;
}

/** IPCC vulnerability from its two parts: susceptibility and coping capacity (both 0–1). */
export const ipccVulnerability = (susceptibility: number, copingCapacity: number) =>
  Math.round(Math.sqrt(Math.max(0, susceptibility) * Math.max(0, 1 - copingCapacity)) * 100) / 100;

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export function riskScore({ hazard, exposure, vulnerability }: RiskFactors) {
  const terms = [hazard, exposure, vulnerability].map((value) => Math.min(1, Math.max(0.001, value)));
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

/** Demo hotspots not covered by a site with computed risk (those are replaced by real zones). */
export function demoHotspots(hotspots: Hotspot[], sites: NisarSite[]) {
  const computed = sites.filter((site) => site.risk).map((site) => [...site.corners, site.corners[0]] as LngLat[]);
  return hotspots.filter((spot) => !computed.some((ring) => insideRing(spot.center, ring)));
}

export interface AreaRisk {
  score: number;
  peak: number;
  hazard: number;
  exposure: number;
  vulnerability: number;
  cellCount: number;
  atRiskShare: number;
}

const middle = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[sorted.length >> 1]; };

/** Computed risk over the cells in a selection: median and peak, with the factors behind it. */
export function areaRisk(risk: RiskData, ring: LngLat[], center: LngLat): AreaRisk | null {
  let cells = risk.cells.filter((cell) => insideRing(cell.center, ring));
  if (!cells.length) {
    const nearest = risk.cells.reduce<RiskData['cells'][number] | null>((best, cell) => (!best || distanceKm(cell.center, center) < distanceKm(best.center, center) ? cell : best), null);
    if (!nearest || distanceKm(nearest.center, center) > 1.5) return null;
    cells = [nearest];
  }
  const estimate = (text: string) => Number.parseFloat(text);
  return {
    score: middle(cells.map((cell) => cell.risk)),
    peak: Math.max(...cells.map((cell) => cell.risk)),
    hazard: middle(cells.map((cell) => cell.h)),
    exposure: middle(cells.map((cell) => cell.e)),
    vulnerability: estimate(risk.inputs.vulnerability),
    cellCount: cells.length,
    atRiskShare: cells.filter((cell) => cell.risk >= 0.4).length / cells.length,
  };
}
