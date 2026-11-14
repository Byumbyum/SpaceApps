import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FillLayerSpecification, GeoJSONSource, GeoJSONSourceSpecification, LineLayerSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { BASEMAPS, INITIAL_VIEW, MVP_BOUNDS, VECTOR_STYLE_URL, type BasemapId } from '../config/map';
import { boxAreaKm2, boxRing, circleRing, formatCoordinate, nearestPlace, type LngLat, type Place, type SelectedArea } from '../lib/geo';
import { reverseGeocode } from '../lib/geocode';
import { useAppStore } from '../store';
import type { DemoCellProperties, SegmentProperties } from '../types';
import { CompassIcon, DrawIcon, LayersIcon, MinusIcon, PlusIcon } from './Icons';
import { MapSearch } from './MapSearch';

// MapLibre locates its worker relative to its own module, which breaks once Vite
// pre-bundles the dependency. Pointing at the shipped worker file fixes both dev and build.
maplibregl.setWorkerUrl(workerUrl);

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface MapPanelProps {
  cells: Collection<DemoCellProperties>;
  segments: Collection<SegmentProperties>;
}

const DEMO_LAYERS = ['demo-cells', 'demo-highway', 'demo-pipeline', 'demo-extent'];
const SELECT_RADIUS_PX = 70;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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
    else if (HIDDEN_IN_SATELLITE.has(layer.type) && !layer.id.startsWith('demo-') && !layer.id.startsWith('area-') && !layer.id.startsWith('draft-')) map.setLayoutProperty(layer.id, 'visibility', satellite ? 'none' : 'visible');
  }
}

function metersPerPixel(lat: number, zoom: number) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

function insideRing([x, y]: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const ringFeature = (ring: LngLat[]): GeoJSON.Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });

export function MapPanel({ cells, segments }: MapPanelProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bearing, setBearing] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const basemap = useAppStore((state) => state.basemap);
  const setBasemap = useAppStore((state) => state.setBasemap);
  const drawing = useAppStore((state) => state.drawing);
  const setDrawing = useAppStore((state) => state.setDrawing);
  const selectedArea = useAppStore((state) => state.selectedArea);
  const showDemoGrid = useAppStore((state) => state.showDemoGrid);
  const setShowDemoGrid = useAppStore((state) => state.setShowDemoGrid);

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
  }, [cells, segments]);

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
      map.addSource('demo-cells', { type: 'geojson', data: cells as GeoJSONSourceSpecification['data'] });
      map.addSource('demo-segments', { type: 'geojson', data: segments as GeoJSONSourceSpecification['data'] });
      map.addSource('demo-extent', { type: 'geojson', data: ringFeature(boxRing([MVP_BOUNDS.west, MVP_BOUNDS.south], [MVP_BOUNDS.east, MVP_BOUNDS.north])) });
      map.addSource('area', { type: 'geojson', data: EMPTY });
      map.addSource('draft', { type: 'geojson', data: EMPTY });
      const demoVisibility = useAppStore.getState().showDemoGrid ? 'visible' : 'none';
      map.addLayer({
        id: 'demo-cells', type: 'fill', source: 'demo-cells', layout: { visibility: demoVisibility },
        paint: {
          'fill-color': ['case', ['boolean', ['get', 'excluded'], false], '#9aa5ab', ['interpolate', ['linear'], ['get', 'motion_cm_yr'], -3.5, '#d93025', -1.4, '#f9ab00', -0.4, '#8ab4f8', 0.2, '#1a73e8']],
          'fill-opacity': ['case', ['boolean', ['get', 'excluded'], false], 0.2, ['interpolate', ['linear'], ['get', 'q'], 0, 0.25, 1, 0.6]],
        },
      } as FillLayerSpecification);
      map.addLayer({ id: 'demo-pipeline', type: 'line', source: 'demo-segments', filter: ['==', ['get', 'asset'], 'pipeline'], layout: { visibility: demoVisibility }, paint: { 'line-color': '#5f6368', 'line-width': 2, 'line-dasharray': [2, 2] } } as LineLayerSpecification);
      map.addLayer({ id: 'demo-highway', type: 'line', source: 'demo-segments', filter: ['==', ['get', 'asset'], 'highway'], layout: { visibility: demoVisibility }, paint: { 'line-color': ['match', ['get', 'priority'], 'higher', '#d93025', 'moderate', '#f9ab00', '#34a853'], 'line-width': 3 } } as LineLayerSpecification);
      map.addLayer({ id: 'demo-extent', type: 'line', source: 'demo-extent', layout: { visibility: demoVisibility }, paint: { 'line-color': '#5f6368', 'line-width': 1.5, 'line-dasharray': [3, 2] } } as LineLayerSpecification);
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
    DEMO_LAYERS.forEach((layer) => map.setLayoutProperty(layer, 'visibility', showDemoGrid ? 'visible' : 'none'));
  }, [showDemoGrid, status]);

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

  const showDemoArea = () => {
    setShowDemoGrid(true);
    setLayersOpen(false);
    mapRef.current?.fitBounds([[MVP_BOUNDS.west, MVP_BOUNDS.south], [MVP_BOUNDS.east, MVP_BOUNDS.north]], { padding: { top: 80, bottom: 80, left: window.innerWidth > 760 ? 440 : 40, right: 40 }, duration: 1400 });
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
        <button className={`chip ${drawing ? 'active' : ''}`} onClick={() => setDrawing(!drawing)} aria-pressed={drawing}><DrawIcon />Draw area</button>
      </div>

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
        <div className="layers-menu">
          <button className={`control-button ${layersOpen ? 'active' : ''}`} onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen} aria-label="Map layers"><LayersIcon /></button>
          {layersOpen && (
            <div className="layers-popover">
              <label><input type="checkbox" checked={showDemoGrid} onChange={(event) => setShowDemoGrid(event.target.checked)} /><span>Ground-motion demo grid<small>Northern Dalton corridor · synthetic</small></span></label>
              <button className="link-button" onClick={showDemoArea}>Go to demo area</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
