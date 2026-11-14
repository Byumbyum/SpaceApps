import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatArea, formatCoordinate } from '../lib/geo';
import { placeholderPermafrost } from '../lib/placeholderInsights';
import { useAppStore } from '../store';
import type { TimePoint } from '../types';
import { LevelPill } from './AreaInsights';
import { CloseIcon, CoinIcon, HeartIcon, ShieldIcon, SnowIcon } from './Icons';
import { TimeSeriesPanel } from './TimeSeriesPanel';

const sections = [
  { key: 'safety', label: 'Safety', Icon: ShieldIcon },
  { key: 'health', label: 'Health', Icon: HeartIcon },
  { key: 'economy', label: 'Economy', Icon: CoinIcon },
] as const;

export function InsightsDrawer({ series }: { series: TimePoint[] }) {
  const open = useAppStore((state) => state.analysisOpen);
  const setOpen = useAppStore((state) => state.setAnalysisOpen);
  const area = useAppStore((state) => state.selectedArea);
  const demoCellCount = useAppStore((state) => state.selectedCellIds.length);
  const insight = useMemo(() => (area ? placeholderPermafrost(area.center) : null), [area]);

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
            <div className="sample-banner">Sample data. These numbers are placeholders until NISAR and OPERA products are processed.</div>

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
