import scoringConfig from '../../config/scoring.config.json';
import type { DemoManifest, ScoringConfig } from '../types';
import { EvidenceTag } from './EvidenceTag';
import { HowItWorks } from './HowItWorks';

const config = scoringConfig as ScoringConfig;

const sources = [
  ['NISAR L2 GUNW', 'Summer 2026 relative LOS displacement · 80 m · PROVISIONAL', 'https://nisar-docs.asf.alaska.edu/gunw/'],
  ['OPERA DISP-S1', 'Historical radar baseline from July 2016 onward', 'https://www.earthdata.nasa.gov/data/projects/nsite/solutions/opera-north-america-disp-product-suite'],
  ['ERA5-Land', '2 m air temperature, ADDT and recent precipitation context', 'https://cds.climate.copernicus.eu/'],
  ['ESA CCI Permafrost', 'Coarse permafrost fraction used as interpretation context', 'https://catalogue.ceda.ac.uk/uuid/1f88068e86304b0fbd34456115b6606f/'],
  ['MODIS snow cover', 'Acquisition-date snow screening', 'https://nsidc.org/data/modis'],
  ['JRC Global Surface Water', 'Open-water exclusion', 'https://global-surface-water.appspot.com/'],
  ['OpenStreetMap', 'Candidate highway and pipeline geometry, independently checked before analysis', 'https://www.openstreetmap.org/'],
];

export function AboutData({ manifest }: { manifest: DemoManifest }) {
  return (
    <main id="main-content" className="about-page">
      <HowItWorks />
      <section className="about-hero"><h1>About the evidence</h1><p>Every number needs a source, date range and quality indicator. This page records the contract the real pipeline must satisfy before a layer can replace the demo.</p></section>
      <section className="about-grid">
        <article className="about-card status-card"><div className="card-heading"><div><h2>Demo manifest</h2></div><EvidenceTag kind="INFERRED" /></div><div className="manifest-facts"><div><span>Processing version</span><b>{manifest.processing_version}</b></div><div><span>Analysis grid</span><b>{manifest.grid.cell_size_m} m · {manifest.grid.crs}</b></div><div><span>NISAR maturity</span><b>{manifest.nisar_status.maturity}</b></div><div><span>Known gap</span><b>27 Jul–10 Aug 2026</b></div></div></article>
        <article className="about-card reference-card"><h2>{manifest.reference.name}</h2><p>{manifest.reference.latitude.toFixed(2)}°N, {Math.abs(manifest.reference.longitude).toFixed(2)}°W · reference date {manifest.reference.date}</p><strong>{manifest.reference.stability}</strong><p>The team must confirm the control-tundra polygon and stable reference area before real results are presented.</p></article>
      </section>
      <section className="about-section"><h2>What enters the workflow</h2><div className="source-table">{sources.map(([name, purpose, href]) => <a key={name} href={href} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{purpose}</span><b>Source ↗</b></a>)}</div></section>
      <section className="about-section method-section"><h2>Fail closed, then interpret</h2><div className="method-steps"><div><b>01</b><h3>Correct + reference</h3><p>Apply ionosphere, troposphere and solid-earth-tide layers with verified units/signs. Record CRID and reference uncertainty.</p></div><div><b>02</b><h3>Exclude</h3><p>Remove water, contaminated snow/freeze–thaw dates, disconnected phase, unsupported geometry and insufficient observations.</p></div><div><b>03</b><h3>Measure Q</h3><p>Combine coherence, temporal support, correction burden, reference stability and independent sensor agreement.</p></div><div><b>04</b><h3>Interpret E</h3><p>Combine permafrost context, timing, persistence, ground-ice/fire context, field evidence and a recent-rain penalty.</p></div></div></section>
      <section className="about-grid">
        <article className="about-card"><h2>{config.factors.length} disclosed factors</h2><p>Q and E use a weighted geometric mean. An observed true zero produces zero; unavailable evidence is marked “not assessed” and weights renormalize over available factors.</p><div className="thresholds"><span>HIGH ≥ {config.bands.high}</span><span>MEDIUM ≥ {config.bands.medium}</span><span>LOW &lt; {config.bands.medium}</span></div></article>
        <article className="about-card limitation-card"><h2>What can stop a claim</h2><ul>{manifest.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></article>
      </section>
      <section className="about-section open-questions"><h2>Do not guess these silently</h2><ul><li>Exact control-tundra polygons and stable reference area</li><li>100 m grid versus H3 cells for final paint selection</li><li>Coverage and quality of real NISAR GUNW pairs over the MVP box</li><li>Reliable sources for community facility locations</li><li>Whether later terrain chapters require CesiumJS rather than MapLibre</li></ul></section>
    </main>
  );
}
