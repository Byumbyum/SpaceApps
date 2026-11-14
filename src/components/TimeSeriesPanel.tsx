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
    <section className="drawer-card analysis-card chart-card">
      <div className="drawer-card-title"><h3>Relative ground motion</h3><EvidenceTag kind="OBSERVED" /></div>
      <p className="card-caption">Northern Dalton demo series (synthetic). NISAR summer 2026 is provisional; the 27 Jul–10 Aug 2026 gap is shaded.</p>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#eceff1" vertical={false} />
            <XAxis dataKey="year" type="number" domain={[startYear, endYear + 0.8]} tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#dadce0' }} tickFormatter={(value) => String(Math.floor(value))} />
            <YAxis tick={{ fill: '#5f6368', fontSize: 11 }} tickLine={false} axisLine={false} unit=" cm" />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dadce0', fontSize: 12 }} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
            <ReferenceArea x1={2026.57} x2={2026.61} fill="#d93025" fillOpacity={0.12} label={{ value: 'Data gap', fill: '#d93025', fontSize: 10 }} />
            <Area dataKey="range" stroke="none" fill="#fbbc04" fillOpacity={0.15} connectNulls={false} />
            <Line dataKey="control" stroke="#9aa0a6" strokeWidth={1.5} dot={false} name="Control tundra" connectNulls={false} />
            <Line dataKey="sentinel" stroke="#1a73e8" strokeWidth={2} dot={{ r: 2.5 }} name="Sentinel-1 median" connectNulls={false} />
            <Line dataKey="nisar" stroke="#d93025" strokeWidth={2.5} dot={{ r: 3 }} name="NISAR (provisional)" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-notes"><span><i className="dot blue" /> Sentinel-1</span><span><i className="dot red" /> NISAR provisional</span><span><i className="dot grey" /> Control tundra</span></div>
    </section>
  );
}
