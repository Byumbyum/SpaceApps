export interface Phenomenon {
  id: string;
  label: string;
  available: boolean;
}

// Permafrost thaw is the active analysis. The others are registered so the
// interface can grow without layout changes; they show a "coming soon" state.
export const PHENOMENA: Phenomenon[] = [
  { id: 'permafrost', label: 'Permafrost thaw', available: true },
  { id: 'deforestation', label: 'Deforestation', available: false },
  { id: 'desertification', label: 'Desertification', available: false },
  { id: 'wildfire', label: 'Wildfire', available: false },
  { id: 'coastal-erosion', label: 'Coastal erosion', available: false },
  { id: 'flooding', label: 'Flooding', available: false },
  { id: 'sea-level', label: 'Sea-level rise', available: false },
  { id: 'glacier-loss', label: 'Glacier loss', available: false },
];
