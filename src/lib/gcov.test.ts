import { describe, expect, it } from 'vitest';
import type { GcovData } from '../types';
import { circleRing } from './geo';
import { summarizeGcov } from './gcov';

const center: [number, number] = [-147.75, 64.85];
const pass = (date: string, track: string) => ({ date, track, direction: 'ascending' as const, resolution: '10 m', polarization: 'DHDH', valid_fraction: 1 });

// Track 020A reads ~9 dB darker than 044D over the same ground, as in the real provisional data.
const gcov: GcovData = {
  product: 'NISAR L2 GCOV', maturity: 'PROVISIONAL', quantity: 'gamma0', generated_at: '', gap: ['2026-07-27', '2026-08-10'],
  corners: [[-148, 64.7], [-148, 65], [-147.5, 65], [-147.5, 64.7]], water_threshold_db: -18, composite_date: '2026-08-29', composite_track: '044D', tracks_in_change_map: 2,
  passes: [pass('2026-06-17', '044D'), pass('2026-06-27', '020A'), pass('2026-08-16', '044D'), pass('2026-08-26', '020A')],
  cells: [{ id: 'g0-0', center, hh: [-10, -19, -9, -18], hv: [-16, -25, -15, -24], water: [2, 60, 3, 62], lc: [[10, 300, 0.4], [50, 100, -1.2]] }],
  landcover: { source: 'ESA WorldCover', excluded: [80], classes: { 10: { label: 'Tree cover', color: '#006400' }, 50: { label: 'Built-up', color: '#fa0000' } } },
};

describe('GCOV area summary', () => {
  it('compares each track only with itself, so a darker track cannot fake a change', () => {
    const summary = summarizeGcov(gcov, circleRing(center, 5), center);
    expect(summary?.changeDb).toBeCloseTo(1, 5);
    expect(summary?.trackCount).toBe(2);
    expect(summary?.passCount).toBe(4);
    for (const point of summary?.series ?? []) expect(Math.abs(point.anomalyDb)).toBeCloseTo(0.5, 5);
  });

  it('breaks the selection down by land cover, largest share first', () => {
    const [trees, built] = summarizeGcov(gcov, circleRing(center, 5), center)?.landcover ?? [];
    expect(trees).toMatchObject({ label: 'Tree cover', sharePct: 75, changeDb: 0.4 });
    expect(built).toMatchObject({ label: 'Built-up', sharePct: 25, changeDb: -1.2 });
  });

  it('falls back to the nearest cell for a small area inside the footprint and returns null outside it', () => {
    expect(summarizeGcov(gcov, circleRing([-147.6, 64.9], 0.3), [-147.6, 64.9])?.cellCount).toBe(1);
    expect(summarizeGcov(gcov, circleRing([-150, 70], 5), [-150, 70])).toBeNull();
  });
});
