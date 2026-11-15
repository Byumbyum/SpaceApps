import { describe, expect, it } from 'vitest';
import type { NisarSite } from '../types';
import { circleRing } from './geo';
import { siteFile, siteForArea } from './nisarSites';

const site = (id: string, base: string, [w, s, e, n]: number[]): NisarSite => ({
  id, label: id, base, corners: [[w, n], [e, n], [e, s], [w, s]], firstDate: '2026-06-01', lastDate: '2026-09-30', passCount: 10, changeTracks: 2, note: null,
});
const sites = [site('fairbanks', '/data/nisar', [-148.1, 64.6, -147.4, 65.1]), site('blatten', '/data/nisar/blatten', [7.7, 46.3, 7.9, 46.5])];

describe('siteForArea', () => {
  it('picks the site a selection overlaps', () => {
    expect(siteForArea(sites, circleRing([7.8, 46.4], 2))?.id).toBe('blatten');
    expect(siteForArea(sites, circleRing([-147.7, 64.8], 2))?.id).toBe('fairbanks');
  });

  it('returns null away from any processed site', () => {
    expect(siteForArea(sites, circleRing([0, 0], 5))).toBeNull();
    expect(siteForArea(sites, undefined)).toBeNull();
  });

  it('builds file URLs inside the site folder', () => {
    expect(siteFile(sites[1], 'gcov.json')).toBe('/data/nisar/blatten/gcov.json');
  });
});
