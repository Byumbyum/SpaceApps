import type { LngLat } from './geo';

// PLACEHOLDER MODEL — no real data has been downloaded yet.
// Values are deterministic per location so the interface can be demonstrated,
// and every screen that shows them labels them as sample values. Replace this
// module with lookups into the processed NISAR / OPERA products when available.

export type Level = 'Low' | 'Moderate' | 'High';

export interface ImpactInsight {
  level: Level;
  headline: string;
  detail: string;
  metrics: Array<{ label: string; value: string }>;
}

export interface PermafrostInsight {
  hasPermafrost: boolean;
  extentPct: number;
  subsidenceCmYr: number;
  activeLayerChangeCm: number;
  groundTempC: number;
  level: Level;
  trend: Array<{ year: number; value: number }>;
  safety: ImpactInsight;
  health: ImpactInsight;
  economy: ImpactInsight;
}

function seeded(center: LngLat) {
  let seed = Math.floor((center[0] + 180) * 1000) * 73856093 ^ Math.floor((center[1] + 90) * 1000) * 19349663;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed >>> 0) / 4294967296;
  };
}

function permafrostLikelihood([lng, lat]: LngLat) {
  const tibet = lng > 75 && lng < 105 && lat > 28 && lat < 40 ? 0.65 : 0;
  const north = Math.min(1, Math.max(0, (lat - 52) / 16));
  const south = lat < -62 ? 0.9 : 0;
  return Math.max(tibet, north, south);
}

const levelFor = (score: number): Level => (score >= 0.66 ? 'High' : score >= 0.33 ? 'Moderate' : 'Low');

export function placeholderPermafrost(center: LngLat): PermafrostInsight {
  const random = seeded(center);
  const likelihood = permafrostLikelihood(center);
  const jitter = () => 0.75 + random() * 0.5;
  const extentPct = Math.round(Math.min(100, likelihood * 100 * jitter()));
  const subsidence = -(likelihood * 3.2 * jitter());
  const severity = Math.min(1, likelihood * jitter() * (0.6 + random() * 0.5));
  const level = levelFor(severity);
  const trend = Array.from({ length: 11 }, (_, index) => ({
    year: 2016 + index,
    value: Number((subsidence * index * (0.85 + random() * 0.3)).toFixed(2)),
  }));
  const people = Math.round(severity * 4200 * jitter());
  const roadsKm = Math.round(severity * 180 * jitter());
  const cost = (severity * 46 * jitter()).toFixed(1);

  return {
    hasPermafrost: likelihood > 0.05,
    extentPct,
    subsidenceCmYr: Number(subsidence.toFixed(2)),
    activeLayerChangeCm: Number((likelihood * 9 * jitter()).toFixed(1)),
    groundTempC: Number((-8 * likelihood + 1.2 * random()).toFixed(1)),
    level,
    trend,
    safety: {
      level: levelFor(severity * jitter()),
      headline: `${roadsKm} km of roads on thaw-sensitive ground`,
      detail: 'Ground sinking can crack roads, tilt foundations and strain pipelines.',
      metrics: [
        { label: 'Roads on unstable ground', value: `${roadsKm} km` },
        { label: 'Buildings in area', value: `${Math.round(people / 3)}` },
        { label: 'Pipeline length', value: `${Math.round(roadsKm * 0.4)} km` },
      ],
    },
    health: {
      level: levelFor(severity * jitter() * 0.9),
      headline: `${people.toLocaleString()} people live in this area`,
      detail: 'Thaw can disrupt water and sanitation systems and release stored contaminants.',
      metrics: [
        { label: 'Residents', value: people.toLocaleString() },
        { label: 'Water / sewage facilities', value: `${Math.max(0, Math.round(people / 900))}` },
        { label: 'Known contaminated sites', value: `${Math.round(severity * 6 * random())}` },
      ],
    },
    economy: {
      level: levelFor(severity * jitter()),
      headline: `~$${cost}M in assets on thawing ground`,
      detail: 'Repair and relocation costs rise as the ground beneath infrastructure shifts.',
      metrics: [
        { label: 'Assets exposed', value: `$${cost}M` },
        { label: 'Est. annual repairs', value: `$${(Number(cost) * 0.06).toFixed(1)}M` },
        { label: 'Key industries', value: severity > 0.5 ? 'Oil & gas, transport' : 'Transport, tourism' },
      ],
    },
  };
}
