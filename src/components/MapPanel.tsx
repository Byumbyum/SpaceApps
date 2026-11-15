import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FillLayerSpecification, GeoJSONSource, HeatmapLayerSpecification, ImageSource, LineLayerSpecification, RasterLayerSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { HOTSPOTS } from '../data/hotspots';
import { BASEMAPS, INITIAL_VIEW, VECTOR_STYLE_URL, type BasemapId } from '../config/map';
import { boxAreaKm2, boxRing, circleRing, formatCoordinate, insideRing, nearestPlace, type LngLat, type Place, type SelectedArea } from '../lib/geo';
import { reverseGeocode } from '../lib/geocode';
import { siteFile } from '../lib/nisarSites';
import { hotspotFeatures, hotspotPoints, nisarHotspotPoints } from '../lib/risk';
import { clipOverlay, ringTouchesFootprint } from '../lib/overlayClip';
import { useAppStore, type NisarLayer } from '../store';
import type { DemoCellProperties, GcovData, NisarSite } from '../types';
import { CompassIcon, DrawIcon, HotspotIcon, LayersIcon, MinusIcon, PlusIcon, SatelliteIcon } from './Icons';
import { MapSearch } from './MapSearch';

// MapLibre locates its worker relative to its own module, which breaks once Vite
// pre-bundles the dependency. Pointing at the shipped worker file fixes both dev and build.
maplibregl.setWorkerUrl(workerUrl);

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface MapPanelProps {
  cells: Collection<DemoCellProperties>;
  /** Every processed NISAR site (outlined on the map). */
  sites: NisarSite[];
  /** The site the selected area falls in, and its loaded results. */
  site: NisarSite | null;
  gcov: GcovData | null;
}

type RasterLayer = Exclude<NisarLayer, 'none' | 'hotspots'>;
const NISAR_LAYERS: Record<RasterLayer, string> = { radar: 'nisar-radar', change: 'nisar-change', landcover: 'nisar-landcover' };
const NISAR_FILES: Record<RasterLayer, string> = { radar: 'gcov-composite.png', change: 'gcov-change.png', landcover: 'landcover.png' };
const NISAR_PAINT: Record<RasterLayer, RasterLayerSpecification['paint']> = {
  radar: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 },
  change: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 },
  landcover: { 'raster-opacity': 0.8, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' },
};
const SITE_SELECT_RADIUS_KM = 8;
const SELECT_RADIUS_PX = 70;
const LEGEND_CLASSES = [10, 20, 30, 50, 60, 90, 100, 80];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const HOTSPOT_LAYERS = ['hotspot-heat', 'hotspot-fill', 'hotspot-line'];
// Transparent to deep red: the halo reads as a likelihood of harm, densest at the core.
const HEAT_COLOR: HeatmapLayerSpecification['paint'] = {
  'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(234,67,53,0)', 0.25, 'rgba(244,143,130,0.35)', 0.55, 'rgba(234,67,53,0.6)', 1, 'rgba(176,24,20,0.85)'],
};

// Vector layers hidden in satellite mode; roads, boundaries and labels stay on top of the imagery.
const HIDDEN_IN_SATELLITE = new Set(['fill', 'fill-extrusion', 'raster', 'hillshade']);

