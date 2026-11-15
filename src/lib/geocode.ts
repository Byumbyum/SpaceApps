import type { LngLat, Place } from './geo';

// OpenStreetMap Nominatim: called only on an explicit search (Enter) and once per
// area selection, which stays well inside its 1 request/second usage policy.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

function describe(result: NominatimResult): { name: string; region: string } {
  const address = result.address ?? {};
  const name = result.name || address.city || address.town || address.village || address.hamlet || address.county || address.state || result.display_name.split(',')[0];
  const region = [address.state ?? address.region ?? address.county, address.country].filter((part) => part && part !== name).join(', ');
  return { name, region };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&accept-language=en&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const results = (await response.json()) as NominatimResult[];
  const seen = new Set<string>();
  return results
    .map((result) => ({ ...describe(result), center: [Number(result.lon), Number(result.lat)] as LngLat }))
    .filter((place) => {
      const key = `${place.name}|${place.region}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Photon (komoot, OpenStreetMap data) is built for search-as-you-type and tolerates typos
// ("vancuver" → Vancouver). Nominatim's policy forbids autocomplete, so it stays on Enter.
// Restricted to settlements, regions and landforms so shops and stations don't crowd results.
const PHOTON = 'https://photon.komoot.io/api/';
const suggestionCache = new Map<string, Place[]>();
// Tiny settlements sharing a famous name (Singapore, Michigan: a ghost town) go below bigger places.
const TINY = new Set(['hamlet', 'isolated_dwelling', 'farm', 'locality', 'neighbourhood', 'quarter', 'suburb', 'allotments', 'plot']);

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; state?: string; country?: string; county?: string; osm_value?: string };
}

export async function suggestPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const key = query.trim().toLowerCase();
  const cached = suggestionCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ q: key, limit: '6', lang: 'en' });
  ['place', 'natural', 'boundary'].forEach((tag) => params.append('osm_tag', tag));
  const response = await fetch(`${PHOTON}?${params}`, { signal });
  if (!response.ok) return [];
  const { features } = (await response.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const places = features
    .filter((feature) => feature.properties.name)
    .map(({ geometry, properties }) => {
      const name = properties.name!;
      const kind = (properties.osm_value ?? '').replace(/_/g, ' ');
      const tiny = TINY.has(properties.osm_value ?? '');
      const where = [properties.state ?? properties.county, properties.country].filter((part) => part && part !== name).join(', ');
      // Name the kind of place when it would otherwise be blank ("Singapore · Country") or easy to mistake.
      const region = !where ? kind.charAt(0).toUpperCase() + kind.slice(1) : tiny ? `${where} · ${kind}` : where;
      return { name, region, where, center: geometry.coordinates as LngLat, tiny };
    })
    .sort((a, b) => Number(a.tiny) - Number(b.tiny))
    .filter((place) => {
      // Country, city and island of Singapore share a name and location: keep the first, largest one.
      const id = `${place.name}|${place.where}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(({ name, region, center }) => ({ name, region, center }));
  suggestionCache.set(key, places);
  return places;
}

export async function reverseGeocode([lng, lat]: LngLat, zoom: number, signal?: AbortSignal) {
  const level = Math.max(3, Math.min(14, Math.round(zoom)));
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&zoom=${level}&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const result = (await response.json()) as NominatimResult & { error?: string };
  return result.error ? null : describe(result);
}
