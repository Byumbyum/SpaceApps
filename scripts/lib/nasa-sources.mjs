// Where the GCOV pipeline gets its rasters: NASA APIs (default) or a local folder.
//
// API route, nothing written to disk:
//   1. CMR (public, no login)      find the NISAR GCOV granules over the area and dates
//   2. Harmony (Earthdata token)   crop each granule to the area and return GeoTIFFs of the
//                                  requested layers (a 7 GB granule becomes ~25 MB per layer)
//   3. Each GeoTIFF is fetched into memory when the pipeline reads it.
// ESA WorldCover land cover is a public Cloud-Optimised GeoTIFF on AWS: only the needed window
// is range-read, no login.
//
// The token comes from NASA_TOKEN in .env (git-ignored; urs.earthdata.nasa.gov → Generate Token). It is sent
// only to harmony.earthdata.nasa.gov and never printed.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fromArrayBuffer, fromFile, fromUrl } from 'geotiff';

const CMR = 'https://cmr.earthdata.nasa.gov/search';
const HARMONY = 'https://harmony.earthdata.nasa.gov';
const WORLDCOVER = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map';

/** One raster the pipeline can open, wherever it lives. */
const localItem = (file) => ({ name: path.basename(file), open: () => fromFile(file) });

export async function listLocal(dir) {
  return (await readdir(dir).catch(() => [])).map((name) => localItem(path.join(dir, name)));
}

async function getJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url.split('?')[0]}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

/** CMR granule search. Public, so it also powers --dry-run. */
export async function findGranules({ shortName, bbox, start, end }) {
  const [collection] = (await getJson(`${CMR}/collections.json?short_name=${shortName}`)).feed.entry;
  if (!collection) throw new Error(`CMR has no collection ${shortName}`);
  const query = new URLSearchParams({ short_name: shortName, bounding_box: bbox.join(','), temporal: `${start}T00:00:00Z,${end}T23:59:59Z`, page_size: '2000', sort_key: 'start_date' });
  const granules = (await getJson(`${CMR}/granules.json?${query}`)).feed.entry.map((entry) => ({ id: entry.id, name: entry.producer_granule_id ?? entry.title, sizeMb: Number(entry.granule_size) }));
  return { collectionId: collection.id, granules };
}

/**
 * Keep the 10 m (mode 4005) granules of a pass when it has them; the 20 m ones calibrate
 * differently and would be dropped by the pipeline anyway, so don't ask Harmony for them.
 */
export function preferTenMetre(granules) {
  const passOf = (name) => { const m = /GCOV_\d{3}_(\d{3})_([AD])_\d{3}_(\d{4})_\w{4}_\w_(\d{8})/.exec(name); return m ? { key: `${m[1]}${m[2]}${m[4]}`, mode: m[3] } : null; };
  const tenMetre = new Set(granules.map((g) => passOf(g.name)).filter((p) => p?.mode === '4005').map((p) => p.key));
  return granules.filter((g) => { const p = passOf(g.name); return !p || p.mode === '4005' || !tenMetre.has(p.key); });
}

export function harmonyUrl({ collectionId, granules, variables, bbox, outputCrs }) {
  const [west, south, east, north] = bbox;
  const query = new URLSearchParams();
  variables.forEach((variable) => query.append('variable', variable));
  query.append('subset', `lat(${south}:${north})`);
  query.append('subset', `lon(${west}:${east})`);
  granules.forEach((granule) => query.append('granuleId', granule.id));
  if (outputCrs) query.set('outputCrs', outputCrs);
  query.set('format', 'image/tiff');
  query.set('forceAsync', 'true');
  return `${HARMONY}/${collectionId}/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset?${query}`;
}

/** Submit one Harmony job, wait for it, and return its output GeoTIFFs as openable items. */
export async function harmonySubset({ token, collectionId, granules, variables, bbox, outputCrs, jobId, log = console.log }) {
  // Tolerate how tokens get pasted into .env (quotes, "Bearer ", labels, stray spaces):
  // Earthdata tokens are JWTs, so keep just the JWT.
  token = /eyJ[\w-]+\.[\w-]+\.[\w-]+/.exec(token ?? '')?.[0] ?? token?.trim();
  if (!token) throw new Error('Set NASA_TOKEN in .env (urs.earthdata.nasa.gov → Generate Token) to use the NASA API, or run with --source=local.');
  const auth = { Authorization: `Bearer ${token}` };
  // Same request as harmonyUrl, sent as a form POST so long granule lists are accepted.
  const [endpoint, query] = harmonyUrl({ collectionId, granules, variables, bbox, outputCrs }).split('?');
  const form = new FormData();
  new URLSearchParams(query).forEach((value, key) => form.append(key, value));
  // jobId reattaches to a job submitted earlier (e.g. after the terminal was closed).
  let job = jobId
    ? await getJson(`${HARMONY}/jobs/${jobId}`, { headers: auth })
    : await getJson(endpoint, { method: 'POST', headers: auth, body: form });
  log(`Harmony job ${job.jobID}: ${granules.length} granules × ${variables.length} layers${jobId ? ' (reattached)' : ''}`);
  while (!['successful', 'complete_with_errors', 'failed', 'canceled'].includes(job.status)) {
    await new Promise((resolve) => setTimeout(resolve, 15000));
    job = await getJson(`${HARMONY}/jobs/${job.jobID}`, { headers: auth });
    process.stdout.write(`\r  Harmony ${job.status} ${job.progress ?? 0}%   `);
  }
  process.stdout.write('\n');
  if (job.status === 'failed' || job.status === 'canceled') throw new Error(`Harmony job ${job.jobID} ${job.status}: ${job.message}`);
  if (job.status === 'complete_with_errors') log(`Harmony finished with errors (${job.message}); continuing with the files it produced.`);

  // Result links are paginated.
  const links = [];
  for (let page = 1; ; page += 1) {
    const result = await getJson(`${HARMONY}/jobs/${job.jobID}?page=${page}&limit=2000`, { headers: auth });
    links.push(...result.links.filter((link) => link.rel === 'data' && /\.tiff?$/i.test(link.href)));
    if (!result.links.some((link) => link.rel === 'next')) break;
  }
  return links.map((link) => ({ name: link.title ?? path.basename(new URL(link.href).pathname), open: () => fetchGeoTiff(link.href, auth) }));
}

// Harmony answers with a redirect to a signed S3 URL. Follow it by hand so the Earthdata
// token never travels to S3 (S3 also rejects requests carrying two kinds of auth).
async function fetchGeoTiff(href, auth) {
  let response = await fetch(href, { headers: auth, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) response = await fetch(new URL(response.headers.get('location'), href));
  if (!response.ok) throw new Error(`${response.status} downloading ${path.basename(href)}`);
  return fromArrayBuffer(await response.arrayBuffer());
}

/** ESA WorldCover 3° tiles covering a lon/lat box, read straight from the public bucket. */
export function worldcoverTiles([west, south, east, north]) {
  const tiles = [];
  for (let lat = Math.floor(south / 3) * 3; lat < north; lat += 3) {
    for (let lon = Math.floor(west / 3) * 3; lon < east; lon += 3) {
      const name = `ESA_WorldCover_10m_2021_v200_${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}_Map.tif`;
      tiles.push({ name, open: () => fromUrl(`${WORLDCOVER}/${name}`) });
    }
  }
  return tiles;
}
