import { useMemo, useState } from 'react';
import scoringJson from '../../config/scoring.config.json';
import { useAppStore, type LayerId } from '../store';
import type { DemoCellProperties, ScoringConfig, SegmentProperties, TimePoint } from '../types';
import { computeIndex } from '../lib/scoring';
import { EvidenceTag } from './EvidenceTag';
import { TimeSeriesPanel } from './TimeSeriesPanel';

type CellFeature = { properties: DemoCellProperties };
type SegmentFeature = { properties: SegmentProperties };

const config = scoringJson as ScoringConfig;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function AnalysisSidebar({ cells, segments, series }: { cells: CellFeature[]; segments: SegmentFeature[]; series: TimePoint[] }) {
  const selectedIds = useAppStore((state) => state.selectedCellIds);
  const focusedCellId = useAppStore((state) => state.focusedCellId);
  const startYear = useAppStore((state) => state.startYear);
  const endYear = useAppStore((state) => state.endYear);
  const layer = useAppStore((state) => state.layer);
  const setLayer = useAppStore((state) => state.setLayer);
  const highQualityOnly = useAppStore((state) => state.highQualityOnly);
  const setHighQualityOnly = useAppStore((state) => state.setHighQualityOnly);
  const [features, setFeatures] = useState(['nisar', 'sentinel', 'addt', 'q', 'e']);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const included = useMemo(() => {
    const selection = selectedIds.length ? cells.filter((feature) => selectedSet.has(feature.properties.id)) : cells;
    return selection.filter((feature) => !feature.properties.excluded && (!highQualityOnly || feature.properties.q >= 0.75));
  }, [cells, selectedIds.length, selectedSet, highQualityOnly]);
  const excludedCount = (selectedIds.length ? cells.filter((feature) => selectedSet.has(feature.properties.id)) : cells).length - included.length;
  const focused = cells.find((feature) => feature.properties.id === focusedCellId)?.properties ?? included[0]?.properties;
  const qResult = focused ? computeIndex('Q', focused, config) : null;
  const eResult = focused ? computeIndex('E', focused, config) : null;
  const orderedSegments = [...segments].sort((a, b) => Math.abs(b.properties.z) - Math.abs(a.properties.z));

  const toggleFeature = (id: string) => setFeatures((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const bands = (key: 'q_band' | 'e_band') => ['high', 'medium', 'low'].map((band) => ({
    band,
    share: included.length ? included.filter((feature) => feature.properties[key] === band).length / included.length : 0,
  }));

  return (
    <aside className="analysis-sidebar" aria-label="Selection analysis">
      <section className="analysis-card selector-card">
        <div className="card-heading"><div><span className="panel-kicker">ANALYSIS LAYERS</span><h2>Explore the evidence</h2></div><span className="selection-count">{selectedIds.length || cells.length} cells</span></div>
        <div className="feature-grid">
          {[['nisar', 'NISAR motion', 'PROVISIONAL'], ['sentinel', 'Sentinel-1 baseline', '2016–2026'], ['addt', 'Air temperature / ADDT', 'ASSOCIATION'], ['q', 'Measurement quality Q', 'INDEX'], ['e', 'Thaw interpretation E', 'INDEX']].map(([id, label, meta]) => (
            <label key={id}><input type="checkbox" checked={features.includes(id)} onChange={() => toggleFeature(id)} /><span>{label}<small>{meta}</small></span></label>
          ))}
        </div>
        <div className="layer-tabs" aria-label="Map layer">
          {([['motion', 'Motion'], ['quality', 'Q quality'], ['interpretation', 'E context']] as Array<[LayerId, string]>).map(([id, label]) => <button key={id} className={layer === id ? 'active' : ''} onClick={() => setLayer(id)}>{label}</button>)}
        </div>
        <div className="band-controls"><label><input type="checkbox" checked readOnly /> L-band</label><label className="disabled" title="S-band is not collected over Alaska"><input type="checkbox" disabled /> S-band</label><span>S-band is not collected over Alaska.</span></div>
        <label className="quality-toggle"><input type="checkbox" checked={highQualityOnly} onChange={(event) => setHighQualityOnly(event.target.checked)} /><span>Show high-quality data only</span></label>
      </section>

      {features.some((id) => id === 'nisar' || id === 'sentinel') && <TimeSeriesPanel series={series} startYear={startYear} endYear={endYear} />}

      <section className="analysis-card">
        <div className="card-heading"><div><span className="panel-kicker">GEOGRAPHIC HEATMAP</span><h3>{layer === 'motion' ? 'Ground-motion pattern' : layer === 'quality' ? 'Measurement quality' : 'Interpretation support'}</h3></div><EvidenceTag kind={layer === 'motion' ? 'OBSERVED' : 'INFERRED'} /></div>
        <div className="mini-heatmap" aria-label="Grid overview">
          {cells.map(({ properties }) => <i key={properties.id} className={properties.excluded ? 'excluded' : ''} style={{ opacity: properties.excluded ? 0.25 : Math.max(0.18, properties.q), backgroundColor: layer === 'quality' ? `color-mix(in srgb, #bfe8c5 ${properties.q * 100}%, #4b3152)` : layer === 'interpretation' ? `color-mix(in srgb, #efd184 ${properties.e * 100}%, #3b3156)` : properties.motion_cm_yr < -2 ? '#d95f4f' : properties.motion_cm_yr < -1 ? '#e7b55c' : '#63aebf' }} />)}
        </div>
        <p className="microcopy">{included.length} valid · {excludedCount} excluded in the current denominator. Click a map cell to inspect it below.</p>
      </section>

      <section className="analysis-card">
        <div className="card-heading"><div><span className="panel-kicker">INDEX SUMMARY · MEDIANS</span><h3>Quality and interpretation</h3></div><EvidenceTag kind="INFERRED" /></div>
        <div className="index-median-row"><div><span>Q</span><strong>{median(included.map((feature) => feature.properties.q)).toFixed(2)}</strong><small>measurement quality</small></div><div><span>E</span><strong>{median(included.map((feature) => feature.properties.e)).toFixed(2)}</strong><small>thaw interpretation</small></div></div>
        <div className="band-summary">
          <div><b>Q share of valid cells</b>{bands('q_band').map(({ band, share }) => <span key={band}><i className={band} style={{ width: `${share * 100}%` }} /><em>{band} {Math.round(share * 100)}%</em></span>)}</div>
          <div><b>E share of valid cells</b>{bands('e_band').map(({ band, share }) => <span key={band}><i className={band} style={{ width: `${share * 100}%` }} /><em>{band} {Math.round(share * 100)}%</em></span>)}</div>
        </div>
        <p className="microcopy">Team-defined screening categories, not calibrated probabilities. Changing weights in the shared config updates both indices and the Why panel.</p>
      </section>

      <section className="analysis-card why-card">
        <div className="card-heading"><div><span className="panel-kicker">WHY?</span><h3>{focused?.area_name ?? 'Select a valid cell'}</h3></div><EvidenceTag kind="INFERRED" /></div>
        {focused && qResult && eResult ? <>
          <div className="coordinate-readout"><span>GRID CELL {focused.id}</span><strong>{focused.latitude.toFixed(4)}°N, {Math.abs(focused.longitude).toFixed(4)}°W</strong><small>Centroid from the GeoJSON geometry · WGS 84</small></div>
          <div className="quality-badges"><span>Measurement Q: <b>{qResult.band} · {qResult.value?.toFixed(2)}</b></span><span>Interpretation E: <b>{eResult.band} · {eResult.value?.toFixed(2)}</b></span></div>
          {[...qResult.factors, ...eResult.factors].map((factor) => <div className={`factor-row ${factor.id === qResult.limitedBy?.id || factor.id === eResult.limitedBy?.id ? 'limited' : ''}`} key={factor.id}><div><span>{factor.label}</span><small>{factor.available ? factor.explanation : 'Not assessed for this cell; weights renormalized.'}</small></div><div className="factor-track"><i style={{ width: `${(factor.normalized ?? 0) * 100}%` }} /></div><b>{factor.normalized === null ? 'N/A' : factor.normalized.toFixed(2)}</b></div>)}
          <p className="limit-note">Limited by: <strong>{qResult.limitedBy?.label ?? 'no Q factor'} / {eResult.limitedBy?.label ?? 'no E factor'}</strong></p>
        </> : <p>No valid cell is available under the current filter.</p>}
      </section>

      <section className="analysis-card exposure-card">
        <div className="card-heading"><div><span className="panel-kicker">INFRASTRUCTURE EXPOSURE</span><h3>Segments to revisit</h3></div><EvidenceTag kind="INFERRED" /></div>
        <p className="safety-note">Near observed ground motion; may warrant closer investigation. Not a structural safety rating.</p>
        <div className="segment-list">{orderedSegments.slice(0, 7).map(({ properties }) => <div key={properties.id}><span className={`priority-dot ${properties.priority}`} /><div><strong>{properties.name}</strong><small>{Math.round(properties.valid_coverage * 100)}% valid coverage · uncertainty ±{properties.uncertainty_cm} cm</small></div><b>{properties.priority}</b></div>)}</div>
      </section>

      <section className="analysis-card context-card">
        <div className="card-heading"><div><span className="panel-kicker">LONG-TERM CONTEXT · NO SCORE</span><h3>Carbon feedback</h3></div><EvidenceTag kind="PUBLISHED" /></div>
        <p>Published research describes a <strong>self-reinforcing feedback</strong>, with possible localized abrupt thaw. IPCC AR6 assessed high confidence that thaw releases carbon, while the amount remains uncertain.</p>
        <p className="context-emphasis">Our maps measure ground motion only, not carbon.</p>
        <div className="source-links"><a href="https://www.woodwellclimate.org/review-of-permafrost-science-in-ipccs-ar6-wg1/" target="_blank" rel="noreferrer">IPCC AR6 review ↗</a><a href="https://pik-potsdam.de/members/johanro/ArmstrongMcKayetal2022_ClimateTippingPointsReassessment_AcceptedversionwithFigures.pdf" target="_blank" rel="noreferrer">Armstrong McKay 2022 ↗</a></div>
      </section>

      <details className="analysis-card guide-card"><summary>How to interpret this data <span>+</span></summary><ul><li>Ground motion is relative to a reference point and date; summer sinking and autumn rise can be normal.</li><li>A downward multi-year trend is consistent with ground-ice loss but can have other causes.</li><li>Brightness can change with normal thaw, rain, wet snow and plants; it is not proof of permafrost loss.</li><li>Faded cells have lower Q; grey cells were excluded for a stated reason.</li><li>Monitoring priority is not a safety rating.</li><li>Thresholds and weights are team choices, exposed in the Why panel.</li></ul></details>
    </aside>
  );
}
