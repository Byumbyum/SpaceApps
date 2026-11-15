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
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.35,
    capacity: 0.7,
    label: 'Fairbanks, Alaska',
    bbox: [-148.06, 64.67, -147.45, 65.03],
    start: '2026-06-01',
    end: '2026-08-31',
    out: 'public/data/nisar',
  },
  nome: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.55,
    capacity: 0.5,
    label: 'Nome, Alaska',
    bbox: [-165.6, 64.45, -165.25, 64.6],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    out: 'public/data/nisar/nome',
  },
  bethel: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.7,
    capacity: 0.45,
    label: 'Bethel, Alaska',
    bbox: [-161.9, 60.74, -161.65, 60.84],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    out: 'public/data/nisar/bethel',
  },
  'barry-arm': {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.5,
    capacity: 0.55,
    label: 'Barry Arm, Alaska',
    bbox: [-148.25, 61.1, -148.05, 61.2],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/barry-arm',
  },
  blatten: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.3,
    capacity: 0.8,
    label: 'Lötschental, Swiss Alps',
    bbox: [7.75, 46.38, 7.9, 46.48],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/blatten',
  },
  'hohe-tauern': {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.25,
    capacity: 0.8,
    label: 'Grossglockner, Austrian Alps',
    bbox: [12.65, 47.03, 12.8, 47.13],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/hohe-tauern',
  },
  gyirong: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.6,
    capacity: 0.4,
    label: 'Gyirong, Tibet',
    bbox: [85.2, 28.3, 85.5, 28.6],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/gyirong',
  },
  ulaanbaatar: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.75,
    capacity: 0.35,
    label: 'Ulaanbaatar, Mongolia',
    // The city and the ger districts spreading over the northern hills.
    bbox: [106.75, 47.83, 107.1, 48.0],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Discontinuous permafrost at the southern edge of the Siberian zone: frozen ground is patchy here, so movement can come from seasonal frost and construction as well as thaw.',
    out: 'public/data/nisar/ulaanbaatar',
  },
  // Central and South Asian mountains: permafrost, glacial lakes and debris flows above towns.
  almaty: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.4,
    capacity: 0.65,
    label: 'Almaty, Kazakhstan',
    bbox: [76.8, 43.0, 77.15, 43.25],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/almaty',
  },
  'ala-archa': {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.55,
    capacity: 0.45,
    label: 'Ala-Archa, Kyrgyzstan',
    bbox: [74.4, 42.45, 74.7, 42.65],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/ala-archa',
  },
  khorog: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.75,
    capacity: 0.3,
    label: 'Khorog, Tajikistan',
    bbox: [71.45, 37.45, 71.75, 37.65],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/khorog',
  },
  hunza: {
    // Researched estimates until census and health-facility data are added (as on the demo hotspot).
    vulnerability: 0.65,
    capacity: 0.35,
    label: 'Hunza valley, Pakistan',
    bbox: [74.5, 36.2, 74.8, 36.45],
    start: '2026-06-01',
    end: '2026-09-30',
    outputCrs: 'EPSG:3413',
    note: 'Mountain site: summer radar change here is dominated by snow and glacier melt, so it is not a permafrost signal on its own.',
    out: 'public/data/nisar/hunza',
  },
};
