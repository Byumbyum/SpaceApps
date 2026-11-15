import { useMemo } from 'react';
import { geoCircle, geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';

// Major permafrost and high-mountain regions, drawn as soft circles (centre, radius in degrees).
// Indicative outlines for storytelling, not a permafrost extent map.
const ZONES: Array<{ name: string; circles: Array<[number, number, number]>; label?: [number, number] }> = [
  { name: 'Alaska', circles: [[-152, 66, 6.5]] },
  { name: 'Canada', circles: [[-118, 64, 9], [-92, 66, 9], [-75, 62, 6]], label: [-100, 66] },
  { name: 'Greenland', circles: [[-42, 74, 9]] },
  { name: 'Scandinavia', circles: [[20, 68, 4]] },
  { name: 'European Alps', circles: [[10, 46.4, 2.6]] },
  { name: 'Russian Arctic', circles: [[62, 69, 7], [80, 70, 7]], label: [70, 70] },
  { name: 'Siberia', circles: [[105, 64, 11], [130, 64, 11], [155, 66, 7]], label: [125, 63] },
  { name: 'Mongolia', circles: [[100, 48, 4.5]] },
  { name: 'Tibetan Plateau', circles: [[82, 34, 5.5], [92, 33, 6]], label: [88, 33] },
  { name: 'The Andes', circles: [[-70, -16, 4], [-69, -28, 4], [-71, -40, 3.5], [-73, -49, 3.5]], label: [-69, -28] },
  { name: 'Southern Alps (NZ)', circles: [[170.5, -43.6, 2.2]] },
  { name: 'Antarctica', circles: [[0, -90, 22]], label: [0, -78] },
];

const WIDTH = 960;
const HEIGHT = 470;

export function PermafrostWorldMap() {
  const { landPath, graticule, outline, zones } = useMemo(() => {
    const topology = land110 as unknown as Topology<{ land: GeometryCollection }>;
    const land = feature(topology, topology.objects.land);
    const projection = geoEqualEarth().fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], { type: 'Sphere' });
    const path = geoPath(projection);
    return {
      landPath: path(land) ?? '',
      graticule: path(geoGraticule10()) ?? '',
      outline: path({ type: 'Sphere' }) ?? '',
      zones: ZONES.map((zone) => ({
        name: zone.name,
        d: zone.circles.map(([lng, lat, radius]) => path(geoCircle().center([lng, lat]).radius(radius)()) ?? '').join(' '),
        at: projection(zone.label ?? [zone.circles[0][0], zone.circles[0][1]]) ?? [0, 0],
      })),
    };
  }, []);

  return (
    <figure className="world-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Equal Earth map of major permafrost regions: ${ZONES.map((zone) => zone.name).join(', ')}`}>
        <defs>
          <filter id="zone-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <path d={outline} className="wm-sphere" />
        <path d={graticule} className="wm-graticule" />
        <path d={landPath} className="wm-land" />
        <g filter="url(#zone-blur)">{zones.map((zone) => <path key={zone.name} d={zone.d} className="wm-zone" />)}</g>
        {zones.map((zone) => <path key={`${zone.name}-edge`} d={zone.d} className="wm-zone-edge" />)}
        {zones.map((zone) => (
          <text key={`${zone.name}-label`} x={zone.at[0]} y={zone.at[1]} className="wm-label">{zone.name}</text>
        ))}
      </svg>
      <figcaption>Major permafrost regions, all within NISAR’s global coverage. Outlines are indicative.</figcaption>
    </figure>
  );
}
