import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapSearch } from './MapSearch';

vi.mock('../lib/geocode', () => ({
  searchPlaces: vi.fn(async () => []),
  suggestPlaces: vi.fn(async (query: string) => (query.toLowerCase().startsWith('vanc') ? [{ name: 'Vancouver', region: 'British Columbia, Canada', center: [-123.1, 49.3] }] : [])),
}));

describe('MapSearch', () => {
  it('suggests places while typing, even when misspelled', async () => {
    const onPick = vi.fn();
    render(<MapSearch onPick={onPick} />);
    const input = screen.getByRole('textbox', { name: 'Search a place' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'vancuver' } });
    fireEvent.click(await screen.findByText('Vancouver'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vancouver' }));
  });
});
