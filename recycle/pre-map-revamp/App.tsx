import { lazy, Suspense, useEffect, useState } from 'react';
import { DemoBanner } from './components/DemoBanner';
import { StoryMode } from './components/StoryMode';
import { useAppStore } from './store';
import type { DemoCellProperties, DemoManifest, SegmentProperties, TimePoint } from './types';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface AppData {
  manifest: DemoManifest;
  cells: Collection<DemoCellProperties>;
  segments: Collection<SegmentProperties>;
  series: TimePoint[];
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
    ])
      .then(([manifest, cells, segments, series]) => setData({ manifest, cells, segments, series }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load demo layers'));
  }, []);

  return (
    <div className="app-shell">
      <DemoBanner />
      <header className="app-header">
        <button className="brand" onClick={() => setMode('story')} aria-label="Ground Truth North home"><span className="brand-mark"><i /><i /></span><span><b>GROUND TRUTH</b><em>NORTH</em></span></button>
        <nav aria-label="Primary navigation">
          <button className={mode === 'story' ? 'active' : ''} onClick={() => setMode('story')}>Story</button>
          <button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Explore</button>
          <button className={mode === 'about' ? 'active' : ''} onClick={() => setMode('about')}>About the data</button>
        </nav>
        <div className="header-status"><span className="status-dot" />SUMMER 2026 <b>PROVISIONAL</b></div>
      </header>
      {error ? <main className="loading-state"><h1>Demo layers could not load</h1><p>{error}</p><p>Run <code>npm run demo:generate</code>, then restart the app.</p></main> : !data ? <main className="loading-state"><div className="loading-orbit" /><p>Loading the evidence ledger…</p></main> : mode === 'story' ? <StoryMode /> : <Suspense fallback={<main className="loading-state"><div className="loading-orbit" /><p>Opening the analysis workspace…</p></main>}>{mode === 'explore' ? <ExploreMode cells={data.cells} segments={data.segments} series={data.series} /> : <AboutData manifest={data.manifest} />}</Suspense>}
    </div>
  );
}