async function buildStyle(): Promise<maplibregl.StyleSpecification> {
  const satelliteSource: maplibregl.RasterSourceSpecification = { type: 'raster', tiles: [...BASEMAPS.satellite.tiles], tileSize: BASEMAPS.satellite.tileSize, maxzoom: BASEMAPS.satellite.maxZoom, attribution: BASEMAPS.satellite.attribution };
  const satelliteLayer: maplibregl.LayerSpecification = { id: 'basemap-satellite', type: 'raster', source: 'basemap-satellite', layout: { visibility: 'none' } };
  let style: maplibregl.StyleSpecification;
  try {
    const response = await fetch(VECTOR_STYLE_URL);
    if (!response.ok) throw new Error(String(response.status));
    style = (await response.json()) as maplibregl.StyleSpecification;
  } catch {
    style = {
      version: 8,
      sources: { 'basemap-fallback': { type: 'raster', tiles: [...BASEMAPS.fallbackMap.tiles], tileSize: BASEMAPS.fallbackMap.tileSize, maxzoom: BASEMAPS.fallbackMap.maxZoom, attribution: BASEMAPS.fallbackMap.attribution } },
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dfe7ec' } }, { id: 'basemap-fallback', type: 'raster', source: 'basemap-fallback' }],
    };
  }
  const layers = style.layers.filter((layer) => layer.id !== 'building-3d');
  const backgroundIndex = layers.findIndex((layer) => layer.type === 'background');
  layers.splice(backgroundIndex + 1, 0, satelliteLayer);
  return {
    ...style,
    projection: { type: 'globe' },
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
    sources: { ...style.sources, 'basemap-satellite': satelliteSource },
    layers,
  };
}

function applyBasemap(map: maplibregl.Map, basemap: BasemapId) {
  const satellite = basemap === 'satellite';
  for (const layer of map.getStyle().layers) {
    if (layer.id === 'basemap-satellite') map.setLayoutProperty(layer.id, 'visibility', satellite ? 'visible' : 'none');
    else if (HIDDEN_IN_SATELLITE.has(layer.type) && !/^(area|draft|nisar)-/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', satellite ? 'none' : 'visible');
  }
}

// "Before" and "after" are the passes either side of the NISAR thaw-season gap.
function changePeriods(gcov: GcovData) {
  const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const before = gcov.passes.filter((pass) => pass.date < gcov.gap[0]).map((pass) => pass.date);
  const after = gcov.passes.filter((pass) => pass.date > gcov.gap[1]).map((pass) => pass.date);
  if (!before.length || !after.length) return 'Early vs late summer';
  return `Before: ${day(before[0])} – ${day(before[before.length - 1])} · After: ${day(after[0])} – ${day(after[after.length - 1])}`;
}

function metersPerPixel(lat: number, zoom: number) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

const ringFeature = (ring: LngLat[]): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });

