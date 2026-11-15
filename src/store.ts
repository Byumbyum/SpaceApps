import { create } from 'zustand';
import type { AppMode, ToolMode } from './types';
import type { BasemapId } from './config/map';
import type { LngLat, Place, SelectedArea } from './lib/geo';

/** Pages opened from the header's More menu. */
export const MORE_MODES: AppMode[] = ['tutorial', 'about', 'disclaimer', 'stories'];
export const isMoreMode = (mode: AppMode) => MORE_MODES.includes(mode);
// Safety net: if no Genie component finishes the close (e.g. in tests), switch anyway.
const GENIE_FALLBACK_MS = 1600;

export type LayerId = 'motion' | 'quality' | 'interpretation';
export type NisarLayer = 'none' | 'hotspots' | 'motion' | 'radar' | 'change' | 'landcover';

/** Ask the map to select a circle and fly to it (used by the tutorial). */
export interface FocusRequest { key: number; center: LngLat; radiusKm: number; place?: Place }

interface AppState {
  mode: AppMode;
  /** Genie animation of More pages: opening from, or closing into, the top-right corner. */
  genie: 'open' | 'close' | null;
  /** Page to show once the closing genie has folded away. */
  pendingMode: AppMode | null;
  /** Has the visitor met the tutorial on this visit? Kept in memory only: nothing is stored in the browser. */
  tutorialFound: boolean;
  /** Briefly show the Tutorial pill beside More after arriving from the Preamble. */
  tutorialHint: boolean;
  activeChapter: number;
  tool: ToolMode;
  brushSize: number;
  startYear: number;
  endYear: number;
  seasons: string[];
  layer: LayerId;
  highQualityOnly: boolean;
  selectedCellIds: string[];
  focusedCellId: string | null;
  analysisOpen: boolean;
  basemap: BasemapId;
  drawing: boolean;
  selectedArea: SelectedArea | null;
  phenomenon: string;
  showDemoGrid: boolean;
  nisarLayer: NisarLayer;
  showHotspots: boolean;
  layersOpen: boolean;
  focusRequest: FocusRequest | null;
  setMode: (mode: AppMode) => void;
  enterMapFromPreamble: () => void;
  /** Called by the Genie component when its animation ends. */
  finishGenie: () => void;
  stowTutorialHint: () => void;
  setActiveChapter: (chapter: number) => void;
  setTool: (tool: ToolMode) => void;
  setBrushSize: (size: number) => void;
  setStartYear: (year: number) => void;
  setEndYear: (year: number) => void;
  toggleSeason: (season: string) => void;
  setLayer: (layer: LayerId) => void;
  setHighQualityOnly: (enabled: boolean) => void;
  addSelectedCells: (ids: string[]) => void;
  removeSelectedCells: (ids: string[]) => void;
  clearSelection: () => void;
  setFocusedCellId: (id: string | null) => void;
  setAnalysisOpen: (open: boolean) => void;
  setBasemap: (basemap: BasemapId) => void;
  setDrawing: (drawing: boolean) => void;
  setSelectedArea: (area: SelectedArea | null) => void;
  renameSelectedArea: (id: string, name: string, region: string) => void;
  setPhenomenon: (id: string) => void;
  setShowDemoGrid: (show: boolean) => void;
  setNisarLayer: (layer: NisarLayer) => void;
  setShowHotspots: (show: boolean) => void;
  setLayersOpen: (open: boolean) => void;
  requestFocus: (center: LngLat, radiusKm: number, place?: Place) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'preamble',
  genie: null,
  pendingMode: null,
  tutorialFound: false,
  tutorialHint: false,
  activeChapter: 0,
  tool: 'navigate',
  brushSize: 34,
  startYear: 2016,
  endYear: 2026,
  seasons: ['summer'],
  layer: 'motion',
  highQualityOnly: false,
  selectedCellIds: [],
  focusedCellId: null,
  analysisOpen: false,
  basemap: 'map',
  drawing: false,
  selectedArea: null,
  phenomenon: 'permafrost',
  showDemoGrid: false,
  nisarLayer: 'hotspots',
  showHotspots: true,
  layersOpen: false,
  focusRequest: null,
  setMode: (mode) => {
    const current = get().mode;
    if (mode === current || get().genie === 'close') return;
    if (mode === 'tutorial') {
      set({ tutorialFound: true, tutorialHint: false });
    }
    // Leaving the More pages folds them back into the corner before the page underneath appears.
    if (isMoreMode(current) && !isMoreMode(mode)) {
      set({ genie: 'close', pendingMode: mode });
      window.setTimeout(() => { if (get().genie === 'close') get().finishGenie(); }, GENIE_FALLBACK_MS);
      return;
    }
    set({ mode, genie: !isMoreMode(current) && isMoreMode(mode) ? 'open' : null });
  },
  finishGenie: () => set((state) => ({ mode: state.pendingMode ?? state.mode, genie: null, pendingMode: null })),
  enterMapFromPreamble: () => set((state) => ({ mode: 'explore', genie: null, tutorialHint: !state.tutorialFound })),
  stowTutorialHint: () => {
    set({ tutorialHint: false, tutorialFound: true });
  },
  setActiveChapter: (activeChapter) => set({ activeChapter }),
  setTool: (tool) => set({ tool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setStartYear: (startYear) => set((state) => ({ startYear: Math.min(startYear, state.endYear) })),
  setEndYear: (endYear) => set((state) => ({ endYear: Math.max(endYear, state.startYear) })),
  toggleSeason: (season) => set((state) => {
    if (season !== 'summer') return state;
    return { seasons: state.seasons.includes(season) ? [] : [season] };
  }),
  setLayer: (layer) => set({ layer }),
  setHighQualityOnly: (highQualityOnly) => set({ highQualityOnly }),
  addSelectedCells: (ids) => set((state) => ({ selectedCellIds: [...new Set([...state.selectedCellIds, ...ids])] })),
  removeSelectedCells: (ids) => set((state) => {
    const removals = new Set(ids);
    return { selectedCellIds: state.selectedCellIds.filter((id) => !removals.has(id)) };
  }),
  clearSelection: () => set({ selectedCellIds: [], focusedCellId: null }),
  setFocusedCellId: (focusedCellId) => set({ focusedCellId }),
  setAnalysisOpen: (analysisOpen) => set({ analysisOpen }),
  setBasemap: (basemap) => set({ basemap }),
  setDrawing: (drawing) => set({ drawing }),
  setSelectedArea: (selectedArea) => set((state) => ({ selectedArea, analysisOpen: selectedArea ? state.analysisOpen : false })),
  renameSelectedArea: (id, name, region) => set((state) => (state.selectedArea?.id === id ? { selectedArea: { ...state.selectedArea, name, region } } : state)),
  setPhenomenon: (phenomenon) => set({ phenomenon }),
  setShowDemoGrid: (showDemoGrid) => set({ showDemoGrid }),
  setNisarLayer: (nisarLayer) => set({ nisarLayer }),
  setShowHotspots: (showHotspots) => set({ showHotspots }),
  setLayersOpen: (layersOpen) => set({ layersOpen }),
  requestFocus: (center, radiusKm, place) => set({ focusRequest: { key: Date.now(), center, radiusKm, place } }),
}));
