import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getFontEmbedCSS, toSvg } from 'html-to-image';
import { useAppStore } from '../store';

// macOS-style genie, built the way macOS does it: take a picture of the page (macOS gets
// the window's pixels for free; a browser has to snapshot the DOM), stretch it over a mesh
// on the GPU, and bend the mesh. The funnel is fixed in screen space: rows near the More
// corner bend into an S-shaped neck, and as the page slides up each row narrows when it
// reaches the funnel. Opening plays the same motion in reverse. Without WebGL, the same
// mesh is drawn strip by strip on a 2D canvas.
const DURATION_MS = 620;
const NECK_HALF_WIDTH = 16;
const MESH_ROWS = 160;
const HANDOFF_MS = 90; // brief cross-fade from the picture to the live page
const SNAPSHOT_SCALE = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/** A picture of exactly the visible screen, at SNAPSHOT_SCALE pixels per CSS pixel. */
interface Snapshot { canvas: HTMLCanvasElement; width: number; height: number }
interface Frame { snapshot: Snapshot; neckX: number; neckY: number }
interface Row { y: number; left: number; right: number; v: number }

/** Mesh rows for progress t (0 = full page, 1 = gone into the corner). v is the source row (0–1). */
function genieRows({ snapshot, neckX, neckY }: Frame, t: number): { rows: Row[]; alpha: number } {
  const { width, height } = snapshot;
  const span = height - neckY;
  const eased = easeInOutSine(t);
  const bend = smooth(clamp01(eased / 0.5));
  const slideRaw = clamp01((eased - 0.18) / 0.82);
  const slide = slideRaw * slideRaw; // accelerates into the neck
  const bottom = height - slide * span;
  const swallowed = slide * span; // source rows already through the neck
  const rows: Row[] = [];
  for (let i = 0; i <= MESH_ROWS; i += 1) {
    const local = i / MESH_ROWS;
    const y = neckY + local * (bottom - neckY);
    const nearNeck = 1 - (y - neckY) / span; // 1 at the neck, 0 at the screen bottom
    const squeeze = bend * smooth(clamp01(nearNeck));
    rows.push({
      y,
      left: squeeze * (neckX - NECK_HALF_WIDTH),
      right: width + squeeze * (neckX + NECK_HALF_WIDTH - width),
      v: (neckY + swallowed + local * (span - swallowed)) / height,
    });
  }
  return { rows, alpha: 1 - 0.35 * slide * slide };
}

// ---- Renderers --------------------------------------------------------------------
interface Renderer { draw: (frame: Frame, t: number) => void; dispose: () => void }

const VERTEX = `attribute vec2 a_pos; attribute vec2 a_uv; uniform vec2 u_view; varying vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = vec4(a_pos.x / u_view.x * 2.0 - 1.0, 1.0 - a_pos.y / u_view.y * 2.0, 0.0, 1.0); }`;
const FRAGMENT = `precision mediump float; uniform sampler2D u_tex; uniform float u_alpha; varying vec2 v_uv;
void main() { gl_FragColor = texture2D(u_tex, v_uv) * u_alpha; }`;

function webglRenderer(canvas: HTMLCanvasElement, snapshot: Snapshot): Renderer | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl || snapshot.canvas.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || snapshot.canvas.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
  const shader = (type: number, source: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); return s; };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas);
  // Non-power-of-two textures: no mipmaps, clamp at the edges.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const pos = gl.getAttribLocation(program, 'a_pos');
  const uv = gl.getAttribLocation(program, 'a_uv');
  gl.enableVertexAttribArray(pos);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  gl.uniform2f(gl.getUniformLocation(program, 'u_view'), window.innerWidth, window.innerHeight);
  const alphaUniform = gl.getUniformLocation(program, 'u_alpha');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const vertices = new Float32Array((MESH_ROWS + 1) * 2 * 4);

  return {
    draw(frame, t) {
      const { rows, alpha } = genieRows(frame, t);
      // One triangle strip: left and right edge of every mesh row.
      rows.forEach((row, i) => vertices.set([row.left, row.y, 0, row.v, row.right, row.y, 1, row.v], i * 8));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(alphaUniform, alpha);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, rows.length * 2);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); },
  };
}

function canvasRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const ratio = canvas.width / window.innerWidth;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  return {
    draw(frame, t) {
      const { rows, alpha } = genieRows(frame, t);
      const source = frame.snapshot.canvas;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = alpha;
      for (let i = 0; i < rows.length - 1; i += 1) {
        const a = rows[i];
        const b = rows[i + 1];
        const sy = a.v * source.height;
        ctx.drawImage(source, 0, sy, source.width, Math.max(1, (b.v - a.v) * source.height), a.left, a.y, a.right - a.left, b.y - a.y + 0.6);
      }
      ctx.globalAlpha = 1;
    },
    dispose() { /* nothing held */ },
  };
}

