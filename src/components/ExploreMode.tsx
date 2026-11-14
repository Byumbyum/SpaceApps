import type { DemoCellProperties, SegmentProperties, TimePoint } from '../types';
import { PHENOMENA } from '../lib/phenomena';
import { useAppStore } from '../store';
import { AreaInsights } from './AreaInsights';
import { InsightsDrawer } from './InsightsDrawer';
import { MapPanel } from './MapPanel';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

export function ExploreMode({ cells, segments, series }: { cells: Collection<DemoCellProperties>; segments: Collection<SegmentProperties>; series: TimePoint[] }) {
  const phenomenon = useAppStore((state) => state.phenomenon);
  const setPhenomenon = useAppStore((state) => state.setPhenomenon);
  const hasPanel = useAppStore((state) => state.selectedArea !== null);
  const drawerOpen = useAppStore((state) => state.analysisOpen && state.selectedArea !== null);
  const active = PHENOMENA.find((item) => item.id === phenomenon);

  return (
    <main id="main-content" className={`explore-page ${hasPanel ? 'has-panel' : ''} ${drawerOpen ? 'has-drawer' : ''}`}>
      <MapPanel cells={cells} segments={segments} />
      <AreaInsights />
      <InsightsDrawer series={series} />
      {active && !active.available && (
        <div className="coming-soon" role="status">
          <h2>Coming soon…</h2>
          <p>{active.label} insights are on the way. View other parameters!</p>
          <div className="coming-soon-actions">
            <button className="primary-action" onClick={() => setPhenomenon('permafrost')}>Back to permafrost thaw</button>
          </div>
        </div>
      )}
    </main>
  );
}
