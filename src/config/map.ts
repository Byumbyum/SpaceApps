export const BASEMAP = {
  id: 'openstreetmap',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  minZoom: 0,
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  issueUrl: 'https://www.openstreetmap.org/fixthemap',
} as const;

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
