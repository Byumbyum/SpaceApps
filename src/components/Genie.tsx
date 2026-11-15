import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { toSvg } from 'html-to-image';
import { useAppStore } from '../store';

// macOS-style genie. The page is snapshotted, then redrawn row by row on a canvas. The
// funnel is fixed in screen space: rows near the More corner bend into an S-shaped neck,
// and as the page slides up each row narrows on its own when it reaches the funnel.
// Opening plays the same motion in reverse. Bending and sliding overlap, so the motion
// never stops halfway.
const DURATION_MS = 620;
const NECK_HALF_WIDTH = 16;
const ROW = 1; // px per drawn strip
// The snapshot uses fallback fonts, so the real page dissolves in rather than snapping.
const HANDOFF_MS = 200;
const SNAPSHOT_SCALE = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

interface Frame { snapshot: HTMLCanvasElement; srcTop: number; neckX: number; neckY: number }

function drawGenie(ctx: CanvasRenderingContext2D, frame: Frame, t: number) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const { snapshot, srcTop, neckX, neckY } = frame;
  const span = height - neckY;
  const eased = easeInOutSine(t);
  const bend = smooth(clamp01(eased / 0.5));
  const slideRaw = clamp01((eased - 0.18) / 0.82);
  const slide = slideRaw * slideRaw; // accelerates into the neck
  const bottom = height - slide * span;
  const swallowed = slide * span; // source rows already through the neck
  const scale = snapshot.width / width;
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1 - 0.35 * slide * slide;
  for (let y = neckY; y < bottom; y += ROW) {
    const local = (y - neckY) / Math.max(1, bottom - neckY);
    const sourceY = srcTop + neckY + swallowed + local * (span - swallowed);
    const nearNeck = 1 - (y - neckY) / span; // 1 at the neck, 0 at the screen bottom
    const squeeze = bend * smooth(nearNeck);
    const left = squeeze * (neckX - NECK_HALF_WIDTH);
    const right = width + squeeze * (neckX + NECK_HALF_WIDTH - width);
    const rows = ((span - swallowed) / Math.max(1, bottom - neckY)) * ROW;
    ctx.drawImage(snapshot, 0, sourceY * scale, snapshot.width, Math.max(1, rows * scale), left, y, right - left, ROW + 0.6);
  }
  ctx.globalAlpha = 1;
}

// html-to-image's own canvas step is slow (~1 s); its SVG plus a plain image decode takes ~0.3 s.
// Elements entirely below the screen are skipped, since only the visible part animates.
async function snapshotOf(node: HTMLElement, transparent: boolean) {
  const viewportBottom = window.innerHeight;
  const svg = await toSvg(node, {
    skipFonts: true,
    backgroundColor: transparent ? undefined : '#ffffff',
    filter: (child) => !(child instanceof HTMLElement) || child.getBoundingClientRect().top < viewportBottom,
  });
  const image = new Image();
  image.src = svg;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = node.offsetWidth * SNAPSHOT_SCALE;
  canvas.height = node.offsetHeight * SNAPSHOT_SCALE;
  const ctx = canvas.getContext('2d');
  if (ctx) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height); }
  return canvas;
}

function neckPoint() {
  const corner = document.querySelector('.header-right')?.getBoundingClientRect();
  return corner ? { neckX: corner.left + corner.width / 2, neckY: corner.bottom } : { neckX: window.innerWidth - 40, neckY: 60 };
}

export function Genie({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  const genie = useAppStore((state) => state.genie);
  const finishGenie = useAppStore((state) => state.finishGenie);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Snapshot taken while the page sits idle, so closing starts instantly.
  const readyRef = useRef<Promise<HTMLCanvasElement> | null>(null);
  const [animating, setAnimating] = useState(false);
  const [handoff, setHandoff] = useState(false);
  // Hidden while the opening plays on the canvas.
  const [hidden, setHidden] = useState(genie === 'open');

  useLayoutEffect(() => { if (genie === 'open') setHidden(true); }, [genie]);

  // Keep a fresh close snapshot of pages (not the tutorial, whose content changes every step).
  useEffect(() => {
    if (overlay || genie) return;
    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      readyRef.current = null;
      timer = window.setTimeout(() => {
        const node = wrapRef.current?.firstElementChild as HTMLElement | null;
        if (!node) return;
        const pending = snapshotOf(node, false);
        readyRef.current = pending;
        pending.catch(() => { if (readyRef.current === pending) readyRef.current = null; });
      }, 300);
    };
    refresh();
    window.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener('scroll', refresh); window.removeEventListener('resize', refresh); };
  }, [genie, overlay, children]);

  useEffect(() => {
    if (genie !== 'open' && genie !== 'close') return;
    const node = wrapRef.current?.firstElementChild as HTMLElement | null;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    let raf = 0;
    let handoffTimer = 0;
    const done = () => { setAnimating(false); setHandoff(false); setHidden(false); finishGenie(); };
    // Opening ends on the full-page frame: cross-fade canvas out and page in.
    const handOff = () => {
      setHandoff(true);
      setHidden(false);
      handoffTimer = window.setTimeout(done, HANDOFF_MS);
    };
    if (!node || reduced) { done(); return; }

    const rect = node.getBoundingClientRect();
    const snapshot = (genie === 'close' && readyRef.current) || snapshotOf(node, overlay);
    snapshot
      .then((image) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) { done(); return; }
        const ratio = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * ratio;
        canvas.height = window.innerHeight * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.imageSmoothingQuality = 'high';
        const frame: Frame = { snapshot: image, srcTop: Math.max(0, -rect.top), ...neckPoint() };
        const progress = (elapsed: number) => (genie === 'close' ? elapsed : 1 - elapsed);
        drawGenie(ctx, frame, progress(0));
        setAnimating(true);
        setHidden(true);
        const start = performance.now();
        const tick = (now: number) => {
          const elapsed = Math.min(1, (now - start) / DURATION_MS);
          drawGenie(ctx, frame, progress(elapsed));
          if (elapsed < 1) raf = requestAnimationFrame(tick);
          else if (genie === 'open') handOff();
          else done();
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => { if (!cancelled) done(); });
    return () => { cancelled = true; cancelAnimationFrame(raf); window.clearTimeout(handoffTimer); };
  }, [genie, finishGenie, overlay]);

  return (
    <>
      <div ref={wrapRef} className={`genie ${overlay ? 'genie-overlay' : ''}`} style={hidden ? { opacity: 0 } : handoff ? { transition: `opacity ${HANDOFF_MS}ms ease` } : undefined}>{children}</div>
      {(animating || genie === 'open' || genie === 'close') && <canvas ref={canvasRef} className={`genie-canvas ${handoff ? 'genie-canvas-out' : ''}`} style={handoff ? { transition: `opacity ${HANDOFF_MS}ms ease` } : undefined} aria-hidden="true" />}
    </>
  );
}
