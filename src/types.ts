export type EvidenceKind = 'OBSERVED' | 'INFERRED' | 'PUBLISHED';
export type IndexKey = 'Q' | 'E';
export type IndexBand = 'high' | 'medium' | 'low' | 'not-assessed';
export type ToolMode = 'navigate' | 'select' | 'deselect';
export type AppMode = 'preamble' | 'explore' | 'tutorial' | 'about' | 'disclaimer' | 'stories';

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
  /** Ground movement (gunw.json) processed for this site. */
  gunw?: boolean;
  /** ERA5-Land climate context (climate.json) pulled for this site. */
  climate?: boolean;
  /** Computed per-cell risk (risk.json), replacing the demo hotspot inside this site. */
  risk?: boolean;
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

/** public/data/nisar/<site>/gunw.json: cumulative ground movement from NISAR GUNW. */
export interface GunwData {
  product: string;
  maturity: 'PROVISIONAL';
  quantity: string;
  corrections: Record<string, string>;
  nominal_incidence_deg: number;
  corners: [[number, number], [number, number], [number, number], [number, number]];
  map: { file: string; track: string; limit_cm: number; first: string; last: string };
  tracks: Array<{ key: string; track: string; direction: 'ascending' | 'descending'; mode: string; dates: string[]; addt?: Array<number | null>; addtEra5?: Array<number | null> }>;
  /** los[trackKey][i]: cumulative line-of-sight cm at tracks[].dates[i], positive = toward the satellite. */
  /** stefan: fit of the cell's movement to √ADDT (Stefan thaw model); seasonal = cm over the season. */
  cells: Array<{ id: string; center: [number, number]; los: Record<string, Array<number | null>>; stefan?: { track: string; a: number; r2: number; seasonal: number }; stefanEra5?: { track: string; a: number; r2: number; seasonal: number } }>;
  thaw_model?: { name: string; temperature: string; addt_reset: string; note: string };
}

/** public/data/nisar/<site>/climate.json: ERA5-Land context at the site centre. */
export interface ClimateData {
  source: string;
  period: [string, string];
  years: Array<{ year: number; addt: number; thawOnset: string | null; deepSoilC: number | null }>;
  current: { year: number; addt: number; addtVsNormalPct: number | null; thawOnset: string | null; thawOnsetVsNormalDays: number | null; deepSoilC: number | null } | null;
  normal: { years: [number, number] | null; addt: number | null; deepSoilC: number | null };
  deepSoilTrendPerDecade: number | null;
}

/** public/data/nisar/<site>/risk.json: risk per 1 km cell from measured hazard and exposure. */
export interface RiskData {
  method: string;
  inputs: { hazard: string; exposure: string; vulnerability: string };
  levels: number[];
  /** Where the multi-year (Sentinel-1) trend came from, or null if none for this site yet. */
  trendSource?: string | null;
  /** movement: NISAR 2026 seasonal thaw movement (cm); trendCmYr: Sentinel-1 net rate (cm/yr); p: permafrost fraction. */
  cells: Array<{ id: string; center: [number, number]; movement: number; trendCmYr?: number | null; p?: number; h: number; e: number; risk: number }>;
}
