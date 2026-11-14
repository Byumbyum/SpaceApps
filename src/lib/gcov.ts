import type { GcovData } from '../types';
import { distanceKm, insideRing, type LngLat } from './geo';

export interface GcovSeriesPoint {
  date: string;
  track: string;
  anomalyDb: number;
  waterPct: number | null;
}

export interface LandcoverShare {
  code: number;
  label: string;
  color: string;
  sharePct: number;
  changeDb: number | null;
}

export interface GcovSummary {
  cellCount: number;
  passCount: number;
  trackCount: number;
  firstDate: string;
  lastDate: string;
  /** Median across tracks of (late-summer mean − early-summer mean) HH backscatter, dB. */
  changeDb: number | null;
  waterEarlyPct: number | null;
  waterLatePct: number | null;
  series: GcovSeriesPoint[];
  /** Land-cover mix of the selection (permanent water excluded), largest first. */
  landcover: LandcoverShare[];
}

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const present = (values: Array<number | null>) => values.filter((value): value is number => value !== null);

export function isInsideFootprint(gcov: GcovData, point: LngLat) {
  return insideRing(point, [...gcov.corners, gcov.corners[0]]);
}

/**
 * Summarize GCOV backscatter for a selected area. Every comparison happens within one
 * track (same viewing geometry) before tracks are combined, because absolute brightness
 * differs between tracks — in this provisional dataset by several dB for one track.
 */
export function summarizeGcov(gcov: GcovData, ring: LngLat[], center: LngLat): GcovSummary | null {
  let cells = gcov.cells.filter((cell) => insideRing(cell.center, ring));
  if (!cells.length && isInsideFootprint(gcov, center)) {
    const nearest = gcov.cells.reduce((best, cell) => (distanceKm(cell.center, center) < distanceKm(best.center, center) ? cell : best));
    cells = [nearest];
  }
  if (!cells.length) return null;

  const [gapStart, gapEnd] = gcov.gap;
  const perPass = gcov.passes.map((pass, index) => ({
    ...pass,
    hh: mean(present(cells.map((cell) => cell.hh[index]))),
    water: mean(present(cells.map((cell) => cell.water[index]))),
  }));

  const tracks = new Map<string, typeof perPass>();
  for (const pass of perPass) {
    if (pass.hh === null) continue;
    // A track flown in two modes (10 m / 20 m) is treated as two geometries.
    const key = `${pass.track} ${pass.resolution}`;
    tracks.set(key, [...(tracks.get(key) ?? []), pass]);
  }

  const changes: number[] = [];
  const waterEarly: number[] = [];
  const waterLate: number[] = [];
  const series: GcovSeriesPoint[] = [];
  for (const [track, passes] of tracks) {
    const trackMean = mean(passes.map((pass) => pass.hh as number));
    if (passes.length >= 2 && trackMean !== null) {
      passes.forEach((pass) => series.push({ date: pass.date, track, anomalyDb: Number(((pass.hh as number) - trackMean).toFixed(2)), waterPct: pass.water === null ? null : Number(pass.water.toFixed(1)) }));
    }
    const early = passes.filter((pass) => pass.date < gapStart);
    const late = passes.filter((pass) => pass.date > gapEnd);
    if (!early.length || !late.length) continue;
    changes.push((mean(late.map((pass) => pass.hh as number)) as number) - (mean(early.map((pass) => pass.hh as number)) as number));
    const we = mean(present(early.map((pass) => pass.water)));
    const wl = mean(present(late.map((pass) => pass.water)));
    if (we !== null && wl !== null) { waterEarly.push(we); waterLate.push(wl); }
  }

  const classTotals = new Map<number, { blocks: number; changeSum: number; changeBlocks: number }>();
  for (const cell of cells) {
    for (const [code, blocks, changeDb] of cell.lc ?? []) {
      const total = classTotals.get(code) ?? { blocks: 0, changeSum: 0, changeBlocks: 0 };
      total.blocks += blocks;
      if (changeDb !== null) { total.changeSum += changeDb * blocks; total.changeBlocks += blocks; }
      classTotals.set(code, total);
    }
  }
  const allBlocks = [...classTotals.values()].reduce((sum, total) => sum + total.blocks, 0);
  const landcover: LandcoverShare[] = [...classTotals]
    .map(([code, total]) => ({
      code,
      label: gcov.landcover?.classes[code]?.label ?? `Class ${code}`,
      color: gcov.landcover?.classes[code]?.color ?? '#9aa0a6',
      sharePct: allBlocks ? (total.blocks / allBlocks) * 100 : 0,
      changeDb: total.changeBlocks ? total.changeSum / total.changeBlocks : null,
    }))
    .sort((a, b) => b.sharePct - a.sharePct);

  const dated = perPass.filter((pass) => pass.hh !== null);
  if (!dated.length) return null;
  return {
    cellCount: cells.length,
    passCount: dated.length,
    trackCount: tracks.size,
    firstDate: dated[0].date,
    lastDate: dated[dated.length - 1].date,
    changeDb: median(changes),
    waterEarlyPct: median(waterEarly),
    waterLatePct: median(waterLate),
    series: series.sort((a, b) => a.date.localeCompare(b.date)),
    landcover,
  };
}

export function describeChange(changeDb: number | null) {
  if (changeDb === null) return 'Not enough passes on both sides of the July–August gap';
  if (Math.abs(changeDb) < 0.5) return 'Little change in radar brightness over the summer';
  return changeDb > 0
    ? 'Brighter radar return: often wetter soil or denser vegetation'
    : 'Darker radar return: possible new standing water or drying surface';
}
