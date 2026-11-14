// Areas the GCOV pipeline can process. bbox is [west, south, east, north] in degrees; keep
// boxes small (tens of km) so each Harmony crop stays at a few MB per layer.
//
// The pipeline works on the EPSG:3413 polar-stereographic grid the Alaska granules use
// natively. Sites outside the Arctic ask Harmony to reproject to it (outputCrs); at
// mid-latitudes that grid is stretched ~10–15 %, fine for relative change maps.
//
// note: caveat shown in the app next to this site's NISAR results.
// out: where the web layers are written. Fairbanks stays at the folder the app reads today.

export const SITES = {
  fairbanks: {
    label: 'Fairbanks, Alaska',
    bbox: [-148.06, 64.67, -147.45, 65.03],
    start: '2026-06-01',
    end: '2026-08-31',
    out: 'public/data/nisar',
  },
  'barry-arm': {
    label: 'Barry Arm landslide, Alaska',
    bbox: [-148.25, 61.1, -148.05, 61.2],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/barry-arm',
  },
  blatten: {
    label: 'Lötschental (Blatten), Swiss Alps',
    bbox: [7.75, 46.38, 7.9, 46.48],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/blatten',
  },
  'hohe-tauern': {
    label: 'Grossglockner, Austrian Alps',
    bbox: [12.65, 47.03, 12.8, 47.13],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/hohe-tauern',
  },
  gyirong: {
    label: 'Gyirong (Rasuwa outburst flood), Tibet',
    bbox: [85.2, 28.3, 85.5, 28.6],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/gyirong',
  },
};
