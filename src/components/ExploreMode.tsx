import type { DemoCellProperties, NisarSite, TimePoint } from '../types';
import { useSiteGcov } from '../lib/nisarSites';
import { PHENOMENA } from '../lib/phenomena';
import { useAppStore } from '../store';
import { AreaInsights } from './AreaInsights';
import { InsightsDrawer } from './InsightsDrawer';
import { MapPanel } from './MapPanel';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

export function ExploreMode({ cells, series, sites }: { cells: Collection<DemoCellProperties>; series: TimePoint[]; sites: NisarSite[] }) {
  // NISAR results for the site the selected area falls in, loaded on demand.
  const { site, gcov, gunw } = useSiteGcov(sites);
  const phenomenon = useAppStore((state) => state.phenomenon);
  const setPhenomenon = useAppStore((state) => state.setPhenomenon);
  const hasPanel = useAppStore((state) => state.selectedArea !== null);
  const drawerOpen = useAppStore((state) => state.analysisOpen && state.selectedArea !== null);
  const active = PHENOMENA.find((item) => item.id === phenomenon);

  return (
    <main id="main-content" className={`explore-page ${hasPanel ? 'has-panel' : ''} ${drawerOpen ? 'has-drawer' : ''}`}>
      <MapPanel cells={cells} sites={sites} site={site} gcov={gcov} gunw={gunw} />
      <AreaInsights gcov={gcov} gunw={gunw} />
      <InsightsDrawer series={series} gcov={gcov} />
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
