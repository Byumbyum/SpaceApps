import { HOTSPOTS } from '../data/hotspots';

type Status = 'Real data' | 'Researched for demo' | 'Sample' | 'Planned';

interface Row { name: string; status: Status; where: string; detail: string; href?: string }

const SECTIONS: Array<{ title: string; intro: string; rows: Row[] }> = [
  {
    title: 'NASA NISAR data',
    intro: 'The satellite measurements at the heart of Prescient.',
    rows: [
      { name: 'NISAR L2 GCOV (provisional)', status: 'Real data', where: 'Map → NISAR sites, radar layers, “Measured by NISAR” panel, measured hotspot glows', detail: 'Radar backscatter for Fairbanks, Barry Arm, Blatten, Grossglockner and Gyirong, June–September 2026. Pulled from NASA CMR and Harmony, subset to each site. NASA labels this release provisional.', href: 'https://nisar-docs.asf.alaska.edu/' },
      { name: 'NISAR L2 GUNW (ground motion, provisional)', status: 'Real data', where: 'Map → NISAR ground movement layer, “Ground movement · NISAR” in the panel (every processed site with GUNW coverage)', detail: 'Interferograms pulled from NASA CMR and Harmony, chained into summer ground movement: ionosphere corrected, unreliable pixels removed, relative to each area’s median. Troposphere and tide corrections not yet applied, and early provisional values are noisy. Next: the other sites, then the hazard factor of the risk score.', href: 'https://nisar-docs.asf.alaska.edu/gunw/' },
      { name: 'OPERA DISP-S1 (Sentinel-1)', status: 'Real data', where: 'Fairbanks: risk hazard and “Ground movement: old and new trend” in detailed insights', detail: 'The old trend: 14 files from 2016–2025 chained into net sinking per year for each 1 km cell, using late-summer dates only. NASA computes OPERA for the United States (including Alaska) and nearby border areas only, so of our NISAR sites only Fairbanks has the old trend for now. It agrees with NISAR’s 2026 summer sinking (r = 0.64).', href: 'https://cmr.earthdata.nasa.gov/search/concepts/C3294057315-ASF.html' },
      { name: 'ESA CCI Permafrost v5 (2023)', status: 'Real data', where: 'Hazard factor P at every NISAR site', detail: 'Share of each 1 km cell underlain by permafrost, from ESA’s Climate Change Initiative (modelled ground temperature). No permafrost means no permafrost hazard.', href: 'https://climate.esa.int/en/projects/permafrost/' },
    ],
  },
  {
    title: 'Other open data in use',
    intro: 'Public datasets that make the map readable today.',
    rows: [
      { name: 'NASA POWER daily air temperature', status: 'Real data', where: 'Stefan thaw model in “Ground movement · NISAR”', detail: 'Daily 2 m temperature (MERRA-2 / GEOS-IT) at each site, summed into accumulated degree days of thaw (ADDT). Ground movement is fitted to √ADDT, which separates thaw-driven sinking from noise. No account needed.', href: 'https://power.larc.nasa.gov/' },
      { name: 'ERA5-Land (Copernicus / ECMWF)', status: 'Real data', where: '“This summer’s thaw” panel, second Stefan fit, ground temperature at 1–3 m', detail: 'Hourly 2 m air and soil temperature since 2016 at each site, on a ~9 km grid: this summer’s degree days against the 2016–2025 normal, when the topsoil thawed, and how warm the ground is at 1–3 m. Used alongside NASA POWER as a cross-check.', href: 'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries' },
      { name: 'ESA WorldCover 2021 (10 m)', status: 'Real data', where: 'Land cover layer; water exclusion and built-up share in NISAR statistics', detail: 'Read straight from ESA’s public cloud files for each site.', href: 'https://esa-worldcover.org/' },
      { name: 'OpenStreetMap via OpenFreeMap', status: 'Real data', where: 'Base map', detail: 'Roads, places and labels.', href: 'https://openfreemap.org/' },
      { name: 'Esri World Imagery', status: 'Real data', where: 'Satellite base map', detail: 'Background satellite imagery only; no analysis uses it.', href: 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9' },
      { name: 'Photon and Nominatim (OpenStreetMap)', status: 'Real data', where: 'Search box and area names', detail: 'Place search, typo-tolerant suggestions and reverse geocoding.', href: 'https://photon.komoot.io/' },
      { name: 'Natural Earth (world-atlas)', status: 'Real data', where: 'Preamble world map', detail: 'Coastlines for the Equal Earth map. The permafrost regions drawn on it are indicative outlines.', href: 'https://www.naturalearthdata.com/' },
    ],
  },
  {
    title: 'Researched for the demo',
    intro: 'Hand-built from published research so the idea can be shown now. Each will be replaced by data.',
    rows: [
      { name: 'Risk framework', status: 'Researched for demo', where: 'Risk hotspots, risk score, tutorial', detail: 'Risk = f(Hazard, Exposure, Vulnerability), the IPCC (AR5, AR6) climate-risk framework; vulnerability includes lack of capacity to cope. The IPCC prescribes no formula: the geometric mean is our choice. The method stays; only its inputs change.', href: 'https://www.undrr.org/terminology/disaster-risk' },
      { name: `${HOTSPOTS.length} risk hotspots`, status: 'Researched for demo', where: 'Red glows and halos, “Risk hotspot” panel', detail: 'Not NISAR data. Chosen and scored by hand from news and scientific reports, as explained under “How the demo hotspots were found” below, and marked “Estimate” on screen. Future: hazard from NISAR GUNW trends, exposure from OpenStreetMap buildings and WorldPop, vulnerability from census and World Bank indicators, capacity from health-facility maps.' },
      { name: 'Climate stories', status: 'Researched for demo', where: 'Preamble and More → Stories', detail: 'Events, dates and figures come from the articles and papers cited on the Stories page.' },
      { name: 'Story photos', status: 'Researched for demo', where: 'Preamble', detail: 'Tibet flood photos by Rajesh Kumar Singh / AP. Blatten before: Esri World Imagery; after: Planet Labs, both via Sonda Internacional.' },
    ],
  },
  {
    title: 'Sample values (placeholders)',
    intro: 'Clearly tagged “Sample” on screen. They exist only to show the layout.',
    rows: [
      { name: 'Permafrost panel numbers', status: 'Sample', where: 'Ground sinking, permafrost cover, thaw depth, ground temperature, safety / health / economy levels', detail: 'Generated from latitude with a seeded random spread, not measured. Replaced by NISAR GUNW, ESA CCI Permafrost and ERA5-Land.' },
      { name: 'Detailed insights charts', status: 'Sample', where: '“View detailed insights” drawer', detail: 'Synthetic ground-motion time series and demo grid cells. Replaced by NISAR GUNW and OPERA DISP-S1 histories.' },
    ],
  },
  {
    title: 'Coming next',
    intro: 'Data we plan to add so every factor of the risk score is measured.',
    rows: [
      { name: 'WorldPop / GHSL and OpenStreetMap buildings', status: 'Planned', where: 'Exposure factor', detail: 'People, homes, roads and pipelines in harm’s way.' },
      { name: 'Sentinel-1 old trend for the rest of the world', status: 'Planned', where: 'Coming soon: every site outside the United States (currently trend pending)', detail: 'Sentinel-1 images the whole world, but NASA’s ready-made OPERA trend covers only the United States and nearby border areas (not most of Canada). Elsewhere we will process the raw Sentinel-1 images ourselves (ASF HyP3 interferograms + time-series analysis) until NISAR’s own record is long enough.' },
      { name: 'Socio-economic indicators and health facilities', status: 'Planned', where: 'Vulnerability factor', detail: 'Poverty, age, isolation, distance to hospitals and emergency services.' },
    ],
  },
];

// Third-party services the browser contacts while using the site.
const PRIVACY: Array<{ name: string; detail: string; href: string }> = [
  { name: 'OpenFreeMap', detail: 'Base map tiles and style.', href: 'https://openfreemap.org/' },
  { name: 'Esri (ArcGIS Online)', detail: 'Satellite imagery tiles, and the fallback base map.', href: 'https://www.esri.com/en-us/privacy/overview' },
  { name: 'Photon by komoot', detail: 'Search suggestions: receives what you type in the search box.', href: 'https://www.komoot.com/privacy' },
  { name: 'Nominatim (OpenStreetMap Foundation)', detail: 'Full search on Enter, and naming the area you select: receives the search text or the area’s coordinates.', href: 'https://osmfoundation.org/wiki/Privacy_Policy' },
  { name: 'Google Fonts', detail: 'The Inter and Google Sans Flex typefaces.', href: 'https://policies.google.com/privacy' },
];

// How the hand-built demo hotspots were made, and what replaces each step.
const HOTSPOT_METHOD: Array<{ step: string; demo: string; future: string }> = [
  { step: 'Pick the places', demo: 'Places with documented permafrost-related damage or danger: thaw under towns and pipelines, eroding coasts, creeping slopes, rock-ice avalanches and glacial lake floods. Found in news reports, park services and scientific papers.', future: 'Every place NISAR surveys is checked; hotspots are wherever the computed risk is high.' },
  { step: 'Score hazard (0–1)', demo: 'Judged from how severe and how frequent the documented events are.', future: 'Permafrost present (ESA CCI) × ground close to thawing (ERA5-Land) × net sinking over many years (Sentinel-1 InSAR since 2016, NISAR from 2026 onwards). Computed already at the NISAR sites.' },
  { step: 'Score exposure (0–1)', demo: 'Judged from population and key infrastructure (roads, pipelines, dams) in harm’s way.', future: 'WorldPop / GHSL population and OpenStreetMap buildings, roads and pipelines.' },
  { step: 'Score vulnerability (0–1)', demo: 'IPCC vulnerability has two parts, each judged by hand: susceptibility (remoteness, poverty, building type) and lack of capacity to cope (known monitoring, early warning and protective works, for example Blatten’s monitoring, the Medeu dam, Punakha’s sirens). Combined as √(susceptibility × (1 − coping capacity)).', future: 'Census and World Bank indicators, and health-facility and emergency-service maps.' },
  { step: 'Combine', demo: 'Risk = f(Hazard, Exposure, Vulnerability) per the IPCC, as our geometric mean of H, E and V, shown out of 100.', future: 'Same formula; only the inputs become measured.' },
  { step: 'Draw the danger zone', demo: 'Where NISAR ground movement is processed (Fairbanks, Ulaanbaatar so far), zones are computed per 1 km cell and outlined where measured movement meets buildings. Elsewhere, a soft glow on one point marks the researched estimate.', future: 'Every hotspot computed this way, as each site’s NISAR ground movement is processed.' },
];

const tone: Record<Status, string> = { 'Real data': 'real', 'Researched for demo': 'researched', Sample: 'sample', Planned: 'planned' };

export function DisclaimerPage() {
  return (
    <main id="main-content" className="more-page">
      <header className="more-hero">
        <span className="more-kicker">Demo disclaimer</span>
        <h1>What is real, and what is still to come</h1>
        <p>Prescient is a hackathon demo. Real NISAR radar already powers a handful of demo sites; other numbers are researched estimates or placeholders, each labelled on screen. The goal is a world filled with real data, everywhere.</p>
        <div className="status-key">{(Object.keys(tone) as Status[]).map((status) => <span key={status} className={`status status-${tone[status]}`}>{status}</span>)}</div>
      </header>
      <section className="more-section">
        <h2>Privacy</h2>
        <p className="more-intro">Prescient sets no cookies, uses no analytics or tracking, and stores nothing in your browser. To show the map, fonts and search results, the page loads them from the services below. This is how any website works: whenever your browser loads something from a server, that server sees your IP address. They do not get your name or account.</p>
        <div className="data-rows">
          {PRIVACY.map((row) => (
            <article key={row.name} className="data-row">
              <div className="data-row-head"><h3><a href={row.href} target="_blank" rel="noreferrer">{row.name} ↗</a></h3></div>
              <p>{row.detail}</p>
            </article>
          ))}
        </div>
      </section>
      {SECTIONS.map((section) => (
        <section key={section.title} className="more-section">
          <h2>{section.title}</h2>
          <p className="more-intro">{section.intro}</p>
          <div className="data-rows">
            {section.rows.map((row) => (
              <article key={row.name} className="data-row">
                <div className="data-row-head">
                  <h3>{row.href ? <a href={row.href} target="_blank" rel="noreferrer">{row.name} ↗</a> : row.name}</h3>
                  <span className={`status status-${tone[row.status]}`}>{row.status}</span>
                </div>
                <p className="data-where"><b>Used in</b>{row.where}</p>
                <p>{row.detail}</p>
              </article>
            ))}
          </div>
          {section.title === 'Researched for the demo' && (
            <div className="method-block">
              <h3>A first line of defence</h3>
              <p className="more-intro">Prescient is the first line of defence: it shows where the ground is turning risky. Governments, NGOs and communities can then investigate what it means for each part of daily life there: homes, roads, water, health and livelihoods. Risk scores are relative indices, not probabilities, and every estimate is labelled as one.</p>
              <div className="case-study">
                <h4>Case study for this demo: Ulaanbaatar’s ger districts</h4>
                <p>Prescient flags the northern ger-district hills: warm permafrost (about 72% of each cell), ground 1–3 m down now around +1 °C, and NISAR sees 2–3 cm of thaw sinking under homes. That is where Prescient stops. Local follow-up then asks what it means for each part of life, for example:</p>
                <ul>
                  <li><b>Homes:</b> houses on shallow foundations can crack and tilt as the ground settles unevenly.</li>
                  <li><b>Health:</b> pit latrines and hand-dug wells share the same thawing ground, so sewage can reach drinking water.</li>
                  <li><b>Livelihoods:</b> informal, unplanned homes have no engineering survey and little money for repairs.</li>
                </ul>
                <p>The same questions apply anywhere Prescient flags: what stands on this ground, who depends on it, and what checks (building inspections, ground surveys, water testing) would confirm the risk.</p>
              </div>
              <h3>Prescient is still in its demo phase</h3>
              <p className="more-intro">Prescient is still in its demo phase. Many of the {HOTSPOTS.length} hotspots are built for the demo rather than computed from NISAR, but we kept them scientifically sound: every place is backed by published research, and every score uses the IPCC climate-risk framework. Here is how each step works now, and what replaces it.</p>
              <ol className="method-steps-list">
                {HOTSPOT_METHOD.map((item) => (
                  <li key={item.step}>
                    <b>{item.step}</b>
                    <p><span>Demo</span>{item.demo}</p>
                    <p><span>Future</span>{item.future}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
