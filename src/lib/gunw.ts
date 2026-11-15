import type { GunwData } from '../types';
import { distanceKm, insideRing, type LngLat } from './geo';

export interface GunwSummary {
  track: string;
  direction: 'ascending' | 'descending';
  first: string;
  last: string;
  /** Median cumulative line-of-sight movement in the area, cm; negative = away from the satellite. */
  losCm: number;
  /** Rough vertical equivalent, assuming the motion is purely up/down. */
  verticalCm: number;
  cellCount: number;
  trackCount: number;
  series: Array<{ date: string; cm: number | null }>;
  /** Stefan thaw model over the area: median seasonal thaw movement (cm) and fit quality. */
  thaw: { seasonalCm: number; r2: number; addtStart: number; addtEnd: number } | null;
  /** The same fit using ERA5-Land temperatures, when available. */
  thawEra5: { seasonalCm: number; r2: number; addtStart: number; addtEnd: number } | null;
  /** Independent measurements of the same thing, and whether they agree. */
  crossChecks: {
    /** A second orbit (ideally the opposite direction) over the same cells. */
    orbit: { track: string; direction: 'ascending' | 'descending'; cm: number; differenceCm: number; agree: boolean } | null;
    /** Degree days of thaw from NASA POWER vs ERA5-Land at the last radar date. */
    temperature: { power: number; era5: number; differencePct: number; timing: number; agree: boolean } | null;
  };
}

// Agreement thresholds: within 1 cm or half the signal for movement (provisional InSAR
// noise is about a centimetre); thaw curves correlated at 0.99 or better for temperature.
const ORBIT_TOLERANCE_CM = 1;
const TIMING_AGREEMENT = 0.99;
// Beyond this, the size difference between temperature sources is worth explaining.
export const TEMPERATURE_OFFSET_PCT = 15;

function correlation(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i += 1) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va && vb ? cov / Math.sqrt(va * vb) : 0;
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Ground movement in a selection: for each track, the median over cells of the cumulative
 * movement at every date. Reported from the track that covers the area with the most cells
 * and the longest record, since tracks look from different angles and are not averaged.
 */
export function summarizeGunw(gunw: GunwData, ring: LngLat[], center: LngLat): GunwSummary | null {
  let cells = gunw.cells.filter((cell) => insideRing(cell.center, ring));
  if (!cells.length) {
    const nearest = gunw.cells.reduce<GunwData['cells'][number] | null>((best, cell) => (!best || distanceKm(cell.center, center) < distanceKm(best.center, center) ? cell : best), null);
    if (!nearest || distanceKm(nearest.center, center) > 1.5) return null;
    cells = [nearest];
  }
  const candidates = gunw.tracks.map((track) => {
    const series = track.dates.map((date, index) => {
      const values = cells.map((cell) => cell.los[track.key]?.[index]).filter((value): value is number => value !== null && value !== undefined);
      return { date, cm: index === 0 ? 0 : median(values), n: values.length };
    });
    const last = [...series].reverse().find((point) => point.cm !== null && point.n > 0);
    return { track, series, last, cells: last?.n ?? 0 };
  }).filter((candidate) => candidate.last && candidate.series.length > 2);
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => b.cells - a.cells || b.series.length - a.series.length)[0];
  const losCm = best.last!.cm!;
  const thawFit = (key: 'stefan' | 'stefanEra5', addt: Array<number | null> | undefined) => {
    const fits = cells.map((cell) => cell[key]).filter((fit): fit is NonNullable<typeof fit> => !!fit);
    return fits.length && addt?.length && addt[0] !== null && addt.at(-1) !== null
      ? { seasonalCm: median(fits.map((fit) => fit.seasonal))!, r2: median(fits.map((fit) => fit.r2))!, addtStart: addt[0]!, addtEnd: addt.at(-1)! }
      : null;
  };
  const thaw = thawFit('stefan', best.track.addt);
  const thawEra5 = thawFit('stefanEra5', best.track.addtEra5);

  const others = candidates.filter((candidate) => candidate !== best && candidate.cells >= Math.max(1, best.cells * 0.5));
  const second = others.find((candidate) => candidate.track.direction !== best.track.direction) ?? others[0];
  const orbit = second ? (() => {
    const cm = second.last!.cm!;
    const differenceCm = cm - losCm;
    return { track: second.track.track, direction: second.track.direction, cm, differenceCm, agree: Math.abs(differenceCm) <= Math.max(ORBIT_TOLERANCE_CM, 0.5 * Math.max(Math.abs(cm), Math.abs(losCm))) };
  })() : null;
  // The Stefan fit depends on the shape of the thaw curve (√ADDT over the season), not on
  // its absolute level, so the sources agree when their curves move together; a constant
  // offset between them (grid size, elevation) is reported but does not change the fit.
  const powerSeries = best.track.addt;
  const era5Series = best.track.addtEra5;
  const temperature = powerSeries?.every((v) => v !== null) && era5Series?.every((v) => v !== null) && powerSeries.length > 2 ? (() => {
    const power = powerSeries.at(-1)!;
    const era5 = era5Series.at(-1)!;
    const timing = correlation(powerSeries.map((v) => Math.sqrt(v!)), era5Series.map((v) => Math.sqrt(v!)));
    return { power, era5, differencePct: ((era5 - power) / power) * 100, timing, agree: timing >= TIMING_AGREEMENT };
  })() : null;
  return {
    track: best.track.track,
    direction: best.track.direction,
    first: best.series[0].date,
    last: best.last!.date,
    losCm,
    verticalCm: losCm / Math.cos((gunw.nominal_incidence_deg * Math.PI) / 180),
    cellCount: best.cells,
    trackCount: candidates.length,
    series: best.series.map(({ date, cm }) => ({ date, cm })),
    thaw,
    thawEra5,
    crossChecks: { orbit, temperature },
  };
}
