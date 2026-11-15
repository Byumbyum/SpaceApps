import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { ClimateData, GcovData, GunwData, NisarSite, RiskData } from '../types';
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

const loadedGunw = new Map<string, Promise<GunwData | null>>();
function loadSiteGunw(site: NisarSite) {
  if (!site.gunw) return Promise.resolve(null);
  if (!loadedGunw.has(site.id)) {
    loadedGunw.set(site.id, fetch(siteFile(site, 'gunw.json'))
      .then((response) => (response.ok ? (response.json() as Promise<GunwData>) : null))
      .catch(() => null));
  }
  return loadedGunw.get(site.id)!;
}

const loadedClimate = new Map<string, Promise<ClimateData | null>>();
function loadSiteClimate(site: NisarSite) {
  if (!site.climate) return Promise.resolve(null);
  if (!loadedClimate.has(site.id)) {
    loadedClimate.set(site.id, fetch(siteFile(site, 'climate.json'))
      .then((response) => (response.ok ? (response.json() as Promise<ClimateData>) : null))
      .catch(() => null));
  }
  return loadedClimate.get(site.id)!;
}

const loadedRisk = new Map<string, Promise<RiskData | null>>();
function loadSiteRisk(site: NisarSite) {
  if (!site.risk) return Promise.resolve(null);
  if (!loadedRisk.has(site.id)) {
    loadedRisk.set(site.id, fetch(siteFile(site, 'risk.json'))
      .then((response) => (response.ok ? (response.json() as Promise<RiskData>) : null))
      .catch(() => null));
  }
  return loadedRisk.get(site.id)!;
}

export function useSiteGcov(sites: NisarSite[]) {
  const ring = useAppStore((state) => state.selectedArea?.ring);
  const site = useMemo(() => siteForArea(sites, ring), [sites, ring]);
  const [result, setResult] = useState<{ id: string; gcov: GcovData | null; gunw: GunwData | null; climate: ClimateData | null; risk: RiskData | null } | null>(null);

  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    void Promise.all([loadSiteGcov(site), loadSiteGunw(site), loadSiteClimate(site), loadSiteRisk(site)]).then(([gcov, gunw, climate, risk]) => { if (!cancelled) setResult({ id: site.id, gcov, gunw, climate, risk }); });
    return () => { cancelled = true; };
  }, [site]);

  const current = site && result?.id === site.id ? result : null;
  return { site, gcov: current?.gcov ?? null, gunw: current?.gunw ?? null, climate: current?.climate ?? null, risk: current?.risk ?? null };
}
