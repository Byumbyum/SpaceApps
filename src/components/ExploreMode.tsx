import type { DemoCellProperties, NisarSite, TimePoint } from '../types';
import { useSiteGcov } from '../lib/nisarSites';
import { NOT_READY_REASON, PHENOMENA } from '../lib/phenomena';
import { useEffect, useState } from 'react';
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
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  // Every switch of phenomenon shows its disclaimer again until OK is pressed.
  useEffect(() => { setAcknowledged(null); }, [phenomenon]);
  const places = active && !active.available ? researchedPlaces(active.id) : [];

  return (
    <main id="main-content" className={`explore-page ${hasPanel ? 'has-panel' : ''} ${drawerOpen ? 'has-drawer' : ''}`}>
      <MapPanel cells={cells} sites={sites} site={site} gcov={gcov} gunw={gunw} />
      <AreaInsights gcov={gcov} gunw={gunw} climate={climate} risk={risk} sites={sites} />
      <InsightsDrawer series={series} gcov={gcov} risk={risk} />
      {active && !active.available && places.length > 0 && acknowledged !== active.id && (
        <div key={active.id} className="coming-soon" role="alertdialog" aria-modal="true" aria-labelledby="not-ready-title">
          <h2 id="not-ready-title">Not ready for the NASA Space Apps Challenge</h2>
          <p>{active.label} is not part of what we built for this challenge, but we have sorted some places into it: {places.join(', ')}.</p>
          {NOT_READY_REASON[active.id] && <p>{NOT_READY_REASON[active.id]}</p>}
          <p className="coming-soon-places">Their map glows are researched estimates, not computed from NISAR yet.</p>
          <div className="coming-soon-actions">
            <button className="primary-action" autoFocus onClick={() => setAcknowledged(active.id)}>OK</button>
          </div>
        </div>
      )}
      {active && !active.available && places.length === 0 && (
        <div key={active.id} className="coming-soon" role="status">
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
