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

  it('switches to a phenomenon not in this demo from the bottom toggle', () => {
    render(<AreaInsights />);
    fireEvent.click(screen.getByRole('button', { name: /Climate phenomenon/ }));
    fireEvent.click(screen.getByRole('button', { name: /Forest loss trends/ }));
    expect(useAppStore.getState().phenomenon).toBe('deforestation');
    expect(screen.getByText(/not part of this NASA Space Apps demo/i)).toBeTruthy();
  });

  it('ranks mapped risk hotspots in the area with their IPCC factors', () => {
    render(<AreaInsights />);
    expect(screen.getByText('Risk hotspot')).toBeTruthy();
    expect(screen.getByText('Prudhoe Bay oil field')).toBeTruthy();
    for (const factor of ['Hazard', 'Exposure', 'Vulnerability']) expect(screen.getByText(factor)).toBeTruthy();
  });

  it('groups phenomena into what we can predict and what we can measure', () => {
    render(<AreaInsights />);
    fireEvent.click(screen.getByRole('button', { name: /Climate phenomenon/ }));
    expect(screen.getByText('What we can predict')).toBeTruthy();
    expect(screen.getByText('What we can measure')).toBeTruthy();
  });

  it('shows no ground data over open ocean', () => {
    const ocean: [number, number] = [-150, 30];
    useAppStore.setState({ selectedArea: { id: '2', shape: 'circle', center: ocean, ring: circleRing(ocean, 20), areaKm2: 1257, name: 'Pacific Ocean', region: '' } });
    render(<AreaInsights />);
    expect(screen.getByText('Open water')).toBeTruthy();
    expect(screen.queryByText(/Ground sinking/)).toBeNull();
  });

  it('renders nothing until an area is selected', () => {
    useAppStore.setState({ selectedArea: null });
    const { container } = render(<AreaInsights />);
    expect(container.firstChild).toBeNull();
  });
});
