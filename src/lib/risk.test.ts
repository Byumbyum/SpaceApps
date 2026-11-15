import { describe, expect, it } from 'vitest';
import { HOTSPOTS } from '../data/hotspots';
import { circleRing } from './geo';
import { hotspotFeatures, hotspotsInArea, ipccVulnerability, riskLevel, riskScore } from './risk';

describe('risk = f(hazard, exposure, vulnerability) (IPCC)', () => {
  it('falls towards zero when nobody is exposed, and coping capacity lowers vulnerability', () => {
    const base = { hazard: 0.9, exposure: 0.8, vulnerability: 0.7 };
    expect(riskScore({ ...base, exposure: 0 })).toBeLessThan(0.2);
    expect(ipccVulnerability(0.7, 0.9)).toBeLessThan(ipccVulnerability(0.7, 0.3));
    expect(riskLevel(riskScore(base))).toBe('High');
  });

  it('finds hotspots overlapping a selection, highest risk first', () => {
    const found = hotspotsInArea(HOTSPOTS, circleRing([129.73, 62.03], 30), [129.73, 62.03]);
    expect(found[0].spot.id).toBe('yakutsk');
    expect(hotspotsInArea(HOTSPOTS, circleRing([0, 0], 30), [0, 0])).toHaveLength(0);
  });

  it('draws three halo rings per hotspot', () => {
    expect(hotspotFeatures(HOTSPOTS.slice(0, 2)).features).toHaveLength(6);
  });
});
