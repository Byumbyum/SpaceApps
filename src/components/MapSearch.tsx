import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACES, type Place } from '../lib/geo';
import { searchPlaces, suggestPlaces } from '../lib/geocode';
import { CloseIcon, PinIcon, SearchIcon } from './Icons';

const SUGGEST_DELAY_MS = 250; // wait for a pause in typing before asking Photon
const SUGGEST_MIN_CHARS = 2;
const MAX_RESULTS = 6;

export function MapSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Suggestions are tagged with the text they answer, so stale ones are never shown.
  const [suggested, setSuggested] = useState<{ term: string; places: Place[] } | null>(null);
  const [remote, setRemote] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < SUGGEST_MIN_CHARS) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      suggestPlaces(term, controller.signal)
        .then((places) => setSuggested({ term, places }))
        .catch(() => undefined);
    }, SUGGEST_DELAY_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [term]);

  const results = useMemo(() => {
    if (remote) return remote;
    if (!term) return PLACES.slice(0, MAX_RESULTS);
    const lower = term.toLowerCase();
    const local = PLACES.filter((place) => `${place.name} ${place.region}`.toLowerCase().includes(lower));
    const online = suggested?.term === term ? suggested.places : [];
    // Our permafrost places first, then worldwide suggestions not already listed.
    const merged = [...local, ...online.filter((place) => !local.some((item) => item.name === place.name && item.region === place.region))];
    return merged.slice(0, MAX_RESULTS);
  }, [remote, term, suggested]);
  const waiting = term.length >= SUGGEST_MIN_CHARS && !remote && suggested?.term !== term;

  const pick = (place: Place) => {
    setQuery(place.name);
    setOpen(false);
    setRemote(null);
    onPick(place);
  };

  // Enter with nothing suggested falls back to a full Nominatim search.
  const runRemoteSearch = async () => {
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
        if (term && results.length) pick(results[active] ?? results[0]);
        else void runRemoteSearch();
      }}>
        <SearchIcon className="search-icon" />
        <input
          value={query}
          placeholder="Search a place"
          aria-label="Search a place"
          autoComplete="off"
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
          {!term && <div className="search-hint">Permafrost places</div>}
          {results.map((place, index) => (
            <button key={`${place.name}-${place.center.join()}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => pick(place)}>
              <PinIcon /><span><b>{place.name}</b><small>{place.region}</small></span>
            </button>
          ))}
          {(searching || (waiting && !results.length)) && <div className="search-hint">Searching…</div>}
          {!searching && !waiting && term && !results.length && (remote
            ? <div className="search-hint">No places found.</div>
            : <button className="search-more" onClick={() => void runRemoteSearch()}><SearchIcon />Search everywhere for “{term}”</button>)}
        </div>
      )}
    </div>
  );
}
