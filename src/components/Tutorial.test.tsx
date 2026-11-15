import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../store';
import { Tutorial } from './Tutorial';

describe('tutorial', () => {
  beforeEach(() => useAppStore.setState({ mode: 'tutorial', genie: null, selectedArea: null, showHotspots: false }));

  it('advances with space, right arrow and click, goes back with left arrow, and exits with Escape', async () => {
    render(<Tutorial />);
    expect(screen.getByText('Welcome to Prescient')).toBeTruthy();
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
    // Closing folds the page back into the corner first.
    expect(useAppStore.getState().genie).toBe('close');
    await waitFor(() => expect(useAppStore.getState().mode).toBe('explore'), { timeout: 2500 });
  });
});
