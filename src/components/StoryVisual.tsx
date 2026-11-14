import type { StoryChapter } from '../data/story';

const loopStations = ['Human activity', 'Warming', 'Ground moves', 'Wildfire', 'Exposure', 'Cost + health', 'Carbon feedback'];

export function StoryVisual({ chapter }: { chapter: StoryChapter }) {
  if (chapter.visual === 'loop') {
    return <div className="loop-visual">{loopStations.map((station, index) => <div key={station} className="loop-station"><span>{index + 1}</span>{station}</div>)}</div>;
  }
  if (chapter.visual === 'corridor') {
    return <div className="corridor-visual"><div className="north-label">DEADHORSE</div><div className="corridor-road" /><div className="corridor-pipeline" /><div className="study-window">NORTHERN<br />STUDY WINDOW</div><div className="south-label">LIVENGOOD</div></div>;
  }
  if (chapter.visual === 'radar') {
    return <div className="radar-visual"><div className="satellite">NISAR</div><div className="beam beam-a" /><div className="beam beam-b" /><div className="phase phase-a" /><div className="phase phase-b" /><div className="ground-line" /><div className="formula">Δφ = 4π/λ · Δr <small>one fringe ≈ 12 cm LOS change</small></div></div>;
  }
  if (chapter.visual === 'decade') {
    return <div className="chart-visual"><div className="chart-grid" /><svg viewBox="0 0 600 250" role="img" aria-label="Illustrative historical radar time series"><path className="series-main" d="M20 55 C90 68 110 88 165 82 S250 135 310 122 S405 175 470 160 S545 208 580 195" /><path className="series-control" d="M20 115 C95 110 130 128 190 118 S275 138 340 131 S445 150 580 142" /></svg><div className="chart-legend"><span className="dot coral" />Selected corridor <span className="dot cyan" />Control tundra</div></div>;
  }
  if (chapter.visual === 'nisar') {
    return <div className="nisar-visual"><div className="provisional-stamp">PROVISIONAL</div><div className="acquisition-track"><i /><i /><i /><i /><span>27 JUL — 10 AUG<br />PERMANENT GAP</span><i /><i /><i /></div><div className="nisar-note">Snow-free pairs only · 80 m posting · corrections recorded</div></div>;
  }
  if (chapter.visual === 'fire') {
    return <div className="fire-visual"><div className="burn-outline"><span>2007</span></div><div className="fire-metric"><strong>up to 8 cm</strong><span>more seasonal sinking reported</span></div><div className="stabilisation"><strong>&lt;1%</strong><span>additional sinking area by 2021</span></div></div>;
  }
  if (chapter.visual === 'priority') {
    return <div className="priority-visual"><div className="priority-road">{Array.from({ length: 14 }, (_, index) => <i key={index} className={index % 5 === 0 ? 'higher' : index % 3 === 0 ? 'moderate' : 'lower'} />)}</div><div className="priority-labels"><span>LOWER</span><span>MODERATE</span><span>HIGHER</span></div><p>Near observed ground motion; may warrant closer investigation.</p></div>;
  }
  if (chapter.visual === 'context') {
    return <div className="context-visual"><div><strong>~70%</strong><span>infrastructure in high-thaw-potential areas by 2050</span></div><div><strong>$37–51B</strong><span>published mid-century Alaska damage estimate</span></div><div><strong>3–41 GtC</strong><span>per °C by 2100 in IPCC context*</span></div><small>*Published context only; our maps measure ground motion, not carbon.</small></div>;
  }
  return <div className="handoff-visual"><div className="brush-demo"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="handoff-controls"><i>PAINT</i><i>COMPARE</i><i>ASK WHY</i></div></div>;
}
