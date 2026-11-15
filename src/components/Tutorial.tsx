import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../store';

interface Step {
  /** CSS selectors to spotlight, first match wins; none centres the card on a dimmed screen. */
  target?: string[];
  title: string;
  body: ReactNode;
  /** Puts the map in the state the step talks about, so nobody has to press the buttons. */
  enter?: () => void;
}

// A site with risk computed from NISAR, so the tour shows real zones rather than a demo glow.
const FOCUS = { name: 'Ulaanbaatar', region: 'Mongolia', center: [106.92, 47.95] as [number, number] };

const store = () => useAppStore.getState();

const STEPS: Step[] = [
  {
    title: 'Welcome to Prescient',
    body: <>A two-minute tour of how this map finds places where thawing ground puts people at risk. Press <kbd>Space</kbd>, <kbd>→</kbd> or click to continue. <kbd>←</kbd> goes back, <kbd>Esc</kbd> skips.</>,
    enter: () => { store().setLayersOpen(false); store().setShowHotspots(true); },
  },
  {
    target: ['.map-canvas'],
    title: 'The map',
    body: 'A live globe. Drag to move, scroll or pinch to zoom, and right-drag to tilt. Switch between map and satellite at the bottom left.',
    enter: () => { store().setLayersOpen(false); store().setSelectedArea(null); },
  },
  {
    target: ['.map-search'],
    title: 'Search anywhere',
    body: 'Type a town, region or mountain. Suggestions appear as you type and forgive spelling mistakes.',
  },
  {
    target: ['[data-tour="hotspots"]'],
    title: 'Risk hotspots, worldwide',
    body: 'Red glows mark places where permafrost thaw threatens safety, health or livelihoods. This menu turns them on or off, and will switch between climate phenomena as more become ready.',
    enter: () => store().setShowHotspots(true),
  },
  {
    target: ['[data-tour="draw"]'],
    title: 'Pick an area',
    body: 'Click anywhere on the map to select a circle, or use Draw area to drag a box. Let’s select one for you.',
    enter: () => store().setSelectedArea(null),
  },
  {
    target: ['.map-canvas'],
    title: 'Danger zones in your area',
    body: (
      <>
        <p>Hotspots are drawn over the areas at risk. The deeper the red, the more likely the harm.</p>
        <p className="tour-muted">Where NISAR ground movement is processed, the risk is computed and the outline follows the actual risk area: zoom in and the glow sharpens into zones where moving ground meets buildings. Elsewhere this demo shows a soft glow from a researched estimate.</p>
      </>
    ),
    enter: () => {
      store().setNisarLayer('hotspots');
      if (store().selectedArea?.name !== FOCUS.name) store().requestFocus(FOCUS.center, 12, FOCUS);
    },
  },
  {
    target: ['.hotspot-block', '.insights-panel'],
    title: 'Why it is a hotspot',
    body: 'Each hotspot gets a risk score out of 100, the three factors behind it, and what is at stake for safety, health and the economy.',
  },
  {
    target: ['.layers-popover', '[data-tour="layers"]'],
    title: 'Layers',
    body: 'Hotspots are the default layer. Inside a NISAR site you can switch to measured radar change, the radar image itself, or land cover.',
    enter: () => store().setLayersOpen(true),
  },
  {
    target: ['[data-tour="sites"]'],
    title: 'Real NISAR radar',
    body: 'These sites carry real NISAR satellite data, processed straight from NASA. Pick one to fly there and see what the radar measured.',
    enter: () => store().setLayersOpen(false),
  },
  {
    target: ['.phenomena'],
    title: 'Climate phenomena',
    body: 'Two kinds of insight: what we can predict months to years ahead, such as permafrost thaw and slope creep, and what we can measure today.',
  },
  {
    title: 'How risk is calculated',
    body: (
      <>
        <div className="tour-formula">Risk = f(Hazard, Exposure, Vulnerability)</div>
        <p>We use the climate-risk framework of the IPCC, the UN’s climate science body.</p>
        <ul className="tour-list">
          <li><b>Hazard</b>Permafrost thawing under the ground: permafrost present, ground near 0 °C, and sinking that does not recover year after year (Sentinel-1 since 2016, NISAR from 2026)</li>
          <li><b>Exposure</b>Buildings, roads, pipelines, hospitals and people in the way</li>
          <li><b>Vulnerability</b>Poverty, age, building type and isolation, and the capacity to cope: hospitals, emergency services, monitoring and local plans</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Predict, then prevent',
    body: (
      <>
        <p>NISAR images each spot every 12 days. We build trends over many months to project risk months to years ahead, giving time to repair, reinforce or relocate before damage happens.</p>
        <p className="tour-muted">Not for real-time emergencies: active floods or the exact day of a sudden collapse need faster data.</p>
      </>
    ),
  },
  {
    title: 'Who it helps',
    body: (
      <ul className="tour-list">
        <li><b>Governments</b>A ranked list of roads, buildings, pipelines and slopes, with time until each crosses a damage threshold</li>
        <li><b>NGOs and humanitarian groups</b>Hotspot maps of rising risk with population and vulnerability layered on</li>
        <li><b>Communities</b>A plain green, amber or red status and what to plan for, without jargon</li>
        <li><b>Conservation non-profits</b>Where forest loss is spreading, year on year</li>
      </ul>
    ),
  },
  {
    title: 'You’re ready',
    body: 'Explore any place on Earth, or replay this tour any time from More → Tutorial.',
  },
];

interface Box { x: number; y: number; w: number; h: number }
const PAD = 8;
const CARD_W = 360;
const GAP = 16;

function findTarget(selectors?: string[]): Box | null {
  for (const selector of selectors ?? []) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) return { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 };
  }
  return null;
}

