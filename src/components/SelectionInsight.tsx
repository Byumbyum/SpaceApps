import { useMemo } from 'react';
import { useAppStore } from '../store';
import type { DemoCellProperties } from '../types';
import { EvidenceTag } from './EvidenceTag';

type CellFeature = { properties: DemoCellProperties };

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function SelectionInsight({ cells }: { cells: CellFeature[] }) {
  const selectedIds = useAppStore((state) => state.selectedCellIds);
  const setAnalysisOpen = useAppStore((state) => state.setAnalysisOpen);
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return cells.filter(({ properties }) => ids.has(properties.id));
  }, [cells, selectedIds]);

  if (!selected.length) return null;
  const valid = selected.filter(({ properties }) => !properties.excluded);
  const excluded = selected.length - valid.length;
  const motion = median(valid.map(({ properties }) => properties.motion_cm_yr));
  const q = median(valid.map(({ properties }) => properties.q));
  const e = median(valid.map(({ properties }) => properties.e));
  const areaKm2 = selected.length * 0.01;
  const strongerMotion = valid.filter(({ properties }) => properties.motion_cm_yr <= -1.5).length;
  const qualityLabel = q >= .75 ? 'high' : q >= .5 ? 'medium' : 'low';

  return (
    <section className="selection-insight" aria-live="polite">
      <div className="insight-topline"><span>SELECTED AREA · {areaKm2.toFixed(2)} KM²</span><EvidenceTag kind="INFERRED" /></div>
      <div className="insight-headline">
        <div><strong>{motion.toFixed(2)}</strong><span>cm/yr median relative motion</span></div>
        <p>{valid.length ? `${strongerMotion} of ${valid.length} valid cells show stronger sinking-like motion. Measurement quality is ${qualityLabel}. This is a monitoring signal, not a safety diagnosis.` : 'No valid radar cells remain after quality exclusions in this selection.'}</p>
      </div>
      <div className="impact-summaries">
        <div><span className="impact-icon safety">S</span><p><b>Safety</b>Prioritize field inspection where quality-screened motion overlaps mapped roads or pipelines.</p></div>
        <div><span className="impact-icon health">H</span><p><b>Health</b>Radar cannot diagnose health effects; it can identify ground-change locations for contextual follow-up.</p></div>
        <div><span className="impact-icon economy">E</span><p><b>Economy</b>Exposure is mapped, but repair cost or failure probability is not calculated from these pixels.</p></div>
      </div>
      <div className="insight-footer"><span>Q {q.toFixed(2)} · E {e.toFixed(2)} · {excluded} excluded</span><button onClick={() => setAnalysisOpen(true)}>View datasets and evidence →</button></div>
    </section>
  );
}
