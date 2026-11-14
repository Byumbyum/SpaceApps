import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimePoint } from '../types';
import { EvidenceTag } from './EvidenceTag';

export function TimeSeriesPanel({ series, startYear, endYear }: { series: TimePoint[]; startYear: number; endYear: number }) {
  const data = series
    .filter((point) => point.year >= startYear && point.year <= endYear + 1)
    .map((point) => ({
      ...point,
      range: point.lower === null || point.upper === null ? null : [point.lower, point.upper],
      sentinel: point.source === 'Sentinel-1' ? point.observed : null,
      nisar: point.source === 'NISAR' ? point.observed : null,
    }));
  return (
    <section className="analysis-card chart-card">
      <div className="card-heading"><div><span className="panel-kicker">SELECTED AREA · MEDIAN</span><h3>Relative ground motion</h3></div><EvidenceTag kind="OBSERVED" /></div>
      <div className="quality-badges"><span>Measurement Q: <b>medium</b></span><span>Thaw interpretation E: <b>medium</b></span></div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 6, left: -18 }}>
            <CartesianGrid stroke="#294044" strokeDasharray="2 4" />
            <XAxis dataKey="year" type="number" domain={[startYear, endYear + 0.8]} tick={{ fill: '#91a3a4', fontSize: 11 }} tickFormatter={(value) => String(Math.floor(value))} />
            <YAxis tick={{ fill: '#91a3a4', fontSize: 11 }} unit=" cm" />
            <Tooltip contentStyle={{ background: '#10282c', border: '1px solid #315158', color: '#e9f0eb' }} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
            <ReferenceArea x1={2026.57} x2={2026.61} fill="#d95f4f" fillOpacity={0.18} label={{ value: 'DATA GAP', fill: '#ff9b87', fontSize: 10 }} />
            <Area dataKey="range" stroke="none" fill="#e6aa72" fillOpacity={0.14} connectNulls={false} />
            <Line dataKey="control" stroke="#65bcc8" strokeWidth={2} dot={false} name="Control tundra" connectNulls={false} />
            <Line dataKey="sentinel" stroke="#e7b171" strokeWidth={2.5} dot={{ r: 3 }} name="Sentinel-1 median" connectNulls={false} />
            <Line dataKey="nisar" stroke="#ff7058" strokeWidth={3} dot={{ r: 4 }} name="NISAR PROVISIONAL" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-notes"><span><i className="dot coral" /> selected median</span><span><i className="dot cyan" /> control tundra</span><span className="provisional-label">NISAR 2026 PROVISIONAL</span></div>
      <p className="microcopy">Error band shows synthetic measurement uncertainty. NISAR’s 27 Jul–10 Aug 2026 permanent gap is shaded.</p>
    </section>
  );
}
