// Write public/data/nisar/sites.json: one entry per processed site, so the web app can draw
// every footprint and load a site's gcov.json only when an area inside it is selected.
//
//   node scripts/lib/site-index.mjs        (also run at the end of every process-gcov run)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITES } from '../sites.mjs';

const INDEX = 'public/data/nisar/sites.json';

export function writeSiteIndex() {
  const sites = [];
  for (const [id, site] of Object.entries(SITES)) {
    const file = path.join(site.out, 'gcov.json');
    if (!existsSync(file)) continue;
    const gcov = JSON.parse(readFileSync(file, 'utf8'));
    const dates = gcov.passes.map((pass) => pass.date).sort();
    sites.push({
      id,
      label: site.label,
      base: `/${path.relative('public', site.out).split(path.sep).join('/')}`,
      corners: gcov.corners,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      passCount: gcov.passes.length,
      changeTracks: gcov.tracks_in_change_map,
      note: site.note ?? null,
      // Ground movement from GUNW, when processed for this site.
      gunw: existsSync(path.join(site.out, 'gunw.json')),
    });
  }
  writeFileSync(INDEX, `${JSON.stringify(sites, null, 2)}\n`);
  return sites;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sites = writeSiteIndex();
  console.log(`Wrote ${INDEX}: ${sites.map((site) => site.id).join(', ') || 'no processed sites'}`);
}
