export interface AnalysisModuleDefinition {
  id: string;
  label: string;
  requiredLayers: string[];
  enabled: boolean;
  status?: string;
}

// UI and compute implementations are intentionally decoupled from this registry.
// A new module declares its data dependencies here, then supplies compute/render
// adapters without changing the map or selection model.
export const analysisModules: AnalysisModuleDefinition[] = [
  { id: 'groundMotionSeries', label: 'Ground-motion series', requiredLayers: ['time_series', 'selection'], enabled: true },
  { id: 'heatmap', label: 'Geographic heatmap', requiredLayers: ['cells'], enabled: true },
  { id: 'exposureList', label: 'Infrastructure exposure', requiredLayers: ['segments', 'measurement_q'], enabled: true },
  { id: 'indexSummary', label: 'Index summary', requiredLayers: ['measurement_q', 'interpretation_e'], enabled: true },
  { id: 'whyPanel', label: 'Why?', requiredLayers: ['scoring_config', 'cells'], enabled: true },
  { id: 'longTermContext', label: 'Long-term context', requiredLayers: [], enabled: true },
  { id: 'gcovWetting', label: 'NISAR GCOV wetting indicator', requiredLayers: ['gcov'], enabled: false, status: 'Planned' },
  { id: 'coherenceComparison', label: 'L-band vs C-band coherence', requiredLayers: ['nisar', 'sentinel_1'], enabled: false, status: 'Planned' },
  { id: 'debrisLobes', label: 'Frozen debris lobes', requiredLayers: ['arctic_dem'], enabled: false, status: 'Planned' },
  { id: 'healthContext', label: 'Health and contamination context', requiredLayers: ['facilities'], enabled: false, status: 'Planned' },
  { id: 'abruptThaw', label: 'Abrupt-thaw indicator', requiredLayers: ['dem', 'optical'], enabled: false, status: 'Planned' },
];
