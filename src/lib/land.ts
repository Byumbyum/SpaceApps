import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land50 from 'world-atlas/land-50m.json';
import type { LngLat } from './geo';

// Natural Earth 1:50m land. Coarse at the coast, so an area counts as land when its
// centre or any point on its outline is on land.
const topology = land50 as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topology, topology.objects.land);

export const isOnLand = (point: LngLat) => geoContains(LAND, point);

export function touchesLand(center: LngLat, ring: LngLat[]) {
  if (isOnLand(center)) return true;
  // Sample the outline rather than test every vertex.
  const step = Math.max(1, Math.floor(ring.length / 24));
  for (let index = 0; index < ring.length; index += step) if (isOnLand(ring[index])) return true;
  return false;
}
