import { useMemo, useState } from 'react';
import { formatArea } from '../lib/geo';
import { touchesLand } from '../lib/land';
import { describeChange, summarizeGcov, type GcovSummary } from '../lib/gcov';
import { summarizeGunw, type GunwSummary } from '../lib/gunw';
import type { GcovData, GunwData } from '../types';
import { HOTSPOTS } from '../data/hotspots';
import { PHENOMENA, PHENOMENON_GROUPS } from '../lib/phenomena';
import { hotspotsInArea, riskLevel, type Hotspot } from '../lib/risk';
import { placeholderPermafrost, type ImpactInsight, type Level } from '../lib/placeholderInsights';
import { useAppStore } from '../store';
import { ArrowRightIcon, ChevronIcon, CloseIcon, CoinIcon, HeartIcon, HotspotIcon, SatelliteIcon, ShieldIcon } from './Icons';

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

const FACTORS: Array<{ key: 'hazard' | 'exposure' | 'vulnerability' | 'capacity'; label: string }> = [
  { key: 'hazard', label: 'Hazard' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'vulnerability', label: 'Vulnerability' },
  { key: 'capacity', label: 'Capacity' },
];

export function HotspotBlock({ items }: { items: Array<{ spot: Hotspot; score: number }> }) {
  const [{ spot, score }, ...others] = items;
  return (
    <div className="hotspot-block">
      <div className="nisar-title"><HotspotIcon /><b>Risk hotspot</b><span className="sample-tag">Estimate</span></div>
      <div className="hero-metric">
        <div>
          <span className="metric-label">{spot.name}</span>
          <strong>{Math.round(score * 100)}<small> / 100 risk</small></strong>
        </div>
        <LevelPill level={riskLevel(score)} />
      </div>
      <p className="hotspot-why">{spot.hazards}</p>
      <ul className="factor-bars" aria-label="Risk factors">
        {FACTORS.map(({ key, label }) => (
          <li key={key}>
            <span>{label}</span>
            <i><b style={{ width: `${spot[key] * 100}%` }} className={key === 'capacity' ? 'good' : ''} /></i>
          </li>
        ))}
      </ul>
      <ul className="hotspot-threats">
        <li><ShieldIcon /><span>{spot.safety}</span></li>
        <li><HeartIcon /><span>{spot.health}</span></li>
        <li><CoinIcon /><span>{spot.economy}</span></li>
      </ul>
      {others.length > 0 && <p className="nisar-note">Also in this area: {others.map(({ spot: other, score: value }) => `${other.name} (${riskLevel(value).toLowerCase()})`).join(', ')}.</p>}
    </div>
  );
}

