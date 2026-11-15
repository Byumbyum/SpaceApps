import { describe, expect, it } from 'vitest';
import type { GunwData } from '../types';
import { circleRing } from './geo';
import { summarizeGunw } from './gunw';

const gunw: GunwData = {
  product: 'NISAR L2 GUNW', maturity: 'PROVISIONAL', quantity: '', corrections: {}, nominal_incidence_deg: 37,
  corners: [[-148, 65], [-147, 65], [-147, 64.7], [-148, 64.7]],
  map: { file: 'gunw-motion.png', track: '044D|055|4000', limit_cm: 6, first: '2026-06-17', last: '2026-09-09' },
  tracks: [{ key: '044D|055|4000', track: '044D', direction: 'descending', mode: '4000', dates: ['2026-06-17', '2026-06-29', '2026-07-11'] }],
  cells: [
    { id: 'a', center: [-147.7, 64.84], los: { '044D|055|4000': [0, -1, -2] } },
    { id: 'b', center: [-147.71, 64.845], los: { '044D|055|4000': [0, -1.5, -3] } },
    { id: 'c', center: [-147.2, 64.75], los: { '044D|055|4000': [0, 2, 4] } },
  ],
};

describe('summarizeGunw', () => {
  it('reports the median cumulative movement of cells in the area, with a vertical equivalent', () => {
    const summary = summarizeGunw(gunw, circleRing([-147.7, 64.84], 3), [-147.7, 64.84])!;
    expect(summary.losCm).toBeCloseTo(-2.5);
    expect(summary.verticalCm).toBeCloseTo(-2.5 / Math.cos((37 * Math.PI) / 180));
    expect(summary.last).toBe('2026-07-11');
    expect(summary.cellCount).toBe(2);
  });

  it('returns nothing far from any measured cell', () => {
    expect(summarizeGunw(gunw, circleRing([-140, 60], 3), [-140, 60])).toBeNull();
  });
});
