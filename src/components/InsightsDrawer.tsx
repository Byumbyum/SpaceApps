import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { describeChange, summarizeGcov } from '../lib/gcov';
import { formatArea, formatCoordinate } from '../lib/geo';
import { placeholderPermafrost } from '../lib/placeholderInsights';
import { useAppStore } from '../store';
import type { GcovData, TimePoint } from '../types';
import { LandcoverList, LevelPill } from './AreaInsights';
import { CloseIcon, CoinIcon, HeartIcon, SatelliteIcon, ShieldIcon, SnowIcon } from './Icons';
import { TimeSeriesPanel } from './TimeSeriesPanel';

const sections = [
  { key: 'safety', label: 'Safety', Icon: ShieldIcon },
  { key: 'health', label: 'Health', Icon: HeartIcon },
  { key: 'economy', label: 'Economy', Icon: CoinIcon },
] as const;

const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`);
const shortDate = (value: number) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function InsightsDrawer({ series, gcov = null }: { series: TimePoint[]; gcov?: GcovData | null }) {
  const open = useAppStore((state) => state.analysisOpen);
  const setOpen = useAppStore((state) => state.setAnalysisOpen);
  const area = useAppStore((state) => state.selectedArea);
  const demoCellCount = useAppStore((state) => state.selectedCellIds.length);
  const insight = useMemo(() => (area ? placeholderPermafrost(area.center) : null), [area]);
  const nisar = useMemo(() => (area && gcov ? summarizeGcov(gcov, area.ring, area.center) : null), [area, gcov]);

  return (
    <aside className={`insights-drawer ${open && area ? 'open' : ''}`} aria-label="Detailed insights" aria-hidden={!open || !area}>
      {area && insight && (
        <>
          <header className="drawer-header">
            <div>
              <h2>Detailed insights</h2>
              <p>{area.name} · {formatArea(area.areaKm2)}</p>
            </div>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close detailed insights"><CloseIcon /></button>
          </header>
          <div className="drawer-body">
            {nisar && gcov && (
              <section className="drawer-card">
                <div className="drawer-card-title"><span className="impact-icon impact-permafrost"><SatelliteIcon /></span><h3>NISAR radar observations</h3><span className="provisional-chip">Provisional</span></div>
                <p className="card-caption">Radar brightness at each pass, relative to the average for that viewing angle (dB). No acquisitions fall in the 27 Jul–10 Aug gap.</p>
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={190}>
                    <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                      <CartesianGrid stroke="#eceff1" vertical={false} />
                      <XAxis dataKey="t" type="number" domain={['dataMin - 86400000', 'dataMax + 86400000']} tickFormatter={shortDate} tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dadce0' }} />
                      <YAxis dataKey="anomalyDb" type="number" tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ReferenceArea x1={dayOf(gcov.gap[0])} x2={dayOf(gcov.gap[1])} fill="#d93025" fillOpacity={0.08} />
                      <ReferenceLine y={0} stroke="#dadce0" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dadce0', fontSize: 12 }} formatter={(value, name) => (name === 'anomalyDb' ? [`${value} dB`, 'Brightness'] : [shortDate(Number(value)), 'Date'])} />
                      <Scatter data={nisar.series.map((point) => ({ ...point, t: dayOf(point.date) }))} fill="#1a73e8" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <dl className="metric-list">
                  <div><dt>Summer brightness change</dt><dd>{nisar.changeDb === null ? '—' : `${nisar.changeDb > 0 ? '+' : ''}${nisar.changeDb.toFixed(2)} dB`}</dd></div>
                  <div><dt>Likely open water, early → late</dt><dd>{nisar.waterEarlyPct === null ? '—' : `${nisar.waterEarlyPct.toFixed(1)}% → ${(nisar.waterLatePct ?? 0).toFixed(1)}%`}</dd></div>
                  <div><dt>Passes · viewing angles</dt><dd>{nisar.passCount} · {nisar.trackCount}</dd></div>
                  <div><dt>Dates</dt><dd>{nisar.firstDate} → {nisar.lastDate}</dd></div>
                  <div><dt>Area analysed</dt><dd>{nisar.cellCount} × 1 km² cells</dd></div>
                </dl>
                {nisar.landcover.length > 0 && (
                  <>
                    <h4 className="card-subtitle">Change by land cover <small>share · change</small></h4>
                    <LandcoverList items={nisar.landcover} />
                    <p className="card-caption">If every land type shifts by a similar amount, a regional cause such as rain is likely. A change confined to one type (for example only wetland or only built-up ground) is more worth investigating. Permanent water is excluded.</p>
                  </>
                )}
                <p className="card-caption">{describeChange(nisar.changeDb)}. Rain, vegetation growth and surface roughness also change brightness, so this flags places to check, not confirmed thaw. Ground sinking needs NISAR GUNW data.</p>
              </section>
            )}
            <div className="sample-banner">{nisar ? 'The cards below use sample values until ground-motion and exposure data are processed.' : 'Sample data. These numbers are placeholders until NISAR and OPERA products are processed for this area.'}</div>

            <section className="drawer-card">
              <div className="drawer-card-title"><span className="impact-icon impact-permafrost"><SnowIcon /></span><h3>Permafrost thaw</h3><LevelPill level={insight.level} /></div>
              <p className="card-caption">Cumulative ground sinking since 2016 (cm)</p>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={insight.trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#1a73e8" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eceff1" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dadce0' }} />
                    <YAxis tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dadce0', fontSize: 12 }} formatter={(value) => [`${value} cm`, 'Sinking']} />
                    <Area type="monotone" dataKey="value" stroke="#1a73e8" strokeWidth={2} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <dl className="metric-list">
                <div><dt>Ground sinking rate</dt><dd>{insight.subsidenceCmYr.toFixed(2)} cm/yr</dd></div>
                <div><dt>Permafrost cover</dt><dd>{insight.extentPct}%</dd></div>
                <div><dt>Thaw depth change</dt><dd>+{insight.activeLayerChangeCm} cm / decade</dd></div>
                <div><dt>Mean ground temperature</dt><dd>{insight.groundTempC}°C</dd></div>
              </dl>
            </section>

            {sections.map(({ key, label, Icon }) => (
              <section className="drawer-card" key={key}>
                <div className="drawer-card-title"><span className={`impact-icon impact-${key}`}><Icon /></span><h3>{label}</h3><LevelPill level={insight[key].level} /></div>
                <p className="card-caption">{insight[key].detail}</p>
                <dl className="metric-list">
                  {insight[key].metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
                </dl>
              </section>
            ))}

            {demoCellCount > 0 && <TimeSeriesPanel series={series} startYear={2016} endYear={2026} />}

            <section className="drawer-card muted">
              <h3>About this area</h3>
              <dl className="metric-list">
                <div><dt>Centre</dt><dd>{formatCoordinate(area.center)}</dd></div>
                <div><dt>Size</dt><dd>{formatArea(area.areaKm2)}</dd></div>
                <div><dt>Planned sources</dt><dd>NISAR, Sentinel-1 / OPERA, ERA5-Land</dd></div>
              </dl>
            </section>
          </div>
        </>
      )}
    </aside>
  );
}
