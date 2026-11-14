import { create } from 'zustand';
import type { AppMode, ToolMode } from './types';
import type { BasemapId } from './config/map';
import type { SelectedArea } from './lib/geo';

export type LayerId = 'motion' | 'quality' | 'interpretation';
export type NisarLayer = 'none' | 'radar' | 'change' | 'landcover';

interface AppState {
  mode: AppMode;
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
  setMode: (mode: AppMode) => void;
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
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'explore',
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
  nisarLayer: 'change',
  setMode: (mode) => set({ mode }),
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
}));