// Beside the spotlight where it fits (right, left, below, above), otherwise centred low.
function placeCard(box: Box | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 32);
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - width - 16);
  const clampY = (y: number) => Math.min(Math.max(76, y), vh - cardH - 16);
  if (!box) return { left: (vw - width) / 2, top: Math.max(76, (vh - cardH) / 2), width };
  const fitsH = box.h < vh * 0.7;
  if (fitsH && box.x + box.w + GAP + width < vw - 16) return { left: box.x + box.w + GAP, top: clampY(box.y), width };
  if (fitsH && box.x - GAP - width > 16) return { left: box.x - GAP - width, top: clampY(box.y), width };
  if (box.y + box.h + GAP + cardH < vh - 16) return { left: clampX(box.x), top: box.y + box.h + GAP, width };
  if (box.y - GAP - cardH > 76) return { left: clampX(box.x), top: box.y - GAP - cardH, width };
  return { left: (vw - width) / 2, top: vh - cardH - 24, width };
}

export function Tutorial() {
  const setMode = useAppStore((state) => state.setMode);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(240);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = useCallback(() => { store().setLayersOpen(false); setMode('explore'); }, [setMode]);
  const next = useCallback(() => { if (index >= STEPS.length - 1) finish(); else setIndex(index + 1); }, [index, finish]);
  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  useEffect(() => { step.enter?.(); }, [step]);

  // Targets appear and move as the map animates, so keep tracking them.
  useEffect(() => {
    const update = () => setBox((current) => {
      const found = findTarget(step.target);
      if (current && found && Math.abs(current.x - found.x) < 1 && Math.abs(current.y - found.y) < 1 && Math.abs(current.w - found.w) < 1 && Math.abs(current.h - found.h) < 1) return current;
      return found;
    });
    update();
    const timer = window.setInterval(update, 150);
    window.addEventListener('resize', update);
    return () => { window.clearInterval(timer); window.removeEventListener('resize', update); };
  }, [step]);

  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [index, box]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Space and Enter on a focused card button already click it.
      const onButton = event.target instanceof HTMLElement && event.target.closest('button') !== null;
      if (event.key === 'ArrowRight' || ((event.key === ' ' || event.key === 'Enter') && !onButton)) { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); back(); }
      else if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, finish]);

  const spot = box ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };
  const card = placeCard(box, cardH);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Site tutorial" onClick={next} onContextMenu={(event) => { event.preventDefault(); next(); }}>
      <div className={`tour-spot ${box ? '' : 'tour-spot-none'}`} style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }} />
      <div ref={cardRef} className="tour-card" style={card} onClick={(event) => event.stopPropagation()} key={index}>
        <div className="tour-step">{index + 1} / {STEPS.length}</div>
        <h2>{step.title}</h2>
        <div className="tour-body">{step.body}</div>
        <div className="tour-progress" aria-hidden="true">{STEPS.map((_, dot) => <i key={dot} className={dot === index ? 'active' : dot < index ? 'done' : ''} />)}</div>
        <div className="tour-actions">
          {!last && <button className="tour-skip" onClick={finish}>Skip tour</button>}
          <span />
          {index > 0 && <button className="tour-back" onClick={back}>Back</button>}
          {last ? (
            <>
              <button className="tour-back" onClick={() => setIndex(0)}>Replay</button>
              <button className="tour-next" onClick={finish}>Open the map</button>
            </>
          ) : <button className="tour-next" onClick={next}>Next</button>}
        </div>
      </div>
    </div>
  );
}
