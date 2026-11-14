import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemoCellProperties, SegmentProperties } from '../types';

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: () => undefined,
  Map: class {
    constructor() {
      throw new Error('WebGL unavailable for test');
    }
  },
  AttributionControl: class {},
  ScaleControl: class {},
}));

import { MapPanel } from './MapPanel';

const cells = { type: 'FeatureCollection' as const, features: [] as Array<{ type: 'Feature'; properties: DemoCellProperties; geometry: unknown }> };
const segments = { type: 'FeatureCollection' as const, features: [] as Array<{ type: 'Feature'; properties: SegmentProperties; geometry: unknown }> };

describe('map panel', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); });

  it('explains clearly when WebGL cannot start, keeping search available', async () => {
    render(<MapPanel cells={cells} segments={segments} />);
    expect(await screen.findByText('The interactive map couldn’t start')).toBeTruthy();
    expect(screen.getByLabelText('Search a place')).toBeTruthy();
  });
});