function monthRange(first: string, last: string) {
  const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${month(first)}–${month(last)} ${last.slice(0, 4)}`;
}

export function MapPanel({ cells, sites, site, gcov }: MapPanelProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bearing, setBearing] = useState(0);
  const layersOpen = useAppStore((state) => state.layersOpen);
  const setLayersOpen = useAppStore((state) => state.setLayersOpen);
  const showHotspots = useAppStore((state) => state.showHotspots);
  const setShowHotspots = useAppStore((state) => state.setShowHotspots);
  const focusRequest = useAppStore((state) => state.focusRequest);
  const [sitesOpen, setSitesOpen] = useState(false);
  const basemap = useAppStore((state) => state.basemap);
  const setBasemap = useAppStore((state) => state.setBasemap);
  const drawing = useAppStore((state) => state.drawing);
  const setDrawing = useAppStore((state) => state.setDrawing);
  const selectedArea = useAppStore((state) => state.selectedArea);
  const nisarLayer = useAppStore((state) => state.nisarLayer);
  // NISAR permafrost layers belong to the permafrost view only.
  const permafrostView = useAppStore((state) => state.phenomenon === 'permafrost');
  const shownNisarLayer: NisarLayer = permafrostView ? nisarLayer : 'none';
  const setNisarLayer = useAppStore((state) => state.setNisarLayer);
  // Overlays are drawn only inside the selected circle or rectangle.
  const [overlayShown, setOverlayShown] = useState(false);

  const commitArea = useCallback((shape: SelectedArea['shape'], center: LngLat, ring: LngLat[], areaKm2: number, place?: Place) => {
    const nearby = place ? { place } : nearestPlace(center, 40);
    const area: SelectedArea = {
      id: `${Date.now()}`,
      shape,
      center,
      ring,
      areaKm2,
      name: nearby ? nearby.place.name : 'Selected area',
      region: nearby ? nearby.place.region : formatCoordinate(center),
    };
    const store = useAppStore.getState();
    store.setSelectedArea(area);
    store.clearSelection();
    store.addSelectedCells(cells.features.filter(({ properties }) => insideRing([properties.longitude, properties.latitude], ring)).map(({ properties }) => properties.id));

    if (nearby) return;
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;
    reverseGeocode(center, mapRef.current?.getZoom() ?? 6, controller.signal)
      .then((found) => { if (found) useAppStore.getState().renameSelectedArea(area.id, found.name, found.region || formatCoordinate(center)); })
      .catch(() => undefined);
  }, [cells]);

  const commitRef = useRef(commitArea);
  useEffect(() => { commitRef.current = commitArea; }, [commitArea]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;
    let teardown = () => { cancelled = true; };
    void buildStyle().then((style) => {
      if (cancelled || !container.current) return;
      teardown = initMap(container.current, style);
    });
    return () => teardown();
  }, [cells, sites]);

  function initMap(element: HTMLDivElement, style: maplibregl.StyleSpecification) {
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: element,
        style,
        center: INITIAL_VIEW.center,
        zoom: INITIAL_VIEW.zoom,
        minZoom: 1,
        maxZoom: 19,
        attributionControl: false,
      });
    } catch {
      setStatus('error');
      return () => undefined;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 96 }), 'bottom-right');

    map.on('load', () => {
      map.addSource('area', { type: 'geojson', data: EMPTY });
      map.addSource('draft', { type: 'geojson', data: EMPTY });
      // Outline every processed site. Overlay images are added on first use, inside a selection.
      if (sites.length) {
        map.addSource('nisar-footprint', { type: 'geojson', data: { type: 'FeatureCollection', features: sites.map(({ corners }) => ringFeature([...corners, corners[0]])) } });
        map.addLayer({ id: 'nisar-footprint', type: 'line', source: 'nisar-footprint', paint: { 'line-color': '#1a73e8', 'line-width': 1.5, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } } as LineLayerSpecification);
      }
      // Risk hotspots: a heatmap glow at globe scale that hands over to ringed danger zones.
      map.addSource('hotspot-points', { type: 'geojson', data: hotspotPoints(HOTSPOTS) });
      map.addSource('hotspot-zones', { type: 'geojson', data: hotspotFeatures(HOTSPOTS) });
      map.addSource('nisar-hot', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'hotspot-heat', type: 'heatmap', source: 'hotspot-points', maxzoom: 7, paint: {
        ...HEAT_COLOR,
        'heatmap-weight': ['get', 'risk'],
        'heatmap-intensity': 1.2,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 1, 9, 3, 20, 6, 46],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 4.5, 0.9, 6.5, 0],
      } } as HeatmapLayerSpecification);
      map.addLayer({ id: 'hotspot-fill', type: 'fill', source: 'hotspot-zones', paint: {
        'fill-color': '#d93025',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5.5, ['*', ['get', 'risk'], ['match', ['get', 'ring'], 0, 0.3, 1, 0.17, 0.08]]],
      } } as FillLayerSpecification);
      map.addLayer({ id: 'hotspot-line', type: 'line', source: 'hotspot-zones', filter: ['==', ['get', 'ring'], 2], paint: {
        'line-color': '#d93025', 'line-width': 1.6, 'line-blur': 0.6,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5.5, 0.6],
      } } as LineLayerSpecification);
      map.addLayer({ id: 'nisar-hot', type: 'heatmap', source: 'nisar-hot', paint: {
        ...HEAT_COLOR,
        'heatmap-weight': ['get', 'weight'],
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 6, 12, 60],
        'heatmap-opacity': 0.8,
      } } as HeatmapLayerSpecification);
      map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.12 } } as FillLayerSpecification);
      map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#1a73e8', 'line-width': 2.5 } } as LineLayerSpecification);
      map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.08 } } as FillLayerSpecification);
      map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': '#1a73e8', 'line-width': 2, 'line-dasharray': [2, 1.5] } } as LineLayerSpecification);
      applyBasemap(map, useAppStore.getState().basemap);
      setStatus('ready');
    });

    map.on('rotate', () => setBearing(map.getBearing()));

    // Click selects a circular area scaled to the current zoom; Draw mode drags a box.
    let dragStart: LngLat | null = null;
    let justDrew = false;
    const draftSource = () => map.getSource('draft') as GeoJSONSource | undefined;

    const startDraw = (lngLat: maplibregl.LngLat) => {
      if (!useAppStore.getState().drawing) return false;
      dragStart = [lngLat.lng, lngLat.lat];
      map.dragPan.disable();
      return true;
    };
    const moveDraw = (lngLat: maplibregl.LngLat) => {
      if (!dragStart) return;
      draftSource()?.setData(ringFeature(boxRing(dragStart, [lngLat.lng, lngLat.lat])));
    };
    const endDraw = (lngLat: maplibregl.LngLat) => {
      if (!dragStart) return;
      const start = dragStart;
      const ring = boxRing(start, [lngLat.lng, lngLat.lat]);
      dragStart = null;
      map.dragPan.enable();
      draftSource()?.setData(EMPTY);
      useAppStore.getState().setDrawing(false);
      justDrew = true;
      window.setTimeout(() => { justDrew = false; }, 50);
      const areaKm2 = boxAreaKm2(ring);
      if (areaKm2 < 0.05) return;
      commitRef.current('box', [(start[0] + lngLat.lng) / 2, (start[1] + lngLat.lat) / 2], ring, areaKm2);
    };

    map.on('mousedown', (event) => { if (startDraw(event.lngLat)) event.preventDefault(); });
    map.on('mousemove', (event) => moveDraw(event.lngLat));
    map.on('mouseup', (event) => endDraw(event.lngLat));
    map.on('touchstart', (event) => { if (event.points.length === 1 && startDraw(event.lngLat)) event.preventDefault(); });
    map.on('touchmove', (event) => moveDraw(event.lngLat));
    map.on('touchend', (event) => endDraw(event.lngLat));

    map.on('click', (event) => {
      if (justDrew || useAppStore.getState().drawing) return;
      const center: LngLat = [event.lngLat.lng, event.lngLat.lat];
      const radiusKm = Math.min(500, Math.max(0.5, (SELECT_RADIUS_PX * metersPerPixel(center[1], map.getZoom())) / 1000));
      commitRef.current('circle', center, circleRing(center, radiusKm), Math.PI * radiusKm ** 2);
    });

    return () => {
      geocodeAbort.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    applyBasemap(map, basemap);
  }, [basemap, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    let cancelled = false;
    const hideAll = () => (Object.values(NISAR_LAYERS)).forEach((layer) => { if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', 'none'); });
    if (map.getLayer('nisar-footprint')) map.setLayoutProperty('nisar-footprint', 'visibility', permafrostView ? 'visible' : 'none');
    const active = shownNisarLayer === 'none' || shownNisarLayer === 'hotspots' ? null : shownNisarLayer;
    if (!active || !selectedArea || !site || !gcov || (active === 'landcover' && !gcov.landcover) || !ringTouchesFootprint(selectedArea.ring, site.corners)) {
      hideAll();
      setOverlayShown(false);
      return;
    }
    clipOverlay(siteFile(site, NISAR_FILES[active]), site.corners, selectedArea.ring).then((url) => {
      if (cancelled || !map.getStyle()) return;
      const id = NISAR_LAYERS[active];
      const source = map.getSource(id) as ImageSource | undefined;
      if (source) source.updateImage({ url, coordinates: site.corners });
      else {
        map.addSource(id, { type: 'image', url, coordinates: site.corners });
        map.addLayer({ id, type: 'raster', source: id, paint: NISAR_PAINT[active] } as RasterLayerSpecification, 'area-fill');
      }
      hideAll();
      map.setLayoutProperty(id, 'visibility', 'visible');
      setOverlayShown(true);
    }).catch(() => setOverlayShown(false));
    return () => { cancelled = true; };
  }, [shownNisarLayer, permafrostView, selectedArea, status, site, gcov]);

  // Global hotspots follow the toggle; inside a selection the Hotspots layer always shows them,
  // plus NISAR-measured danger cells where the area falls in a processed site.
  const areaHotspots = shownNisarLayer === 'hotspots' && selectedArea !== null;
  const hotspotsVisible = permafrostView && (showHotspots || areaHotspots);
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    HOTSPOT_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', hotspotsVisible ? 'visible' : 'none'));
    const measured = areaHotspots && site && gcov && selectedArea ? nisarHotspotPoints(gcov, selectedArea.ring) : EMPTY;
    (map.getSource('nisar-hot') as GeoJSONSource).setData(measured);
  }, [hotspotsVisible, areaHotspots, selectedArea, site, gcov, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map || !focusRequest) return;
    const { center, radiusKm, place } = focusRequest;
    const ring = circleRing(center, radiusKm);
    commitRef.current('circle', center, ring, Math.PI * radiusKm ** 2, place);
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 90, bottom: 90, left: window.innerWidth > 760 ? 440 : 30, right: 60 }, duration: 1600 });
  }, [focusRequest, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    (map.getSource('area') as GeoJSONSource).setData(selectedArea ? ringFeature(selectedArea.ring) : EMPTY);
  }, [selectedArea, status]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = drawing ? 'crosshair' : '';
  }, [drawing, status]);

  const flyToPlace = (place: Place) => {
    const map = mapRef.current;
    if (!map) return;
    const radiusKm = 20;
    commitRef.current('circle', place.center, circleRing(place.center, radiusKm), Math.PI * radiusKm ** 2, place);
    map.flyTo({ center: place.center, zoom: 8.3, offset: window.innerWidth > 760 ? [200, 0] : [0, -120], duration: 1600, essential: true });
  };

  // Fly to a site and select its centre, so its NISAR results appear straight away.
  const openSite = (target: NisarSite) => {
    setSitesOpen(false);
    const lngs = target.corners.map(([lng]) => lng);
    const lats = target.corners.map(([, lat]) => lat);
    const center: LngLat = [lngs.reduce((a, b) => a + b) / lngs.length, lats.reduce((a, b) => a + b) / lats.length];
    commitRef.current('circle', center, circleRing(center, SITE_SELECT_RADIUS_KM), Math.PI * SITE_SELECT_RADIUS_KM ** 2);
    mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 90, bottom: 90, left: window.innerWidth > 760 ? 440 : 30, right: 60 }, duration: 1600 });
  };

  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" aria-label="Interactive map" />
      {status === 'error' && (
        <div className="map-error" role="alert">
          <strong>The interactive map couldn’t start</strong>
          <span>WebGL is turned off or unavailable in this browser. Try another browser or enable hardware acceleration.</span>
        </div>
      )}

      <div className="map-top-left">
        <MapSearch onPick={flyToPlace} />
        <button className={`chip ${drawing ? 'active' : ''}`} data-tour="draw" onClick={() => setDrawing(!drawing)} aria-pressed={drawing}><DrawIcon />Draw area</button>
        {permafrostView && <button className={`chip hotspot-chip ${showHotspots ? 'active' : ''}`} data-tour="hotspots" onClick={() => setShowHotspots(!showHotspots)} aria-pressed={showHotspots}><HotspotIcon />Risk hotspots<small>{showHotspots ? 'On' : 'Off'}</small></button>}
        {sites.length > 0 && permafrostView && (
          <div className="sites-menu" data-tour="sites">
            <button className={`chip ${sitesOpen ? 'active' : ''}`} onClick={() => setSitesOpen(!sitesOpen)} aria-expanded={sitesOpen}><SatelliteIcon />NISAR sites · {sites.length}</button>
            {sitesOpen && (
              <div className="sites-popover">
                {sites.map((item) => (
                  <button key={item.id} className={site?.id === item.id ? 'active' : ''} onClick={() => openSite(item)}>
                    <b>{item.label}</b>
                    <span>{item.passCount} radar passes · {monthRange(item.firstDate, item.lastDate)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {gcov && overlayShown && shownNisarLayer !== 'none' && status === 'ready' && (
        <div className="map-legend">
          {shownNisarLayer === 'landcover' && gcov.landcover ? (
            <>
              <b>Land cover</b>
              <span>ESA WorldCover 2021 · 10 m</span>
              <ul className="legend-classes">
                {Object.entries(gcov.landcover.classes).filter(([code]) => LEGEND_CLASSES.includes(Number(code))).map(([code, entry]) => <li key={code}><i style={{ background: entry.color }} />{entry.label}</li>)}
              </ul>
              <small className="legend-note">Permanent water is excluded from permafrost statistics. Built-up areas are kept to show infrastructure at risk.</small>
            </>
          ) : shownNisarLayer === 'change' ? (
            <>
              <b>Radar brightness change</b>
              <span>{changePeriods(gcov)}</span>
              <i className="legend-ramp" />
              <div className="legend-ends"><span>Darker</span><span>No change</span><span>Brighter</span></div>
              <small className="legend-note">Darker: possible new standing water or drying. Brighter: wetter soil or more vegetation. Permanent water hidden. NISAR, provisional.</small>
            </>
          ) : (
            <>
              <b>NISAR radar image</b>
              <span>{gcov.composite_date} · HH / HV false colour (provisional)</span>
            </>
          )}
        </div>
      )}

      {hotspotsVisible && !(gcov && overlayShown && shownNisarLayer !== 'none') && status === 'ready' && (
        <div className="map-legend">
          <b>Risk hotspots</b>
          <span>Risk = f(Hazard, Exposure, Vulnerability, Capacity)</span>
          <i className="legend-ramp hotspot-ramp" />
          <div className="legend-ends"><span>Lower</span><span>Likelihood of harm</span><span>Higher</span></div>
          <small className="legend-note">UNDRR and IPCC risk framework. Factor values are indicative estimates until NISAR ground-motion trends are processed.{areaHotspots && site ? ' Small glows inside your area are NISAR-measured radar change near buildings.' : ''}</small>
        </div>
      )}

      {status === 'ready' && !selectedArea && !drawing && <div className="map-hint">Click anywhere on the map to see permafrost insights</div>}
      {drawing && <div className="map-hint">Click and drag to draw an area <button onClick={() => setDrawing(false)}>Cancel</button></div>}

      <div className="map-controls">
        {Math.abs(bearing) > 0.5 && <button className="control-button" onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })} aria-label="Reset north"><CompassIcon style={{ transform: `rotate(${-bearing}deg)` }} /></button>}
        <div className="control-stack">
          <button className="control-button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><PlusIcon /></button>
          <button className="control-button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><MinusIcon /></button>
        </div>
      </div>

      <div className="map-bottom-left">
        <button className="basemap-toggle" onClick={() => setBasemap(basemap === 'map' ? 'satellite' : 'map')} aria-label={`Switch to ${basemap === 'map' ? 'satellite' : 'map'} view`}>
          <span className={`basemap-thumb ${basemap === 'map' ? 'thumb-satellite' : 'thumb-map'}`} />
          <span className="basemap-label">{basemap === 'map' ? 'Satellite' : 'Map'}</span>
        </button>
        <div className="layers-menu" data-tour="layers">
          <button className={`control-button ${layersOpen ? 'active' : ''}`} onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen} aria-label="Map layers"><LayersIcon /></button>
          {layersOpen && (
            <div className="layers-popover">
              {permafrostView && (
                <fieldset className="layer-radios">
                  <legend>Area layer{site ? ` · ${site.label}` : ''}<small>Shown inside the area you select. NISAR radar layers need an outlined NISAR site.</small></legend>
                  {([['hotspots', 'Risk hotspots & danger zones'], ...(sites.length ? [['change', 'NISAR summer brightness change'], ['radar', 'NISAR radar image']] : []), ...(sites.length && (!gcov || gcov.landcover) ? [['landcover', 'Land cover (ESA WorldCover)']] : []), ['none', 'Off']] as Array<[NisarLayer, string]>).map(([id, label]) => (
                    <label key={id}><input type="radio" name="nisar-layer" checked={nisarLayer === id} onChange={() => setNisarLayer(id)} /><span>{label}</span></label>
                  ))}
                </fieldset>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
