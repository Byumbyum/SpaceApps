// ERA5-Land point time series from the Copernicus Climate Data Store (CDS).
//
// Uses the "reanalysis-era5-land-timeseries" dataset: hourly values at one point as CSV,
// which is all a site-level degree-day series needs. Needs a free CDS account, the
// dataset licence accepted on its Download tab, and the API key in .env as CDS_KEY.
// The key is only ever sent to cds.climate.copernicus.eu.

import { inflateRawSync } from 'node:zlib';

const API = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const DATASET = 'reanalysis-era5-land-timeseries';

function apiKey() {
  // Tolerate how keys get pasted into .env: quotes, labels, a "uid:" prefix from the old API.
  const raw = (process.env.CDS_KEY ?? process.env.CDS_API_KEY ?? '').trim();
  const key = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(raw)?.[0] ?? raw;
  if (!key) throw new Error('Set CDS_KEY in .env (cds.climate.copernicus.eu → your profile → API key).');
  return key;
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'PRIVATE-TOKEN': apiKey(), 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 300);
    try { const body = JSON.parse(text); detail = body.detail ?? body.title ?? detail; } catch { /* not JSON */ }
    throw new Error(`CDS ${response.status}: ${detail}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Every file in a zip archive (CDS zips one CSV per variable); a plain file passes through. */
function unzipAll(buffer) {
  if (buffer.readUInt32LE(0) !== 0x04034b50) return [buffer];
  // Read sizes from the central directory: local headers may defer them to a data descriptor.
  let eocd = buffer.length - 22;
  while (eocd > 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  const count = buffer.readUInt16LE(eocd + 10);
  let entry = buffer.readUInt32LE(eocd + 16);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(entry + 10);
    const size = buffer.readUInt32LE(entry + 20);
    const local = buffer.readUInt32LE(entry + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    files.push(method === 8 ? inflateRawSync(data) : data);
    entry += 46 + buffer.readUInt16LE(entry + 28) + buffer.readUInt16LE(entry + 30) + buffer.readUInt16LE(entry + 32);
  }
  return files;
}

/**
 * Hourly ERA5-Land variables at a point, as rows of { time, [variable]: value }.
 * variables: CDS names, e.g. ['2m_temperature', 'soil_temperature_level_1'].
 */
export async function era5Timeseries({ lon, lat, start, end, variables, log = console.log }) {
  const inputs = { variable: variables, location: { longitude: Number(lon.toFixed(3)), latitude: Number(lat.toFixed(3)) }, date: [`${start}/${end}`], data_format: 'csv' };
  let job = await request(`${API}/processes/${DATASET}/execution`, { method: 'POST', body: JSON.stringify({ inputs }) });
  log(`  CDS job ${job.jobID}: ${variables.length} variables at ${inputs.location.latitude}, ${inputs.location.longitude}, ${start} → ${end}`);
  while (!['successful', 'failed', 'rejected', 'dismissed'].includes(job.status)) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    job = await request(`${API}/jobs/${job.jobID}`);
  }
  if (job.status !== 'successful') {
    const results = await request(`${API}/jobs/${job.jobID}/results`).catch((error) => ({ detail: error.message }));
    throw new Error(`CDS job ${job.status}: ${results.detail ?? results.title ?? ''}`);
  }
  const results = await request(`${API}/jobs/${job.jobID}/results`);
  const href = results.asset?.value?.href;
  if (!href) throw new Error('CDS job finished without a download link');
  // One CSV per variable: merge them on the timestamp.
  const byTime = new Map();
  for (const file of unzipAll(Buffer.from(await (await fetch(href)).arrayBuffer()))) {
    const [header, ...lines] = file.toString('utf8').trim().split(/\r?\n/);
    const columns = header.split(',');
    for (const line of lines) {
      const row = Object.fromEntries(line.split(',').map((value, i) => [columns[i], i === 0 || Number.isNaN(Number(value)) ? value : Number(value)]));
      byTime.set(row.valid_time, { ...(byTime.get(row.valid_time) ?? {}), ...row });
    }
  }
  return [...byTime.values()].sort((a, b) => String(a.valid_time).localeCompare(String(b.valid_time)));
}
