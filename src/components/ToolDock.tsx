import { useAppStore } from '../store';
import type { ToolMode } from '../types';

const tools: Array<{ id: ToolMode; label: string; symbol: string }> = [
  { id: 'navigate', label: 'Navigate map', symbol: '↗' },
  { id: 'select', label: 'Paint selection', symbol: '+' },
  { id: 'deselect', label: 'Erase selection', symbol: '−' },
];

export function ToolDock() {
  const tool = useAppStore((state) => state.tool);
  const setTool = useAppStore((state) => state.setTool);
  const brushSize = useAppStore((state) => state.brushSize);
  const setBrushSize = useAppStore((state) => state.setBrushSize);
  const startYear = useAppStore((state) => state.startYear);
  const endYear = useAppStore((state) => state.endYear);
  const setStartYear = useAppStore((state) => state.setStartYear);
  const setEndYear = useAppStore((state) => state.setEndYear);
  const seasons = useAppStore((state) => state.seasons);
  const toggleSeason = useAppStore((state) => state.toggleSeason);
  const clearSelection = useAppStore((state) => state.clearSelection);

  return (
    <aside className="tool-dock" aria-label="Map and timeframe controls">
      <div className="tool-group">
        
        <div className="tool-buttons">
          {tools.map((item) => <button key={item.id} className={tool === item.id ? 'active' : ''} onClick={() => setTool(item.id)} aria-label={item.label} title={item.label}>{item.symbol}</button>)}
        </div>
        {tool !== 'navigate' && <label className="brush-control">Brush <output>{brushSize}px</output><input type="range" min="12" max="80" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>}
        <button className="clear-button" onClick={clearSelection}>Clear area</button>
      </div>

      <div className="tool-group timeframe-controls">
        
        <label>Start year<select value={startYear} onChange={(event) => setStartYear(Number(event.target.value))}>{Array.from({ length: 11 }, (_, index) => 2016 + index).map((year) => <option key={year}>{year}</option>)}</select></label>
        <label>End year<select value={endYear} onChange={(event) => setEndYear(Number(event.target.value))}>{Array.from({ length: 11 }, (_, index) => 2016 + index).map((year) => <option key={year}>{year}</option>)}</select></label>
      </div>

      <div className="tool-group season-controls">
        
        {['spring', 'summer', 'autumn', 'winter'].map((season) => (
          <label key={season} className={season !== 'summer' ? 'disabled' : ''} title={season !== 'summer' ? 'Snow cover and freeze–thaw make radar motion unreliable.' : 'Quality-screened snow-free pairs'}>
            <input type="checkbox" disabled={season !== 'summer'} checked={seasons.includes(season)} onChange={() => toggleSeason(season)} />{season}
          </label>
        ))}
        <p>Temperature layers may use any season. Ground motion uses verified snow-free summer dates.</p>
      </div>
    </aside>
  );
}
