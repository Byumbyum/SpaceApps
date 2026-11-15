import type { DemoCellProperties, NisarSite, TimePoint } from '../types';
import { useSiteGcov } from '../lib/nisarSites';
import { PHENOMENA } from '../lib/phenomena';
import { researchedPlaces } from '../data/hotspots';
import { useAppStore } from '../store';
import { AreaInsights } from './AreaInsights';
import { InsightsDrawer } from './InsightsDrawer';
import { MapPanel } from './MapPanel';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

export function ExploreMode({ cells, series, sites }: { cells: Collection<DemoCellProperties>; series: TimePoint[]; sites: NisarSite[] }) {
  // NISAR results for the site the selected area falls in, loaded on demand.
  const { site, gcov, gunw, climate, risk } = useSiteGcov(sites);
  const phenomenon = useAppStore((state) => state.phenomenon);
  const setPhenomenon = useAppStore((state) => state.setPhenomenon);
  const hasPanel = useAppStore((state) => state.selectedArea !== null);
  const drawerOpen = useAppStore((state) => state.analysisOpen && state.selectedArea !== null);
  const active = PHENOMENA.find((item) => item.id === phenomenon);

  return (
    <main id="main-content" className={`explore-page ${hasPanel ? 'has-panel' : ''} ${drawerOpen ? 'has-drawer' : ''}`}>
      <MapPanel cells={cells} sites={sites} site={site} gcov={gcov} gunw={gunw} />
      <AreaInsights gcov={gcov} gunw={gunw} climate={climate} risk={risk} sites={sites} />
      <InsightsDrawer series={series} gcov={gcov} risk={risk} />
      {active && !active.available && (
        <div className="coming-soon" role="alertdialog" aria-modal="true" aria-labelledby="not-ready-title">
          <h2 id="not-ready-title">Not ready for the NASA Space Apps Challenge</h2>
          <p>{active.label} is not part of what we built for this challenge. For now, Prescient focuses on local communities directly affected by permafrost thaw.</p>
          {researchedPlaces(active.id).length > 0 && <p className="coming-soon-places">We have already sorted these places into it, ready for the next step: {researchedPlaces(active.id).join(', ')}.</p>}
          <div className="coming-soon-actions">
            <button className="primary-action" autoFocus onClick={() => setPhenomenon('permafrost')}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
}
