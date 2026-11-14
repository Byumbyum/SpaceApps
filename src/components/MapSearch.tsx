import { useMemo, useRef, useState } from 'react';
import { PLACES, type Place } from '../lib/geo';
import { searchPlaces } from '../lib/geocode';
import { CloseIcon, PinIcon, SearchIcon } from './Icons';

export function MapSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const local = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return PLACES.slice(0, 6);
    return PLACES.filter((place) => `${place.name} ${place.region}`.toLowerCase().includes(term)).slice(0, 6);
  }, [query]);
  const results = remote ?? local;

  const pick = (place: Place) => {
    setQuery(place.name);
    setOpen(false);
    setRemote(null);
    onPick(place);
  };

  const runRemoteSearch = async () => {
    const term = query.trim();
    if (!term) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const found = await searchPlaces(term, controller.signal);
      setRemote(found);
      setActive(0);
      if (found.length === 1) pick(found[0]);
    } catch {
      if (!controller.signal.aborted) setRemote([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="map-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <form className="search-box" role="search" onSubmit={(event) => {
        event.preventDefault();
        if (remote?.length) pick(remote[active] ?? remote[0]);
        else if (!remote && local.length && query.trim()) pick(local[active] ?? local[0]);
        else void runRemoteSearch();
      }}>
        <SearchIcon className="search-icon" />
        <input
          value={query}
          placeholder="Search a place"
          aria-label="Search a place"
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setRemote(null); setActive(0); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {query && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => { setQuery(''); setRemote(null); }}><CloseIcon /></button>}
      </form>
      {open && (
        <div className="search-results" role="listbox">
          {!query.trim() && <div className="search-hint">Permafrost places</div>}
          {results.map((place, index) => (
            <button key={`${place.name}-${place.center.join()}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => pick(place)}>
              <PinIcon /><span><b>{place.name}</b><small>{place.region}</small></span>
            </button>
          ))}
          {searching && <div className="search-hint">Searching…</div>}
          {!searching && query.trim() && !results.length && <div className="search-hint">{remote ? 'No places found.' : 'Press Enter to search everywhere.'}</div>}
          {!searching && query.trim() && !remote && results.length > 0 && <button className="search-more" onClick={() => void runRemoteSearch()}><SearchIcon />Search everywhere for “{query.trim()}”</button>}
        </div>
      )}
    </div>
  );
}
