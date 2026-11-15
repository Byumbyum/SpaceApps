import { insideRing, type LngLat } from './geo';

type Corners = [LngLat, LngLat, LngLat, LngLat]; // top-left, top-right, bottom-right, bottom-left

// Forward EPSG:3413 (polar stereographic north, lat_ts 70°N, lon0 −45°): the grid the
// NISAR overlays were rendered on by scripts/process-gcov.mjs.
const A = 6378137, E = 0.0818191908426, LAT_TS = (70 * Math.PI) / 180, LON0 = (-45 * Math.PI) / 180;
const MC = Math.cos(LAT_TS) / Math.sqrt(1 - E * E * Math.sin(LAT_TS) ** 2);
const TC = Math.tan(Math.PI / 4 - LAT_TS / 2) / ((1 - E * Math.sin(LAT_TS)) / (1 + E * Math.sin(LAT_TS))) ** (E / 2);

export function toPolarStereo([lon, lat]: LngLat): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const t = Math.tan(Math.PI / 4 - phi / 2) / ((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi))) ** (E / 2);
  const rho = (A * MC * t) / TC;
  const lambda = (lon * Math.PI) / 180 - LON0;
  return [rho * Math.sin(lambda), -rho * Math.cos(lambda)];
}

export function ringTouchesFootprint(ring: LngLat[], corners: Corners) {
  const footprint = [...corners, corners[0]];
  return ring.some((point) => insideRing(point, footprint)) || corners.some((corner) => insideRing(corner, ring));
}

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    }));
  }
  return images.get(url)!;
}

/** Return a PNG data URL of the overlay with everything outside `ring` made transparent. */
export async function clipOverlay(url: string, corners: Corners, ring: LngLat[]) {
  const image = await loadImage(url);
  const [x0, y1] = toPolarStereo(corners[0]);
  const [x1] = toPolarStereo(corners[1]);
  const [, y0] = toPolarStereo(corners[2]);
  const width = image.naturalWidth, height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return url;
  context.beginPath();
  ring.forEach((point, index) => {
    const [x, y] = toPolarStereo(point);
    const px = ((x - x0) / (x1 - x0)) * width;
    const py = ((y1 - y) / (y1 - y0)) * height;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  });
  context.closePath();
  context.clip();
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}
