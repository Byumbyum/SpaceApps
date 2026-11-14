import { lazy, Suspense, useEffect, useState } from 'react';
import { DemoBanner } from './components/DemoBanner';
import { StoryMode } from './components/StoryMode';
import { useAppStore } from './store';
import type { DemoCellProperties, DemoManifest, NisarSite, SegmentProperties, TimePoint } from './types';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface AppData {
  manifest: DemoManifest;
  cells: Collection<DemoCellProperties>;
  segments: Collection<SegmentProperties>;
  series: TimePoint[];
  sites: NisarSite[];
}

const ExploreMode = lazy(() => import('./components/ExploreMode').then((module) => ({ default: module.ExploreMode })));
const AboutData = lazy(() => import('./components/AboutData').then((module) => ({ default: module.AboutData })));

export default function App() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/manifest.json').then((response) => response.json() as Promise<DemoManifest>),
      fetch('/data/cells.geojson').then((response) => response.json() as Promise<Collection<DemoCellProperties>>),
      fetch('/data/segments.geojson').then((response) => response.json() as Promise<Collection<SegmentProperties>>),
      fetch('/data/time-series.json').then((response) => response.json() as Promise<TimePoint[]>),
      // Processed NISAR sites; optional so the app still runs before `npm run data:gcov`.
      fetch('/data/nisar/sites.json').then((response) => (response.ok ? (response.json() as Promise<NisarSite[]>) : [])).catch(() => []),
    ])
      .then(([manifest, cells, segments, series, sites]) => setData({ manifest, cells, segments, series, sites }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load demo layers'));
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setMode('explore')} aria-label="Ground Truth North home"><span className="brand-mark" aria-hidden="true" /><span>Ground Truth North</span></button>
        <nav aria-label="Primary navigation">
          <button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Map</button>
          <button className={mode === 'story' ? 'active' : ''} onClick={() => setMode('story')}>Story</button>
          <button className={mode === 'about' ? 'active' : ''} onClick={() => setMode('about')}>About</button>
        </nav>
        <DemoBanner />
      </header>
      {error ? <main className="loading-state"><h1>Demo layers could not load</h1><p>{error}</p><p>Run <code>npm run demo:generate</code>, then restart the app.</p></main> : !data ? <main className="loading-state"><div className="loading-orbit" /><p>Loading the evidence ledger…</p></main> : mode === 'story' ? <StoryMode /> : <Suspense fallback={<main className="loading-state"><div className="loading-orbit" /><p>Opening the analysis workspace…</p></main>}>{mode === 'explore' ? <ExploreMode cells={data.cells} series={data.series} sites={data.sites} /> : <AboutData manifest={data.manifest} />}</Suspense>}
    </div>
  );
}
