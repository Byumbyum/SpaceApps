import type { DemoCellProperties, SegmentProperties, TimePoint } from '../types';
import { AnalysisSidebar } from './AnalysisSidebar';
import { MapPanel } from './MapPanel';
import { ToolDock } from './ToolDock';
import { SelectionInsight } from './SelectionInsight';
import { useAppStore } from '../store';

type Feature<P> = { type: 'Feature'; id?: number; properties: P; geometry: unknown };
type Collection<P> = { type: 'FeatureCollection'; features: Array<Feature<P>> };

export function ExploreMode({ cells, segments, series }: { cells: Collection<DemoCellProperties>; segments: Collection<SegmentProperties>; series: TimePoint[] }) {
  const analysisOpen = useAppStore((state) => state.analysisOpen);
  const setAnalysisOpen = useAppStore((state) => state.setAnalysisOpen);
  return (
    <main id="main-content" className="explore-page">
      <MapPanel cells={cells} segments={segments} />
      <ToolDock />
      <SelectionInsight cells={cells.features} />
      <button className={`analysis-toggle ${analysisOpen ? 'open' : ''}`} onClick={() => setAnalysisOpen(!analysisOpen)} aria-expanded={analysisOpen} aria-controls="analysis-drawer"><span>{analysisOpen ? '×' : '≡'}</span>{analysisOpen ? 'Close data' : 'Explore data'}</button>
      <div id="analysis-drawer" className={`analysis-drawer ${analysisOpen ? 'open' : ''}`}>
        <AnalysisSidebar cells={cells.features} segments={segments.features} series={series} />
      </div>
    </main>
  );
}
