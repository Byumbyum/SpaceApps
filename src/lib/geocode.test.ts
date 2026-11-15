import { afterEach, describe, expect, it, vi } from 'vitest';
import { suggestPlaces } from './geocode';

const feature = (name: string, osm_value: string, country: string, state?: string) => ({ geometry: { coordinates: [0, 0] }, properties: { name, osm_value, country, state } });

describe('suggestPlaces', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists one Singapore first and puts the Michigan hamlet below bigger places', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [
      feature('Singapore', 'country', 'Singapore'),
      feature('Singapore', 'city', 'Singapore'),
      feature('Singapore', 'hamlet', 'United States', 'Michigan'),
      feature('Singapore Strait', 'strait', 'Indonesia', 'Riau Islands'),
    ] }) })));
    const places = await suggestPlaces('singapore');
    expect(places.map((place) => `${place.name} | ${place.region}`)).toEqual([
      'Singapore | Country',
      'Singapore Strait | Riau Islands, Indonesia',
      'Singapore | Michigan, United States · hamlet',
    ]);
  });
});
