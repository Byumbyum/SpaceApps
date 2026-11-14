import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { CircleLayerSpecification, FillLayerSpecification, GeoJSONSourceSpecification, LineLayerSpecification } from 'maplibre-gl';
import { ALASKA_FOCUS_BOUNDS, BASEMAP, MVP_BOUNDS } from '../config/map';
import { useAppStore } from '../store';
import type { DemoCellProperties, SegmentProperties } from '../types';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

interface MapPanelProps {
  cells: Collection<DemoCellProperties>;
  segments: Collection<SegmentProperties>;
}

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    [BASEMAP.id]: {
      type: 'raster',
      tiles: [...BASEMAP.tiles],
      tileSize: BASEMAP.tileSize,
      minzoom: BASEMAP.minZoom,
      maxzoom: BASEMAP.maxZoom,
      attribution: BASEMAP.attribution,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#17383d' } },
    {
      id: 'real-map',
      type: 'raster',
      source: BASEMAP.id,
      paint: {
        'raster-opacity': 0.82,
        'raster-saturation': -0.72,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.1,
        'raster-brightness-max': 0.72,
      },
    },
  ],
};

export function MapPanel({ cells, segments }: MapPanelProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const toolRef = useRef(useAppStore.getState().tool);
  const brushRef = useRef(useAppStore.getState().brushSize);
  const painting = useRef(false);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [mapError, setMapError] = useState<string | null>(null);
  const tool = useAppStore((state) => state.tool);
  const brushSize = useAppStore((state) => state.brushSize);
  const layer = useAppStore((state) => state.layer);
  const highQualityOnly = useAppStore((state) => state.highQualityOnly);
  const selectedCellIds = useAppStore((state) => state.selectedCellIds);
  const setFocusedCellId = useAppStore((state) => state.setFocusedCellId);

  useEffect(() => { toolRef.current = tool; brushRef.current = brushSize; }, [tool, brushSize]);

  useEffect(() => {
    const map = mapRef.current;
    if (mapStatus !== 'ready' || tool === 'navigate' || !map || map.getZoom() >= 5) return;
    map.fitBounds([[MVP_BOUNDS.west, MVP_BOUNDS.south], [MVP_BOUNDS.east, MVP_BOUNDS.north]], { padding: 72, duration: 700 });
  }, [tool, mapStatus]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    setMapStatus('loading');
    setMapError(null);
    readyRef.current = false;
    let map: maplibregl.Map;
    const dataBounds: [[number, number], [number, number]] = [
      [MVP_BOUNDS.west, MVP_BOUNDS.south],
      [MVP_BOUNDS.east, MVP_BOUNDS.north],
    ];
    const focusBounds: [[number, number], [number, number]] = [
      [ALASKA_FOCUS_BOUNDS.west, ALASKA_FOCUS_BOUNDS.south],
      [ALASKA_FOCUS_BOUNDS.east, ALASKA_FOCUS_BOUNDS.north],
    ];
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: structuredClone(mapStyle),
        bounds: focusBounds,
        fitBoundsOptions: { padding: 48 },
        minZoom: 2,
        maxZoom: 11,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'WebGL map initialization failed.');
      setMapStatus('fallback');
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 110 }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Demo grid · EPSG:3338 analysis' }));

    const paintAt = (point: maplibregl.Point) => {
      if (toolRef.current === 'navigate') return;
      const size = brushRef.current;
      const features = map.queryRenderedFeatures([[point.x - size, point.y - size], [point.x + size, point.y + size]], { layers: ['cells-fill'] });
      const ids = features.map((feature) => String(feature.properties?.id ?? '')).filter(Boolean);
      if (toolRef.current === 'select') useAppStore.getState().addSelectedCells(ids);
      if (toolRef.current === 'deselect') useAppStore.getState().removeSelectedCells(ids);
    };

    map.on('error', (event) => {
      if (readyRef.current) return;
      const message = event.error?.message ?? 'The WebGL map reported an initialization error.';
      setMapError(message);
    });

    map.on('load', () => {
      try {
        map.addSource('alaska-focus', {
          type: 'geojson',
          data: {
            type: 'Feature', properties: { name: 'Alaska focus area' }, geometry: { type: 'Polygon', coordinates: [[
              [ALASKA_FOCUS_BOUNDS.west, ALASKA_FOCUS_BOUNDS.north],
              [ALASKA_FOCUS_BOUNDS.east, ALASKA_FOCUS_BOUNDS.north],
              [ALASKA_FOCUS_BOUNDS.east, ALASKA_FOCUS_BOUNDS.south],
              [ALASKA_FOCUS_BOUNDS.west, ALASKA_FOCUS_BOUNDS.south],
              [ALASKA_FOCUS_BOUNDS.west, ALASKA_FOCUS_BOUNDS.north],
            ]] },
          },
        });
        map.addSource('processed-area', {
          type: 'geojson',
          data: {
            type: 'Feature', properties: { name: 'Northern Dalton processed area' }, geometry: { type: 'Polygon', coordinates: [[
              [MVP_BOUNDS.west, MVP_BOUNDS.north], [MVP_BOUNDS.east, MVP_BOUNDS.north],
              [MVP_BOUNDS.east, MVP_BOUNDS.south], [MVP_BOUNDS.west, MVP_BOUNDS.south],
              [MVP_BOUNDS.west, MVP_BOUNDS.north],
            ]] },
          },
        });
        map.addLayer({ id: 'alaska-focus-fill', type: 'fill', source: 'alaska-focus', paint: { 'fill-color': '#69bdc8', 'fill-opacity': 0.045 } } as FillLayerSpecification);
        map.addLayer({ id: 'alaska-focus-outline', type: 'line', source: 'alaska-focus', paint: { 'line-color': '#69bdc8', 'line-width': 2, 'line-dasharray': [3, 2] } } as LineLayerSpecification);
        map.addLayer({ id: 'processed-area-fill', type: 'fill', source: 'processed-area', paint: { 'fill-color': '#ff715b', 'fill-opacity': 0.14 } } as FillLayerSpecification);
        map.addLayer({ id: 'processed-area-outline', type: 'line', source: 'processed-area', paint: { 'line-color': '#ff715b', 'line-width': 3 } } as LineLayerSpecification);
        map.addSource('cells', { type: 'geojson', data: cells as GeoJSONSourceSpecification['data'], generateId: false });
        map.addSource('segments', { type: 'geojson', data: segments as GeoJSONSourceSpecification['data'] });
        map.addSource('cell-points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: cells.features.map(({ properties }) => ({
              type: 'Feature',
              properties,
              geometry: { type: 'Point', coordinates: [properties.longitude, properties.latitude] },
            })),
          } as GeoJSONSourceSpecification['data'],
        });
        map.addLayer({
          id: 'cells-fill', type: 'fill', source: 'cells',
          paint: {
            'fill-color': ['case', ['boolean', ['get', 'excluded'], false], '#657174', ['interpolate', ['linear'], ['get', 'motion_cm_yr'], -3.5, '#d95f4f', -1.4, '#e7b55c', -0.4, '#72b8c7', 0.2, '#2f7f94']],
            'fill-opacity': ['case', ['boolean', ['get', 'excluded'], false], 0.14, ['interpolate', ['linear'], ['get', 'q'], 0, 0.2, 1, 0.64]],
            'fill-outline-color': '#0e3136',
          },
        } as FillLayerSpecification);
        map.addLayer({
          id: 'cells-selected', type: 'fill', source: 'cells', filter: ['in', ['get', 'id'], ['literal', []]],
          paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12, 'fill-outline-color': '#ffffff' },
        } as FillLayerSpecification);
        map.addLayer({
          id: 'pipeline', type: 'line', source: 'segments', filter: ['==', ['get', 'asset'], 'pipeline'],
          paint: { 'line-color': '#f1c969', 'line-width': 3, 'line-dasharray': [1, 1.5] },
        } as LineLayerSpecification);
        map.addLayer({
          id: 'highway', type: 'line', source: 'segments', filter: ['==', ['get', 'asset'], 'highway'],
          paint: { 'line-color': ['match', ['get', 'priority'], 'higher', '#ff6b55', 'moderate', '#f1b85b', 'lower', '#79c8c2', '#728083'], 'line-width': 5 },
        } as LineLayerSpecification);
        map.addLayer({
          id: 'cell-points', type: 'circle', source: 'cell-points',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 9, 4],
            'circle-color': '#f8f3df',
            'circle-stroke-color': '#07171a',
            'circle-stroke-width': 1,
            'circle-opacity': ['case', ['boolean', ['get', 'excluded'], false], 0.15, 0.82],
          },
        } as CircleLayerSpecification);
        map.fitBounds(focusBounds, { padding: 54, duration: 0 });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 9, className: 'cell-coordinate-popup' });
        map.on('mouseenter', 'cell-points', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'cell-points', () => { popup.remove(); map.getCanvas().style.cursor = toolRef.current === 'navigate' ? 'grab' : 'crosshair'; });
        map.on('mousemove', 'cell-points', (event) => {
          const properties = event.features?.[0]?.properties as DemoCellProperties | undefined;
          if (!properties) return;
          const content = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = properties.area_name;
          const coordinates = document.createElement('span');
          coordinates.textContent = `${Number(properties.latitude).toFixed(4)}°N, ${Math.abs(Number(properties.longitude)).toFixed(4)}°W`;
          const metric = document.createElement('small');
          metric.textContent = properties.excluded ? String(properties.exclusion_reason) : `${Number(properties.motion_cm_yr).toFixed(2)} cm/yr · Q ${Number(properties.q).toFixed(2)} · E ${Number(properties.e).toFixed(2)}`;
          content.append(title, coordinates, metric);
          popup.setLngLat([Number(properties.longitude), Number(properties.latitude)]).setDOMContent(content).addTo(map);
        });
        let verificationAttempts = 0;
        const verifyVisibleGrid = () => {
          const loadedCells = map.querySourceFeatures('cells');
          if (loadedCells.length > 0) {
            readyRef.current = true;
            setMapError(null);
            setMapStatus('ready');
            return;
          }
          verificationAttempts += 1;
          if (verificationAttempts < 2) {
            map.fitBounds(dataBounds, { padding: 48, duration: 0 });
            map.once('idle', verifyVisibleGrid);
            return;
          }
          setMapError('MapLibre started, but the analysis cells did not render.');
          setMapStatus('fallback');
        };
        map.once('idle', verifyVisibleGrid);
      } catch (error) {
        setMapError(error instanceof Error ? error.message : 'The map layers could not be created.');
        setMapStatus('fallback');
      }
    });

    map.on('mousedown', (event) => {
      if (toolRef.current === 'navigate') return;
      painting.current = true;
      map.dragPan.disable();
      paintAt(event.point);
    });
    map.on('mousemove', (event) => {
      if (painting.current) paintAt(event.point);
      map.getCanvas().style.cursor = toolRef.current === 'navigate' ? 'grab' : 'crosshair';
    });
    const stopPainting = () => {
      painting.current = false;
      map.dragPan.enable();
    };
    map.on('mouseup', stopPainting);
    map.getCanvas().addEventListener('mouseleave', stopPainting);
    map.on('click', 'cells-fill', (event) => {
      const feature = event.features?.[0];
      if (feature?.properties?.id) setFocusedCellId(String(feature.properties.id));
    });
    const loadingTimeout = window.setTimeout(() => {
      if (!readyRef.current) {
        setMapError((current) => current ?? 'Map initialization timed out.');
        setMapStatus('fallback');
      }
    }, 5000);
    return () => {
      window.clearTimeout(loadingTimeout);
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [cells, segments, setFocusedCellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('cells-selected')) return;
    map.setFilter('cells-selected', ['in', ['get', 'id'], ['literal', selectedCellIds]]);
  }, [selectedCellIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('cells-fill')) return;
    const colorExpression: maplibregl.ExpressionSpecification = layer === 'quality'
      ? ['interpolate', ['linear'], ['get', 'q'], 0, '#522f42', 0.5, '#c08b58', 0.75, '#8ec9b1', 1, '#ddf4d5']
      : layer === 'interpretation'
        ? ['interpolate', ['linear'], ['get', 'e'], 0, '#3a3154', 0.5, '#8972a7', 0.75, '#d0ad70', 1, '#f5dd91']
        : ['case', ['boolean', ['get', 'excluded'], false], '#657174', ['interpolate', ['linear'], ['get', 'motion_cm_yr'], -3.5, '#d95f4f', -1.4, '#e7b55c', -0.4, '#72b8c7', 0.2, '#2f7f94']];
    map.setPaintProperty('cells-fill', 'fill-color', colorExpression);
    map.setFilter('cells-fill', highQualityOnly ? ['all', ['==', ['get', 'excluded'], false], ['>=', ['get', 'q'], 0.75]] : null);
  }, [layer, highQualityOnly]);

  const fitView = (view: 'focus' | 'data') => {
    const map = mapRef.current;
    if (!map || mapStatus !== 'ready') return;
    const bounds: [[number, number], [number, number]] = view === 'focus'
      ? [[ALASKA_FOCUS_BOUNDS.west, ALASKA_FOCUS_BOUNDS.south], [ALASKA_FOCUS_BOUNDS.east, ALASKA_FOCUS_BOUNDS.north]]
      : [[MVP_BOUNDS.west, MVP_BOUNDS.south], [MVP_BOUNDS.east, MVP_BOUNDS.north]];
    map.fitBounds(bounds, { padding: view === 'focus' ? 54 : 72, duration: 700 });
  };

  return (
    <div className="map-shell">
      <div ref={container} className={`map-canvas ${mapStatus !== 'ready' ? 'map-canvas-hidden' : ''}`} aria-label="Interactive ground-motion map" />
      {mapStatus !== 'ready' && <FallbackGrid cells={cells} error={mapStatus === 'loading' ? null : mapError} />}
      {mapStatus === 'loading' && <div className="map-loading map-loading-compact" role="status"><i /><strong>Checking WebGL map…</strong><span>The compatibility grid remains interactive while MapLibre verifies its rendered cells.</span></div>}
      {mapStatus === 'ready' && <div className={`map-brush ${tool === 'navigate' ? 'hidden' : ''}`} style={{ width: brushSize * 2, height: brushSize * 2 }} />}
      <div className="map-search-control"><span aria-hidden="true">⌖</span><div><strong>Alaska permafrost explorer</strong><small>50–73°N · 176–124°W</small></div><button onClick={() => fitView('focus')} title="Fit the Alaska focus area">Recenter</button></div>
      <div className="map-view-controls"><button onClick={() => fitView('focus')}>Alaska overview</button><button className="data-view" onClick={() => fitView('data')}><i />Northern Dalton data</button></div>
      <div className="map-status"><span>FOCUS AREA · (73,−176) (73,−124) (50,−124) (50,−176)</span><b>RED BOX = PROCESSED DATA · ELSEWHERE: NO PROCESSED DATA YET</b><b>SUMMER 2026 · PROVISIONAL</b></div>
      <div className="map-legend">
        <span className="legend-title">{layer === 'motion' ? 'Relative motion (cm/yr)' : layer === 'quality' ? 'Measurement Q' : 'Interpretation E'}</span>
        <div className={`legend-ramp ${layer}`} />
        <div className="legend-range"><span>{layer === 'motion' ? '−3.5 sinking' : 'low'}</span><span>{layer === 'motion' ? 'stable' : 'high'}</span></div>
        <small>Opacity shows Q · grey cells excluded</small>
      </div>
    </div>
  );
}

