import { HOTSPOTS } from '../data/hotspots';

type Status = 'Real data' | 'Researched for demo' | 'Sample' | 'Planned';

interface Row { name: string; status: Status; where: string; detail: string; href?: string }

const SECTIONS: Array<{ title: string; intro: string; rows: Row[] }> = [
  {
    title: 'NASA NISAR data',
    intro: 'The satellite measurements at the heart of Prescience.',
    rows: [
      { name: 'NISAR L2 GCOV (provisional)', status: 'Real data', where: 'Map → NISAR sites, radar layers, “Measured by NISAR” panel, measured hotspot glows', detail: 'Radar backscatter for Fairbanks, Barry Arm, Blatten, Grossglockner and Gyirong, June–September 2026. Pulled from NASA CMR and Harmony, subset to each site. NASA labels this release provisional.', href: 'https://nisar-docs.asf.alaska.edu/' },
      { name: 'NISAR L2 GUNW (ground motion)', status: 'Planned', where: 'Hazard factor of the risk score, “Ground sinking” values', detail: 'Interferometric ground displacement. This is what will replace the sample subsidence numbers and the hand-set hazard values.', href: 'https://nisar-docs.asf.alaska.edu/gunw/' },
    ],
  },
  {
    title: 'Other open data in use',
    intro: 'Public datasets that make the map readable today.',
    rows: [
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
      { name: 'Risk framework', status: 'Researched for demo', where: 'Risk hotspots, risk score, tutorial', detail: 'Risk = f(Hazard, Exposure, Vulnerability, Capacity), from UNDRR (Sendai Framework) and IPCC AR6. The formula is the method we keep; only its inputs change.', href: 'https://www.undrr.org/terminology/disaster-risk' },
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
      { name: 'OPERA DISP-S1', status: 'Planned', where: 'Long-term ground-motion context', detail: 'Sentinel-1 displacement history back to 2016.', href: 'https://www.earthdata.nasa.gov/data/projects/nsite/solutions/opera-north-america-disp-product-suite' },
      { name: 'ERA5-Land and ESA CCI Permafrost', status: 'Planned', where: 'Thaw season, ground temperature, permafrost extent', detail: 'Climate and permafrost context for interpreting radar change.' },
      { name: 'WorldPop / GHSL and OpenStreetMap buildings', status: 'Planned', where: 'Exposure factor', detail: 'People, homes, roads and pipelines in harm’s way.' },
      { name: 'Socio-economic indicators and health facilities', status: 'Planned', where: 'Vulnerability and capacity factors', detail: 'Poverty, age, isolation, distance to hospitals and emergency services.' },
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
  { step: 'Score hazard (0–1)', demo: 'Judged from how severe and how frequent the documented events are.', future: 'NISAR GUNW ground-motion trends: how fast the ground moves and whether it is speeding up.' },
  { step: 'Score exposure (0–1)', demo: 'Judged from population and key infrastructure (roads, pipelines, dams) in harm’s way.', future: 'WorldPop / GHSL population and OpenStreetMap buildings, roads and pipelines.' },
  { step: 'Score vulnerability (0–1)', demo: 'Judged from remoteness, poverty and building type.', future: 'Census and World Bank socio-economic indicators.' },
  { step: 'Score capacity (0–1)', demo: 'Judged from known monitoring, early-warning systems and protective works (for example Blatten’s monitoring, the Medeu dam, Punakha’s sirens).', future: 'Health-facility and emergency-service maps, and registers of monitoring and local plans.' },
  { step: 'Combine', demo: 'Risk = f(Hazard, Exposure, Vulnerability, Capacity) per UNDRR and IPCC, as a geometric mean of H, E, V and (1 − Capacity), shown out of 100.', future: 'Same formula; only the inputs become measured.' },
  { step: 'Draw the danger zone', demo: 'Halo radius set by hand to cover the town, valley or corridor at risk.', future: 'Shaped by where NISAR measures movement and where exposed assets are.' },
];

const tone: Record<Status, string> = { 'Real data': 'real', 'Researched for demo': 'researched', Sample: 'sample', Planned: 'planned' };

export function DisclaimerPage() {
  return (
    <main id="main-content" className="more-page">
      <header className="more-hero">
        <span className="more-kicker">Demo disclaimer</span>
        <h1>What is real, and what is still to come</h1>
        <p>Prescience is a hackathon demo. Real NISAR radar already powers five sites; other numbers are researched estimates or placeholders, each labelled on screen. The goal is a world filled with real data, everywhere.</p>
        <div className="status-key">{(Object.keys(tone) as Status[]).map((status) => <span key={status} className={`status status-${tone[status]}`}>{status}</span>)}</div>
      </header>
      <section className="more-section">
        <h2>Privacy</h2>
        <p className="more-intro">Prescience sets no cookies, uses no analytics or tracking, and stores nothing in your browser. To show the map, fonts and search results, the page loads them from the services below. This is how any website works: whenever your browser loads something from a server, that server sees your IP address. They do not get your name or account.</p>
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
              <h3>Demo phase: how the hotspots are built</h3>
              <p className="more-intro">Prescience is still in its demo phase. Many of the {HOTSPOTS.length} hotspots are built for the demo rather than computed from NISAR, but we kept them scientifically sound: every place is backed by published research, and every score uses the UN (UNDRR) and IPCC risk framework. Here is how each step works now, and what replaces it.</p>
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
