import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../store';
import { Tutorial } from './Tutorial';

describe('tutorial', () => {
  beforeEach(() => useAppStore.setState({ mode: 'tutorial', selectedArea: null, showHotspots: false }));

  it('advances with space, right arrow and click, goes back with left arrow, and exits with Escape', () => {
    render(<Tutorial />);
    expect(screen.getByText('Welcome to Ground Truth North')).toBeTruthy();
    expect(useAppStore.getState().showHotspots).toBe(true);
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('The map')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Search anywhere')).toBeTruthy();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByText('Risk hotspots, worldwide')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Search anywhere')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useAppStore.getState().mode).toBe('explore');
  });
});