function FallbackGrid({ cells, error }: { cells: Collection<DemoCellProperties>; error: string | null }) {
  const tool = useAppStore((state) => state.tool);
  const layer = useAppStore((state) => state.layer);
  const highQualityOnly = useAppStore((state) => state.highQualityOnly);
  const selectedIds = useAppStore((state) => state.selectedCellIds);
  const selected = new Set(selectedIds);
  const tiles = referenceTiles(7);
  const interact = (cell: DemoCellProperties) => {
    if (tool === 'select') useAppStore.getState().addSelectedCells([cell.id]);
    if (tool === 'deselect') useAppStore.getState().removeSelectedCells([cell.id]);
    useAppStore.getState().setFocusedCellId(cell.id);
  };
  const color = (cell: DemoCellProperties) => {
    if (cell.excluded) return '#657174';
    if (layer === 'quality') return cell.q >= 0.75 ? '#b8dfc4' : cell.q >= 0.5 ? '#bd8e5d' : '#5b354a';
    if (layer === 'interpretation') return cell.e >= 0.75 ? '#efd184' : cell.e >= 0.5 ? '#9278ab' : '#43345c';
    return cell.motion_cm_yr < -2 ? '#d95f4f' : cell.motion_cm_yr < -1 ? '#e7b55c' : '#63aebf';
  };

  return (
    <div className="fallback-map" role="region" aria-label="Interactive grid-map fallback">
      <div className="fallback-real-tiles" style={{ gridTemplateColumns: `repeat(${tiles.columns}, 1fr)`, gridTemplateRows: `repeat(${tiles.rows}, 1fr)` }} aria-hidden="true">
        {tiles.items.map((tile) => <img key={`${tile.x}-${tile.y}`} src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`} alt="" />)}
      </div>
      <div className="fallback-context" aria-hidden="true"><span className="fallback-river river-one" /><span className="fallback-river river-two" /><b>BEAUFORT SEA</b><em>DALTON HWY</em></div>
      <div className="fallback-grid">
        {cells.features.map(({ properties }) => {
          const hidden = highQualityOnly && properties.q < 0.75;
          return <button key={properties.id} aria-label={`${properties.area_name}, ${properties.latitude.toFixed(4)} north, ${Math.abs(properties.longitude).toFixed(4)} west, motion ${properties.motion_cm_yr} centimetres per year`} title={properties.exclusion_reason ?? `${properties.latitude.toFixed(4)}°N, ${Math.abs(properties.longitude).toFixed(4)}°W · ${properties.motion_cm_yr} cm/yr · Q ${properties.q.toFixed(2)} · E ${properties.e.toFixed(2)}`} className={`${properties.excluded ? 'excluded' : ''} ${selected.has(properties.id) ? 'selected' : ''} ${hidden ? 'filtered' : ''}`} style={{ backgroundColor: color(properties), opacity: properties.excluded ? .16 : Math.max(.18, properties.q * .62) }} onClick={() => interact(properties)} />;
        })}
      </div>
      <div className="fallback-road" aria-hidden="true" />
      <div className="fallback-pipeline" aria-hidden="true" />
      <div className="fallback-message"><strong>{error ? 'Compatibility map active' : 'Analysis grid ready'}</strong><span>{error ? `${error} The same data, layers, selection and cell inspection remain available.` : 'MapLibre is being verified. You can use this grid immediately.'}</span></div>
      <a className="fallback-attribution" href={BASEMAP.attributionUrl} target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
  );
}

function referenceTiles(zoom: number) {
  const longitudeTile = (longitude: number) => Math.floor(((longitude + 180) / 360) * 2 ** zoom);
  const latitudeTile = (latitude: number) => {
    const radians = latitude * Math.PI / 180;
    return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * 2 ** zoom);
  };
  const minX = longitudeTile(MVP_BOUNDS.west);
  const maxX = longitudeTile(MVP_BOUNDS.east);
  const minY = latitudeTile(MVP_BOUNDS.north);
  const maxY = latitudeTile(MVP_BOUNDS.south);
  const items = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) items.push({ z: zoom, x, y });
  }
  return { items, columns: maxX - minX + 1, rows: maxY - minY + 1 };
}
