import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store';
import type { DemoCellProperties, SegmentProperties } from '../types';

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor() {
      throw new Error('WebGL unavailable for test');
    }
  },
  NavigationControl: class {},
  AttributionControl: class {},
}));

import { MapPanel } from './MapPanel';

const cell: DemoCellProperties = {
  id: 'cell-00-00', row: 0, col: 0, latitude: 69.5, longitude: -149.5, motion_cm_yr: -1.4, motion_uncertainty_cm: 0.4,
  q: 0.8, e: 0.7, q_band: 'high', e_band: 'medium', excluded: false,
  exclusion_reason: null, area_name: 'Northern Dalton corridor', provisional: true,
  coherence: 0.8,
};

const cells = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, id: 1, properties: cell, geometry: {} }] };
const segments = { type: 'FeatureCollection' as const, features: [] as Array<{ type: 'Feature'; properties: SegmentProperties; geometry: unknown }> };

describe('map compatibility fallback', () => {
  beforeEach(() => useAppStore.setState({ tool: 'select', selectedCellIds: [], focusedCellId: null }));

  it('keeps selection functional when WebGL initialization fails', () => {
    render(<MapPanel cells={cells} segments={segments} />);
    expect(screen.getByText('Compatibility map active')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Northern Dalton corridor/ }));
    expect(useAppStore.getState().selectedCellIds).toContain('cell-00-00');
    expect(useAppStore.getState().focusedCellId).toBe('cell-00-00');
  });
});
