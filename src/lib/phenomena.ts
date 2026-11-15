export interface Phenomenon {
  id: string;
  label: string;
  available: boolean;
  /** predict: slow-onset hazards NISAR trends can project months to years ahead.
   *  measure: what radar and other satellites observe now, and what it tells us. */
  group: 'predict' | 'measure';
}

export const PHENOMENON_GROUPS: Array<{ id: Phenomenon['group']; label: string; hint: string }> = [
  { id: 'predict', label: 'What we can predict', hint: 'Slow-onset risks, months to years ahead' },
  { id: 'measure', label: 'What we can measure', hint: 'Observed change and the insights it gives' },
];

// Permafrost thaw is the active analysis. The others are registered so the
// interface can grow without layout changes; they show a "coming soon" state.
export const PHENOMENA: Phenomenon[] = [
  { id: 'permafrost', label: 'Local communities directly affected by permafrost thaw', available: true, group: 'predict' },
  { id: 'thaw-cascades', label: 'Floods, landslides & avalanches downstream of thawing slopes', available: false, group: 'predict' },
  { id: 'landslides', label: 'Slow landslides & slope creep', available: false, group: 'predict' },
  { id: 'coastal-erosion', label: 'Coastal erosion & subsidence', available: false, group: 'predict' },
  { id: 'land-sinking', label: 'Land sinking from groundwater pumping', available: false, group: 'predict' },
  { id: 'flooding', label: 'Flood-prone areas', available: false, group: 'predict' },
  { id: 'deforestation', label: 'Forest loss trends', available: false, group: 'predict' },
  { id: 'desertification', label: 'Desertification', available: false, group: 'measure' },
  { id: 'wildfire', label: 'Wildfire', available: false, group: 'measure' },
  { id: 'sea-level', label: 'Sea-level rise', available: false, group: 'measure' },
  { id: 'glacier-loss', label: 'Glacier loss', available: false, group: 'measure' },
];