const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`;

/** Real ground movement from NISAR GUNW, replacing the sample "ground sinking" value. */
export function GroundMotionBlock({ summary }: { summary: GunwSummary }) {
  const away = summary.losCm < 0;
  return (
    <div className="ground-motion">
      <div className="nisar-title"><SatelliteIcon /><b>Ground movement · NISAR</b><span className="evidence evidence-observed">OBSERVED</span><span className="provisional-chip">Provisional</span></div>
      <div className="hero-metric">
        <div>
          <span className="metric-label">{day(summary.first)} – {day(summary.last)}</span>
          <strong>{signed(summary.losCm)}<small> cm</small></strong>
          <span className="metric-sub">{Math.abs(summary.losCm) < 0.3 ? 'About stable along the radar’s line of sight' : away ? `Moved away from the satellite: about ${Math.abs(summary.verticalCm).toFixed(1)} cm of sinking if the motion is vertical` : `Moved toward the satellite: about ${Math.abs(summary.verticalCm).toFixed(1)} cm of heave if the motion is vertical`}</span>
        </div>
      </div>
      <p className="nisar-note">Relative to the surrounding area’s median, from {summary.cellCount} km² on track {summary.track} ({summary.direction}). Ionosphere corrected; troposphere not yet.</p>
    </div>
  );
}

export function AreaInsights({ gcov = null, gunw = null }: { gcov?: GcovData | null; gunw?: GunwData | null }) {
  const area = useAppStore((state) => state.selectedArea);
  const setSelectedArea = useAppStore((state) => state.setSelectedArea);
  const setAnalysisOpen = useAppStore((state) => state.setAnalysisOpen);
  const phenomenon = useAppStore((state) => state.phenomenon);
  const setPhenomenon = useAppStore((state) => state.setPhenomenon);
  const [othersOpen, setOthersOpen] = useState(false);
  const insight = useMemo(() => (area ? placeholderPermafrost(area.center) : null), [area]);
  const nisar = useMemo(() => (area && gcov ? summarizeGcov(gcov, area.ring, area.center) : null), [area, gcov]);
  const motion = useMemo(() => (area && gunw ? summarizeGunw(gunw, area.ring, area.center) : null), [area, gunw]);
  // Ground data only exists on land; open water gets no values at all.
  const onLand = useMemo(() => (area ? touchesLand(area.center, area.ring) : true), [area]);
  const hotspots = useMemo(() => (area ? hotspotsInArea(HOTSPOTS, area.ring, area.center) : []), [area]);

  if (!area || !insight) return null;
  const active = PHENOMENA.find((item) => item.id === phenomenon) ?? PHENOMENA[0];
  // Mountain permafrost sits outside the coarse latitude model, so mapped hotspots and NISAR sites count too.
  const hasPermafrost = insight.hasPermafrost || hotspots.length > 0 || nisar !== null;

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
        ) : !onLand ? (
          <div className="panel-coming-soon">
            <h3>Open water</h3>
            <p>No ground data here: ground sinking and permafrost are measured on land only. Select an area on land to see insights.</p>
          </div>
        ) : !hasPermafrost ? (
          <div className="panel-coming-soon">
            <h3>Little or no permafrost here</h3>
            <p>This area is outside the main permafrost zones. Try somewhere in the Arctic, like northern Alaska or Siberia.</p>
          </div>
        ) : (
          <>
            {hotspots.length > 0 && <HotspotBlock items={hotspots} />}
            {nisar && gcov && <NisarBlock summary={nisar} gcov={gcov} />}
            {motion ? <GroundMotionBlock summary={motion} /> : (
              <div className="hero-metric">
                <div>
                  <span className="metric-label">Ground sinking <span className="sample-tag">Sample</span></span>
                  <strong>{insight.subsidenceCmYr.toFixed(1)}<small> cm/yr</small></strong>
                </div>
                <LevelPill level={insight.level} />
              </div>
            )}
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
        {active.available && onLand && hasPermafrost && <p className="sample-note">{motion ? 'Ground movement and radar brightness are real NISAR measurements (GUNW and GCOV). Values tagged Sample are still placeholders.' : nisar ? 'The NISAR block above is real radar brightness (GCOV). Ground movement (GUNW) is not processed for this spot yet, so values tagged Sample are placeholders.' : 'Sample values for layout only. Real NISAR data covers the sites outlined on the map.'}</p>}
      </div>

      <footer className="phenomena">
        <button className="phenomena-toggle" onClick={() => setOthersOpen(!othersOpen)} aria-expanded={othersOpen}>
          <span>Climate phenomenon<b>{active.label}</b></span>
          <ChevronIcon style={{ transform: othersOpen ? 'rotate(180deg)' : undefined }} />
        </button>
        {othersOpen && (
          <div className="phenomena-groups">
            {PHENOMENON_GROUPS.map((group) => (
              <section key={group.id} className="phenomena-group">
                <h4>{group.label}<small>{group.hint}</small></h4>
                <div className="phenomena-grid">
                  {PHENOMENA.filter((item) => item.group === group.id).map((item) => (
                    <button key={item.id} className={`chip ${item.id === phenomenon ? 'active' : ''}`} onClick={() => { setPhenomenon(item.id); if (!item.available) setAnalysisOpen(false); }} aria-pressed={item.id === phenomenon}>
                      {item.label}{!item.available && <small>Soon</small>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}
