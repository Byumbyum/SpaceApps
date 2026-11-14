import { useMemo, useState } from 'react';
import { formatArea } from '../lib/geo';
import { describeChange, summarizeGcov, type GcovSummary } from '../lib/gcov';
import type { GcovData } from '../types';
import { PHENOMENA } from '../lib/phenomena';
import { placeholderPermafrost, type ImpactInsight, type Level } from '../lib/placeholderInsights';
import { useAppStore } from '../store';
import { ArrowRightIcon, ChevronIcon, CloseIcon, CoinIcon, HeartIcon, SatelliteIcon, ShieldIcon } from './Icons';

export function LevelPill({ level }: { level: Level }) {
  return <span className={`level level-${level.toLowerCase()}`}>{level}</span>;
}

const impacts: Array<{ key: 'safety' | 'health' | 'economy'; label: string; Icon: typeof ShieldIcon }> = [
  { key: 'safety', label: 'Safety', Icon: ShieldIcon },
  { key: 'health', label: 'Health', Icon: HeartIcon },
  { key: 'economy', label: 'Economy', Icon: CoinIcon },
];

export function LandcoverList({ items }: { items: GcovSummary['landcover'] }) {
  return (
    <ul className="landcover-list">
      {items.map((item) => (
        <li key={item.code}>
          <i style={{ background: item.color }} />
          <span>{item.label}</span>
          <em>{item.sharePct.toFixed(0)}%</em>
          <b>{item.changeDb === null ? '—' : `${item.changeDb > 0 ? '+' : ''}${item.changeDb.toFixed(1)} dB`}</b>
        </li>
      ))}
    </ul>
  );
}

export function NisarBlock({ summary, gcov }: { summary: GcovSummary; gcov: GcovData }) {
  const change = summary.changeDb;
  return (
    <div className="nisar-block">
      <div className="nisar-title"><SatelliteIcon /><b>Measured by NISAR</b><span className="evidence evidence-observed">OBSERVED</span><span className="provisional-chip">Provisional</span></div>
      <div className="nisar-metric">
        <strong>{change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} dB`}</strong>
        <span>{describeChange(change)}</span>
      </div>
      <div className="stat-row compact">
        <div><strong>{summary.waterEarlyPct === null ? '—' : `${summary.waterEarlyPct.toFixed(1)}% → ${(summary.waterLatePct ?? 0).toFixed(1)}%`}</strong><span>Likely open water</span></div>
        <div><strong>{summary.passCount}</strong><span>Radar passes</span></div>
        <div><strong>{summary.trackCount}</strong><span>Viewing angles</span></div>
      </div>
      {summary.landcover.length > 0 && <LandcoverList items={summary.landcover.slice(0, 3)} />}
      {gcov.tracks_in_change_map < 2 && <p className="nisar-note">Summer change here rests on {gcov.tracks_in_change_map === 1 ? 'one viewing angle' : 'no complete viewing angle'}, so treat it as less certain.</p>}
      {gcov.site?.note && <p className="nisar-note">{gcov.site.note}</p>}
    </div>
  );
}

export function AreaInsights({ gcov = null }: { gcov?: GcovData | null }) {
  const area = useAppStore((state) => state.selectedArea);
  const setSelectedArea = useAppStore((state) => state.setSelectedArea);
  const setAnalysisOpen = useAppStore((state) => state.setAnalysisOpen);
  const phenomenon = useAppStore((state) => state.phenomenon);
  const setPhenomenon = useAppStore((state) => state.setPhenomenon);
  const [othersOpen, setOthersOpen] = useState(false);
  const insight = useMemo(() => (area ? placeholderPermafrost(area.center) : null), [area]);
  const nisar = useMemo(() => (area && gcov ? summarizeGcov(gcov, area.ring, area.center) : null), [area, gcov]);

  if (!area || !insight) return null;
  const active = PHENOMENA.find((item) => item.id === phenomenon) ?? PHENOMENA[0];

  return (
    <section className="insights-panel" aria-label={`Insights for ${area.name}`}>
      <header className="insights-header">
        <div>
          <h2>{area.name}</h2>
          <p>{area.region} · {formatArea(area.areaKm2)}</p>
        </div>
        <button className="icon-button" onClick={() => setSelectedArea(null)} aria-label="Close insights"><CloseIcon /></button>
      </header>

      <div className="insights-body">
        {!active.available ? (
          <div className="panel-coming-soon">
            <h3>{active.label}</h3>
            <p>Insights for {active.label.toLowerCase()} are coming soon.</p>
            <button className="text-link" onClick={() => setPhenomenon('permafrost')}>Back to permafrost thaw</button>
          </div>
        ) : !insight.hasPermafrost ? (
          <div className="panel-coming-soon">
            <h3>Little or no permafrost here</h3>
            <p>This area is outside the main permafrost zones. Try somewhere in the Arctic, like northern Alaska or Siberia.</p>
          </div>
        ) : (
          <>
            {nisar && gcov && <NisarBlock summary={nisar} gcov={gcov} />}
            <div className="hero-metric">
              <div>
                <span className="metric-label">Ground sinking <span className="sample-tag">Sample</span></span>
                <strong>{insight.subsidenceCmYr.toFixed(1)}<small> cm/yr</small></strong>
              </div>
              <LevelPill level={insight.level} />
            </div>
            <div className="stat-row">
              <div><strong>{insight.extentPct}%</strong><span>Permafrost cover</span></div>
              <div><strong>+{insight.activeLayerChangeCm} cm</strong><span>Thaw depth / decade</span></div>
              <div><strong>{insight.groundTempC}°C</strong><span>Ground temp.</span></div>
            </div>

            <h3 className="section-title">Impact of thaw <span className="sample-tag">Sample</span></h3>
            <ul className="impact-list">
              {impacts.map(({ key, label, Icon }) => {
                const item: ImpactInsight = insight[key];
                return (
                  <li key={key}>
                    <span className={`impact-icon impact-${key}`}><Icon /></span>
                    <div><b>{label}</b><span>{item.headline}</span></div>
                    <LevelPill level={item.level} />
                  </li>
                );
              })}
            </ul>

            <button className="primary-action" onClick={() => setAnalysisOpen(true)}>View detailed insights <ArrowRightIcon /></button>
          </>
        )}
        {active.available && insight.hasPermafrost && <p className="sample-note">{nisar ? 'Values tagged Sample are placeholders until ground-motion (GUNW) data is processed.' : 'Sample values for layout only. Real NISAR data covers the sites outlined on the map.'}</p>}
      </div>

      <footer className="phenomena">
        <button className="phenomena-toggle" onClick={() => setOthersOpen(!othersOpen)} aria-expanded={othersOpen}>
          <span>Climate phenomenon<b>{active.label}</b></span>
          <ChevronIcon style={{ transform: othersOpen ? 'rotate(180deg)' : undefined }} />
        </button>
        {othersOpen && (
          <div className="phenomena-grid">
            {PHENOMENA.map((item) => (
              <button key={item.id} className={`chip ${item.id === phenomenon ? 'active' : ''}`} onClick={() => { setPhenomenon(item.id); if (!item.available) setAnalysisOpen(false); }} aria-pressed={item.id === phenomenon}>
                {item.label}{!item.available && <small>Soon</small>}
              </button>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}
