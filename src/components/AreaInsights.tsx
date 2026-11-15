import { useMemo, useState } from 'react';
import { formatArea } from '../lib/geo';
import { touchesLand } from '../lib/land';
import { describeChange, summarizeGcov, type GcovSummary } from '../lib/gcov';
import { summarizeGunw, TEMPERATURE_OFFSET_PCT, type GunwSummary } from '../lib/gunw';
import type { ClimateData, GcovData, GunwData, NisarSite, RiskData } from '../types';
import { HOTSPOTS } from '../data/hotspots';
import { PHENOMENA, PHENOMENON_GROUPS } from '../lib/phenomena';
import { areaRisk, demoHotspots, hotspotsInArea, riskLevel, type AreaRisk, type Hotspot } from '../lib/risk';
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

const FACTORS: Array<{ key: 'hazard' | 'exposure' | 'vulnerability'; label: string }> = [
  { key: 'hazard', label: 'Hazard' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'vulnerability', label: 'Vulnerability' },
];

/** Risk index from the permafrost hazard (ESA CCI × ERA5-Land × InSAR) and exposure (WorldCover), per the IPCC factors. */
export function ComputedRiskBlock({ result }: { result: AreaRisk }) {
  const factors: Array<{ label: string; value: number; measured: boolean; good?: boolean }> = [
    { label: 'Hazard', value: result.hazard, measured: true },
    { label: 'Exposure', value: result.exposure, measured: true },
    { label: 'Vulnerability', value: result.vulnerability, measured: false },
  ];
  return (
    <div className="hotspot-block computed-risk">
      <div className="nisar-title"><HotspotIcon /><b>Risk index · computed</b><span className="evidence evidence-observed">OBSERVED</span></div>
      <div className="hero-metric">
        <div>
          <span className="metric-label">Highest risk in this area · {result.cellCount} km²</span>
          <strong>{Math.round(result.peak * 100)}<small> / 100</small></strong>
          <span className="metric-sub">Typical across the area: {Math.round(result.score * 100)} / 100 ({riskLevel(result.score).toLowerCase()})</span>
        </div>
        <LevelPill level={riskLevel(result.peak)} />
      </div>
      <p className="hotspot-why">{result.atRiskShare > 0 ? `${Math.round(result.atRiskShare * 100)}% of this area is at moderate risk or higher, where thawing permafrost meets buildings.` : 'No part of this area reaches moderate risk: either there is little warm, ice-rich permafrost here, or few people and buildings stand on it.'}</p>
      <ul className="factor-bars" aria-label="Risk factors">
        {factors.map((factor) => (
          <li key={factor.label}>
            <span>{factor.label}<em>{factor.measured ? 'measured' : 'estimate'}</em></span>
            <i><b style={{ width: `${factor.value * 100}%` }} className={factor.good ? 'good' : ''} /></i>
          </li>
        ))}
      </ul>
      <ul className="nisar-note risk-bullets">
        <li><b>Hazard</b> = permafrost (ESA CCI) × near thawing (ERA5-Land, 1–3 m) × sinking</li>
        <li><b>Sinking:</b> old trend Sentinel-1 (2016–2025), new trend NISAR (2026 →)</li>
        <li><b>Trend pending:</b> NISAR's 2026 summer stands in, as a ground-ice signal</li>
        <li><b>Exposure:</b> ESA WorldCover built-up land</li>
        <li><b>Vulnerability:</b> estimate (IPCC: susceptibility + coping capacity)</li>
      </ul>
      <p className="hotspot-why">{result.exposure >= 0.35 ? 'Buildings and roads stand on this ground: uneven settling can crack foundations, roads and pipes.' : 'Few buildings here: watch roads, pipelines and future building plans.'}</p>
      <p className="screening-note">Prescient is the first line of defence: it shows where the ground is turning risky. Governments, NGOs and communities can then investigate what it means for each part of daily life there: homes, roads, water, health and livelihoods.</p>
    </div>
  );
}

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
            <i><b style={{ width: `${spot[key] * 100}%` }} /></i>
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

