export type EvidenceKind = 'OBSERVED' | 'INFERRED' | 'PUBLISHED';
export type IndexKey = 'Q' | 'E';
export type IndexBand = 'high' | 'medium' | 'low' | 'not-assessed';
export type ToolMode = 'navigate' | 'select' | 'deselect';
export type AppMode = 'story' | 'explore' | 'tutorial' | 'about';

export interface FactorConfig {
  id: string;
  label: string;
  source_dataset: string;
  transform: 'identity' | 'linear_rescale' | 'exp_decay' | 'one_minus_exp' | 'inverse' | 'boolean';
  params: Record<string, number>;
  weight: number;
  index: IndexKey;
  explanation: string;
}

export interface ScoringConfig {
  version: string;
  epsilon: number;
  bands: { high: number; medium: number };
  hard_exclusions: Array<{ id: string; label: string }>;
  factors: FactorConfig[];
  monitoring_priority: {
    higher_z: number;
    moderate_z: number;
    minimum_q: number;
    reference_ring_m: [number, number];
  };
}

export interface RawFactorValues {
  [factorId: string]: number | string | boolean | null | undefined;
}

export interface FactorResult {
  id: string;
  label: string;
  raw: number | null;
  normalized: number | null;
  weight: number;
  effectiveWeight: number;
  explanation: string;
  available: boolean;
}

export interface IndexResult {
  value: number | null;
  band: IndexBand;
  factors: FactorResult[];
  limitedBy: FactorResult | null;
  missing: string[];
}

export interface DemoCellProperties extends RawFactorValues {
  id: string;
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  motion_cm_yr: number;
  motion_uncertainty_cm: number;
  q: number;
  e: number;
  q_band: IndexBand;
  e_band: IndexBand;
  excluded: boolean;
  exclusion_reason: string | null;
  area_name: string;
  provisional: boolean;
}

export interface DemoManifest {
  dataset_mode: 'demo';
  generated_at: string;
  processing_version: string;
  grid: { crs: string; cell_size_m: number; mvp_bbox: [number, number, number, number] };
  reference: { name: string; latitude: number; longitude: number; date: string; stability: string };
  nisar_status: { maturity: 'PROVISIONAL'; thaw_season: string; gap: [string, string]; posting_m: number };
  layers: Array<{ id: string; label: string; source: string; evidence: EvidenceKind; status: string }>;
  limitations: string[];
}

export interface TimePoint {
  date: string;
  year: number;
  observed: number | null;
  control: number | null;
  lower: number | null;
  upper: number | null;
  source: 'Sentinel-1' | 'NISAR';
  provisional: boolean;
  gap?: boolean;
}

export interface SegmentProperties {
  id: string;
  name: string;
  asset: 'highway' | 'pipeline';
  motion_cm_yr: number;
  uncertainty_cm: number;
  z: number;
  median_q: number;
  priority: 'higher' | 'moderate' | 'lower' | 'insufficient';
  valid_coverage: number;
}

export interface GcovPass {
  date: string;
  track: string;
  direction: 'ascending' | 'descending';
  resolution: string;
  polarization: string;
  valid_fraction: number;
}

export interface GcovCell {
  id: string;
  center: [number, number];
  hh: Array<number | null>;
  hv: Array<number | null>;
  water: Array<number | null>;
  /** [WorldCover class, 40 m blocks, mean summer change dB] — permanent water excluded. */
  lc?: Array<[number, number, number | null]>;
}

/** One processed NISAR site from public/data/nisar/sites.json. */
export interface NisarSite {
  id: string;
  label: string;
  /** URL folder holding gcov.json and the PNG overlays. */
  base: string;
  corners: [[number, number], [number, number], [number, number], [number, number]];
  firstDate: string;
  lastDate: string;
  passCount: number;
  changeTracks: number;
  note: string | null;
}

export interface GcovData {
  product: string;
  maturity: 'PROVISIONAL';
  quantity: string;
  generated_at: string;
  site?: { id: string; label: string; bbox: number[]; note: string | null };
  corners: [[number, number], [number, number], [number, number], [number, number]];
  gap: [string, string];
  landcover?: { source: string; excluded: number[]; classes: Record<string, { label: string; color: string }> } | null;
  water_threshold_db: number;
  composite_date: string;
  composite_track: string;
  tracks_in_change_map: number;
  passes: GcovPass[];
  cells: GcovCell[];
}
