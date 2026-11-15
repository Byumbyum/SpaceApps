import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ChevronIcon, CloseIcon } from './components/Icons';
import { AboutData } from './components/AboutData';
import { DisclaimerPage } from './components/DisclaimerPage';
import { Genie } from './components/Genie';
import { Preamble } from './components/Preamble';
import { StoriesPage } from './components/StoriesPage';
import { Tutorial } from './components/Tutorial';
import { isMoreMode, useAppStore } from './store';
import type { AppMode, DemoCellProperties, DemoManifest, NisarSite, TimePoint } from './types';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface AppData {
  cells: Collection<DemoCellProperties>;
  series: TimePoint[];
  sites: NisarSite[];
}

const ExploreMode = lazy(() => import('./components/ExploreMode').then((module) => ({ default: module.ExploreMode })));

const MAIN_PAGES: Array<{ mode: AppMode; label: string }> = [
  { mode: 'preamble', label: 'Preamble' },
  { mode: 'explore', label: 'Map' },
];

const MORE_PAGES: Array<{ mode: AppMode; label: string; hint: string }> = [
  { mode: 'tutorial', label: 'Tutorial', hint: 'A guided tour of the map' },
  { mode: 'stories', label: 'Stories', hint: 'Real events behind each phenomenon' },
  { mode: 'disclaimer', label: 'Demo disclaimer', hint: 'Which data is real, researched or sample' },
  { mode: 'about', label: 'About', hint: 'Data sources and method' },
];

const HINT_MS = 5000;
const HINT_STOW_MS = 650;

function AboutPage({ manifest }: { manifest: DemoManifest | null }) {
  return manifest ? <AboutData manifest={manifest} /> : <main className="loading-state"><div className="loading-orbit" /><p>Loading…</p></main>;
}

function MoreMenu() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const tutorialFound = useAppStore((state) => state.tutorialFound);
  const [open, setOpen] = useState(false);
  return (
    <div className="more-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button className={`more-pill ${tutorialFound ? 'filled' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        More <ChevronIcon style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div className="more-popover" role="menu">
          {MORE_PAGES.map((page) => (
            <button key={page.mode} role="menuitem" className={mode === page.mode ? 'active' : ''} onClick={() => { setOpen(false); setMode(page.mode); }}>
              <b>{page.label}</b><span>{page.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// After arriving from the Preamble, the Tutorial pill shows beside More, then folds into it.
function TutorialHint() {
  const setMode = useAppStore((state) => state.setMode);
  const stow = useAppStore((state) => state.stowTutorialHint);
  const [stowing, setStowing] = useState(false);
  useEffect(() => {
    const start = window.setTimeout(() => setStowing(true), HINT_MS);
    const done = window.setTimeout(stow, HINT_MS + HINT_STOW_MS);
    return () => { window.clearTimeout(start); window.clearTimeout(done); };
  }, [stow]);
  return <button className={`tutorial-hint ${stowing ? 'stowing' : ''}`} onClick={() => setMode('tutorial')}>Tutorial</button>;
}

function Header() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const tutorialHint = useAppStore((state) => state.tutorialHint);
  const inMore = isMoreMode(mode);
  const [lastMain, setLastMain] = useState<AppMode>('explore');
  useEffect(() => { if (!inMore) setLastMain(mode); }, [mode, inMore]);

  const mainNav = (
    <nav className="main-nav" aria-label="Primary navigation">
      {MAIN_PAGES.map((page) => <button key={page.mode} className={mode === page.mode ? 'active' : ''} onClick={() => setMode(page.mode)}>{page.label}</button>)}
    </nav>
  );

  return (
    <header className={`app-header ${inMore ? 'in-more' : ''} ${mode === 'preamble' ? 'on-preamble' : ''}`}>
      <div className="header-left">
        <button className="brand" onClick={() => window.location.reload()} aria-label="Prescience home (reloads the site)"><span className="brand-mark" aria-hidden="true" /><span>Prescience</span></button>
        {inMore && mainNav}
      </div>
      {inMore ? (
        <nav className="more-nav" aria-label="More pages">
          {MORE_PAGES.map((page) => <button key={page.mode} className={mode === page.mode ? 'active' : ''} onClick={() => setMode(page.mode)}>{page.label}</button>)}
        </nav>
      ) : mainNav}
      <div className="header-right">
        {inMore ? (
          <button className="more-close" onClick={() => setMode(lastMain)} aria-label="Close More pages"><CloseIcon /></button>
        ) : (
          <>
            {tutorialHint && mode === 'explore' && <TutorialHint />}
            <MoreMenu />
          </>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const mode = useAppStore((state) => state.mode);
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<DemoManifest | null>(null);

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

  useEffect(() => { fetch('/data/manifest.json').then((response) => response.json() as Promise<DemoManifest>).then(setManifest).catch(() => undefined); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [mode]);

  const loading = <main className="loading-state"><div className="loading-orbit" /><p>Opening…</p></main>;
  let page: ReactNode;
  if (mode === 'preamble') page = <Preamble />;
  else if (mode === 'about' || mode === 'disclaimer' || mode === 'stories') {
    page = <Genie>{mode === 'about' ? <AboutPage manifest={manifest} /> : mode === 'disclaimer' ? <DisclaimerPage /> : <StoriesPage />}</Genie>;
  } else if (error) page = <main className="loading-state"><h1>Map layers could not load</h1><p>{error}</p></main>;
  else if (!data) page = loading;
  else {
    page = (
      <Suspense fallback={loading}>
        <ExploreMode cells={data.cells} series={data.series} sites={data.sites} />
        {mode === 'tutorial' && <Genie overlay><Tutorial /></Genie>}
      </Suspense>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      {page}
    </div>
  );
}
