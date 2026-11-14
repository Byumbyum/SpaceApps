import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../store';
import type { DemoCellProperties } from '../types';
import { SelectionInsight } from './SelectionInsight';

const cell: DemoCellProperties = {
  id: 'cell-00-00', row: 0, col: 0, latitude: 69.5, longitude: -149.5,
  motion_cm_yr: -1.8, motion_uncertainty_cm: 0.4, q: 0.8, e: 0.7,
  q_band: 'high', e_band: 'medium', excluded: false, exclusion_reason: null,
  area_name: 'Northern Dalton corridor', provisional: true, coherence: 0.8,
};

describe('selection insight', () => {
  beforeEach(() => useAppStore.setState({ selectedCellIds: ['cell-00-00'], analysisOpen: false }));

  it('summarizes impacts on the map and opens the optional data drawer', () => {
    render(<SelectionInsight cells={[{ properties: cell }]} />);

    expect(screen.getByText('Safety')).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
    expect(screen.getByText('Economy')).toBeTruthy();
    expect(screen.getByText('-1.80')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /View datasets and evidence/i }));
    expect(useAppStore.getState().analysisOpen).toBe(true);
  });
});
