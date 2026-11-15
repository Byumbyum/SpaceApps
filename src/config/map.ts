export type BasemapId = 'map' | 'satellite';

// "Map" is the OpenFreeMap Liberty vector style (no API key). "Satellite" is Esri
// World Imagery inserted under that style's roads and labels, giving a hybrid view.
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const BASEMAPS = {
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxZoom: 19,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  // Used only if the vector style cannot be fetched.
  fallbackMap: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxZoom: 19,
    attribution: 'Map © Esri',
  },
} as const;

export const INITIAL_VIEW = { center: [88, 32] as [number, number], zoom: 1.6 };

export const MVP_BOUNDS = {
  west: -152,
  south: 68.5,
  east: -147,
  north: 70.5,
} as const;

export const ALASKA_FOCUS_BOUNDS = {
  west: -176,
  south: 50,
  east: -124,
  north: 73,
} as const;
