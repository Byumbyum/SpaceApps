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

export async function reverseGeocode([lng, lat]: LngLat, zoom: number, signal?: AbortSignal) {
  const level = Math.max(3, Math.min(14, Math.round(zoom)));
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&zoom=${level}&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const result = (await response.json()) as NominatimResult & { error?: string };
  return result.error ? null : describe(result);
}
