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
  };
}
