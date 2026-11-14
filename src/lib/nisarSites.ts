import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { GcovData, NisarSite } from '../types';
import type { LngLat } from './geo';
import { ringTouchesFootprint } from './overlayClip';

/** The processed NISAR site a selection falls in, if any. */
export function siteForArea(sites: NisarSite[], ring: LngLat[] | undefined) {
  return ring ? sites.find((site) => ringTouchesFootprint(ring, site.corners)) ?? null : null;
}

export const siteFile = (site: NisarSite, file: string) => `${site.base}/${file}`;

// Each site's gcov.json is fetched once, the first time an area inside it is selected.
const loaded = new Map<string, Promise<GcovData | null>>();
function loadSiteGcov(site: NisarSite) {
  if (!loaded.has(site.id)) {
    loaded.set(site.id, fetch(siteFile(site, 'gcov.json'))
      .then((response) => (response.ok ? (response.json() as Promise<GcovData>) : null))
      // The index is the source of truth for the label and caveat shown in the app.
      .then((gcov) => gcov && { ...gcov, site: { bbox: [], ...gcov.site, id: site.id, label: site.label, note: site.note } })
      .catch(() => null));
  }
  return loaded.get(site.id)!;
}

export function useSiteGcov(sites: NisarSite[]) {
  const ring = useAppStore((state) => state.selectedArea?.ring);
  const site = useMemo(() => siteForArea(sites, ring), [sites, ring]);
  const [result, setResult] = useState<{ id: string; gcov: GcovData | null } | null>(null);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    void loadSiteGcov(site).then((gcov) => { if (!cancelled) setResult({ id: site.id, gcov }); });
    return () => { cancelled = true; };
  }, [site]);

  return { site, gcov: site && result?.id === site.id ? result.gcov : null };
}