// ---- Snapshot ---------------------------------------------------------------------
// The site's web fonts, embedded once so the picture matches the live page exactly.
// Only the Latin subsets are kept, which is all the site uses, to keep each snapshot light.
// Browsers write the Latin range as U+0000-00FF or U+0-FF.
const LATIN_RANGE = /U\+0{1,4}-0{0,2}FF(?![0-9A-F])/i;
let fontCss: Promise<string> | null = null;
function siteFontCss() {
  fontCss ??= getFontEmbedCSS(document.body)
    .then((css) => (css.match(/@font-face\s*{[^}]*}/g) ?? []).filter((rule) => !/unicode-range/i.test(rule) || LATIN_RANGE.test(rule)).join('\n'))
    .catch(() => '');
  return fontCss;
}

// html-to-image's own canvas step is slow (~1 s); its SVG plus a plain image decode is quick.
// Only what is on screen is drawn: elements entirely below it are skipped.
async function snapshotOf(node: HTMLElement, transparent: boolean): Promise<Snapshot> {
  const rect = node.getBoundingClientRect();
  const width = rect.width;
  const height = window.innerHeight;
  const fontEmbedCSS = await siteFontCss();
  const svg = await toSvg(node, {
    fontEmbedCSS: fontEmbedCSS || undefined,
    skipFonts: !fontEmbedCSS,
    backgroundColor: transparent ? undefined : '#ffffff',
    // The page itself is hidden (opacity 0) while it opens; draw it fully visible.
    style: { opacity: '1', transition: 'none' },
    filter: (child) => !(child instanceof HTMLElement) || child.getBoundingClientRect().top < height,
  });
  const image = new Image();
  image.src = svg;
  await image.decode();
  // Crop to the visible screen (keeps the GPU texture small, whatever the page length).
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SNAPSHOT_SCALE);
  canvas.height = Math.round(height * SNAPSHOT_SCALE);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, rect.top * SNAPSHOT_SCALE, node.offsetWidth * SNAPSHOT_SCALE, node.offsetHeight * SNAPSHOT_SCALE);
  }
  return { canvas, width, height };
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
  const readyRef = useRef<Promise<Snapshot> | null>(null);
  const [animating, setAnimating] = useState(false);
  const [handoff, setHandoff] = useState(false);
  // Hidden while the opening plays on the canvas.
  const [hidden, setHidden] = useState(genie === 'open');

  useLayoutEffect(() => { if (genie === 'open') setHidden(true); }, [genie]);
  // Warm the font cache early so the first opening does not wait for it.
  useEffect(() => { void siteFontCss(); }, []);

  // Keep a fresh close snapshot of pages (not the tutorial, whose content changes every step).
  useEffect(() => {
    if (overlay || genie) return;
    let timer = 0;
    const refresh = () => {
      window.clearTimeout(timer);
      readyRef.current = null;
      timer = window.setTimeout(() => {
        const node = wrapRef.current;
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
    // The whole full-width wrapper, not just the centred content column.
    const node = wrapRef.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    let raf = 0;
    let handoffTimer = 0;
    let renderer: Renderer | null = null;
    const done = () => { renderer?.dispose(); setAnimating(false); setHandoff(false); setHidden(false); finishGenie(); };
    // Opening ends on the full-page frame; the live page takes over with a brief cross-fade.
    const handOff = () => {
      setHandoff(true);
      setHidden(false);
      handoffTimer = window.setTimeout(done, HANDOFF_MS);
    };
    if (!node || reduced) { done(); return; }

    const snapshot = (genie === 'close' && readyRef.current) || snapshotOf(node, overlay);
    snapshot
      .then((image) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) { done(); return; }
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(window.innerWidth * ratio);
        canvas.height = Math.round(window.innerHeight * ratio);
        renderer = webglRenderer(canvas, image) ?? canvasRenderer(canvas);
        if (!renderer) { done(); return; }
        const frame: Frame = { snapshot: image, ...neckPoint() };
        const progress = (elapsed: number) => (genie === 'close' ? elapsed : 1 - elapsed);
        renderer.draw(frame, progress(0));
        setAnimating(true);
        setHidden(true);
        const start = performance.now();
        const tick = (now: number) => {
          const elapsed = Math.min(1, (now - start) / DURATION_MS);
          renderer!.draw(frame, progress(elapsed));
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
