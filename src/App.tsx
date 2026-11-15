import { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronIcon } from './components/Icons';
import { StoryMode } from './components/StoryMode';
import { useAppStore } from './store';
import type { AppMode, DemoCellProperties, DemoManifest, NisarSite, TimePoint } from './types';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface AppData {
  cells: Collection<DemoCellProperties>;
  series: TimePoint[];
  sites: NisarSite[];
}

const ExploreMode = lazy(() => import('./components/ExploreMode').then((module) => ({ default: module.ExploreMode })));
const Tutorial = lazy(() => import('./components/Tutorial').then((module) => ({ default: module.Tutorial })));

const AboutData = lazy(() => import('./components/AboutData').then((module) => ({ default: module.AboutData })));

function AboutPage() {
  const [manifest, setManifest] = useState<DemoManifest | null>(null);
  useEffect(() => { fetch('/data/manifest.json').then((response) => response.json() as Promise<DemoManifest>).then(setManifest).catch(() => undefined); }, []);
  return manifest ? <AboutData manifest={manifest} /> : <main className="loading-state"><div className="loading-orbit" /><p>Loading…</p></main>;
}

const MORE_PAGES: Array<{ mode: AppMode; label: string; hint: string }> = [
  { mode: 'tutorial', label: 'Tutorial', hint: 'A guided tour of the map' },
  { mode: 'about', label: 'About', hint: 'Data sources and method' },
];

function MoreMenu({ mode, onPick }: { mode: AppMode; onPick: (mode: AppMode) => void }) {
  const [open, setOpen] = useState(false);
  const current = MORE_PAGES.some((page) => page.mode === mode);
  return (
    <div className="more-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button className={`tutorial-pill ${current ? 'active' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        More <ChevronIcon style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div className="more-popover" role="menu">
          {MORE_PAGES.map((page) => (
            <button key={page.mode} role="menuitem" className={mode === page.mode ? 'active' : ''} onClick={() => { setOpen(false); onPick(page.mode); }}>
              <b>{page.label}</b><span>{page.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/cells.geojson').then((response) => response.json() as Promise<Collection<DemoCellProperties>>),
      fetch('/data/time-series.json').then((response) => response.json() as Promise<TimePoint[]>),
      // Processed NISAR sites; optional so the app still runs before `npm run data:gcov`.
      fetch('/data/nisar/sites.json').then((response) => (response.ok ? (response.json() as Promise<NisarSite[]>) : [])).catch(() => []),
    ])
      .then(([cells, series, sites]) => setData({ cells, series, sites }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load map layers'));
  }, []);

  const loading = <main className="loading-state"><div className="loading-orbit" /><p>Opening the map…</p></main>;
  const mapPage = !data ? loading : (
    <Suspense fallback={loading}>
      <ExploreMode cells={data.cells} series={data.series} sites={data.sites} />
      {mode === 'tutorial' && <Tutorial />}
    </Suspense>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setMode('story')} aria-label="Ground Truth North home"><span className="brand-mark" aria-hidden="true" /><span>Ground Truth North</span></button>
        <nav aria-label="Primary navigation">
          <button className={mode === 'story' ? 'active' : ''} onClick={() => setMode('story')}>Story</button>
          <button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Map</button>
        </nav>
        <MoreMenu mode={mode} onPick={setMode} />
      </header>
      {mode === 'story' ? <StoryMode /> : mode === 'about' ? <Suspense fallback={loading}><AboutPage /></Suspense> : error ? <main className="loading-state"><h1>Map layers could not load</h1><p>{error}</p></main> : mapPage}
    </div>
  );
}