// Stefan solution: thaw depth Z = E·√ADDT, where the edaphic factor E depends on soil
// moisture and conductivity; 0.02–0.035 m/√(°C·day) spans typical mineral soils.

/**
 * Independent measurements side by side. Agreement is the evidence the number is real;
 * a disagreement comes with its most likely physical cause, shown on hover or tap.
 */
function CrossChecks({ summary }: { summary: GunwSummary }) {
  const { orbit, temperature } = summary.crossChecks;
  if (!orbit && !temperature) return null;
  const items: Array<{ agree: boolean; label: string; detail: string }> = [];
  if (orbit) {
    items.push(orbit.agree
      ? { agree: true, label: `Two orbits agree (${signed(summary.losCm)} and ${signed(orbit.cm)} cm)`, detail: `The ${summary.direction} and ${orbit.direction} passes see the ground from different sides and still measure the same movement, so it is mostly vertical and not an artefact of one pass.` }
      : { agree: false, label: `Two orbits differ by ${Math.abs(orbit.differenceCm).toFixed(1)} cm`, detail: `Likely cause: the ${summary.direction} and ${orbit.direction} passes look at the ground from opposite sides. On slopes, sideways (downslope) creep moves toward one satellite and away from the other, so a difference here is itself a sign of slope movement. On flat ground it more often means one pass caught atmospheric delay or wet snow; the record that agrees with the thaw model is the one to trust.` });
  }
  if (temperature) {
    const offset = Math.abs(temperature.differencePct) > TEMPERATURE_OFFSET_PCT
      ? ` ERA5-Land totals ${Math.abs(Math.round(temperature.differencePct))}% ${temperature.differencePct > 0 ? 'more' : 'less'} thaw (${Math.round(temperature.era5).toLocaleString()} vs ${Math.round(temperature.power).toLocaleString()} °C·days): its ~9 km cell follows the local valley or slope, while NASA POWER’s ~50 km cell averages in the surrounding terrain. A constant offset like this does not change the thaw fit.`
      : ` Both total about ${Math.round((temperature.power + temperature.era5) / 2).toLocaleString()} °C·days.`;
    items.push(temperature.agree
      ? { agree: true, label: 'NASA POWER and ERA5-Land agree on the thaw timing', detail: `Two independent climate reanalyses rise through the season together, so the Stefan thaw model rests on a reliable temperature record.${offset}` }
      : { agree: false, label: 'Temperature sources differ in thaw timing', detail: `Likely cause: a short cold or warm spell resolved by ERA5-Land’s ~9 km cell but smoothed out by NASA POWER’s ~50 km cell, common in mountain valleys. ERA5-Land is closer to local conditions.${offset}` });
  }
  const agreeing = items.filter((item) => item.agree).length;
  return (
    <details className="cross-checks">
      <summary>
        <i className={agreeing === items.length ? 'agree' : 'differ'} aria-hidden="true">{agreeing === items.length ? '✓' : '!'}</i>
        <span>Cross-checks · {agreeing} of {items.length} independent measurements agree</span>
        <ChevronIcon />
      </summary>
      <ul>
        {items.map((item) => (
          <li key={item.label} className={item.agree ? 'agree' : 'differ'}>
            <i aria-hidden="true">{item.agree ? '✓' : '!'}</i>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
      {summary.thaw && (
        <div className="thaw-fit">
          <b>Thaw model (Stefan)</b>
          <span>The ground sinks in step with the thaw: movement follows √(degree days of thaw), the shape the Stefan model predicts{summary.thaw.r2 ? ` (fit r² ${summary.thaw.r2.toFixed(2)})` : ''}.</span>
          <span>Measured seasonal thaw movement: {signed(summary.thaw.seasonalCm)} cm relative to the surroundings. This is the normal yearly thaw cycle; its size hints at how much ice the ground holds.</span>
          <span className="thaw-sources">Degree days of thaw: NASA POWER{summary.thawEra5 ? ' and ERA5-Land' : ''} air temperature. Only the shape of the fit is used, to tell thaw from other movement.</span>
        </div>
      )}
      <CrossChecks summary={summary} />
      <p className="nisar-note">Relative to the surrounding area’s median, from {summary.cellCount} km² on track {summary.track} ({summary.direction}). Ionosphere corrected; troposphere not yet. Early provisional data, so treat small values (under ~1 cm) as noise.</p>
    </div>
  );
}

const dayMonth = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** This summer's thaw against the 2016–2025 normal, from ERA5-Land. */
export function ClimateBlock({ climate }: { climate: ClimateData }) {
  const now = climate.current;
  if (!now) return null;
  const pct = now.addtVsNormalPct;
  const onset = now.thawOnsetVsNormalDays;
  return (
    <div className="climate-block">
      <div className="nisar-title"><b>This summer’s thaw · ERA5-Land</b><span className="evidence evidence-observed">OBSERVED</span></div>
      <div className="stat-row compact">
        <div><strong>{now.addt.toLocaleString()}</strong><span>Degree days of thaw</span></div>
        <div><strong>{pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</strong><span>vs {climate.normal.years?.join('–')}</span></div>
        <div><strong>{now.thawOnset ? dayMonth(now.thawOnset) : '—'}</strong><span>Topsoil thawed{onset === null ? '' : onset === 0 ? ' (usual)' : ` (${Math.abs(onset)} d ${onset < 0 ? 'early' : 'late'})`}</span></div>
      </div>
      {now.deepSoilC !== null && (
        <p className="nisar-note">Ground at 1–3 m averaged {now.deepSoilC.toFixed(1)} °C this year{climate.deepSoilTrendPerDecade !== null ? `, warming ${climate.deepSoilTrendPerDecade > 0 ? '+' : ''}${climate.deepSoilTrendPerDecade.toFixed(2)} °C per decade since ${climate.years[0]?.year}` : ''}{now.deepSoilC <= 0.5 && now.deepSoilC >= -1 ? ': near 0 °C, where permafrost is most fragile.' : '.'}</p>
      )}
      {now.deepSoilC !== null && now.deepSoilC <= -3 && <p className="nisar-note">This ~9 km ERA5-Land grid cell is probably mostly glacier ice, so its ground temperature does not represent the land around it.</p>}
      <p className="nisar-note">ERA5-Land averages over a ~9 km cell; in mountains that mixes valleys, slopes and glaciers, so treat these as indicative.</p>
    </div>
  );
}

export function AreaInsights({ gcov = null, gunw = null, climate = null, risk = null, sites = [] }: { gcov?: GcovData | null; gunw?: GunwData | null; climate?: ClimateData | null; risk?: RiskData | null; sites?: NisarSite[] }) {
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
  // Demo hotspots only where no computed risk covers the site.
  const hotspots = useMemo(() => (area ? hotspotsInArea(demoHotspots(HOTSPOTS, sites), area.ring, area.center) : []), [area, sites]);
  const computedRisk = useMemo(() => (area && risk ? areaRisk(risk, area.ring, area.center) : null), [area, risk]);

  if (!area || !insight) return null;
  const active = PHENOMENA.find((item) => item.id === phenomenon) ?? PHENOMENA[0];
  // Mountain permafrost sits outside the coarse latitude model, so mapped hotspots and NISAR sites count too.
  const hasPermafrost = insight.hasPermafrost || hotspots.length > 0 || nisar !== null || computedRisk !== null;

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
            <p>Not part of this NASA Space Apps demo.</p>
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
            {computedRisk && <ComputedRiskBlock result={computedRisk} />}
            {hotspots.length > 0 && <HotspotBlock items={hotspots} />}
            {nisar && gcov && <NisarBlock summary={nisar} gcov={gcov} />}
            {climate && <ClimateBlock climate={climate} />}
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
              {climate?.current?.deepSoilC != null
                ? <div><strong>{climate.current.deepSoilC.toFixed(1)}°C</strong><span>Ground temp. 1–3 m</span></div>
                : <div><strong>{insight.groundTempC}°C</strong><span>Ground temp.</span></div>}
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
                      {item.label}
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
