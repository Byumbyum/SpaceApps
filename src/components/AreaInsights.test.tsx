import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { circleRing } from '../lib/geo';
import { useAppStore } from '../store';
import { AreaInsights } from './AreaInsights';

const center: [number, number] = [-148.34, 70.26];

describe('area insights panel', () => {
  beforeEach(() => useAppStore.setState({
    selectedArea: { id: '1', shape: 'circle', center, ring: circleRing(center, 20), areaKm2: 1257, name: 'Prudhoe Bay', region: 'Alaska, United States' },
    phenomenon: 'permafrost',
    analysisOpen: false,
  }));

  it('shows permafrost impacts on safety, health and economy and opens the detail drawer', () => {
    render(<AreaInsights />);
    expect(screen.getByRole('heading', { name: 'Prudhoe Bay' })).toBeTruthy();
    for (const label of ['Safety', 'Health', 'Economy']) expect(screen.getByText(label)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /View detailed insights/ }));
    expect(useAppStore.getState().analysisOpen).toBe(true);
  });

  it('switches to a coming-soon phenomenon from the bottom toggle', () => {
    render(<AreaInsights />);
    fireEvent.click(screen.getByRole('button', { name: /Climate phenomenon/ }));
    fireEvent.click(screen.getByRole('button', { name: /Deforestation/ }));
    expect(useAppStore.getState().phenomenon).toBe('deforestation');
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
  });

  it('renders nothing until an area is selected', () => {
    useAppStore.setState({ selectedArea: null });
    const { container } = render(<AreaInsights />);
    expect(container.firstChild).toBeNull();
  });
});
