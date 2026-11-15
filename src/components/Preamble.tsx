import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../store';
import { ArrowRightIcon, ChevronIcon } from './Icons';
import { PermafrostWorldMap } from './PermafrostWorldMap';

// 0 → 1 as p moves from a to b.
const ramp = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
// Fades in over [a, b] and out over [c, d].
const span = (p: number, a: number, b: number, c: number, d: number) => Math.min(ramp(p, a, b), 1 - ramp(p, c, d));

/** Scroll progress (0–1) through a tall section whose child sticks to the viewport. */
function useStageProgress() {
  const ref = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      setProgress(travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return { ref, progress };
}

/** Fades its children up into view the first time they scroll on screen. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); observer.disconnect(); } }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`}>{children}</div>;
}

export function Preamble() {
  const enterMap = useAppStore((state) => state.enterMapFromPreamble);
  const { ref, progress: p } = useStageProgress();

  // Scroll script for the pinned stage (fractions of its scroll length).
  const flood = ramp(p, 0.1, 0.16);
  const titleCard = span(p, 0.33, 0.37, 0.45, 0.49);
  const blatten = ramp(p, 0.49, 0.55);
  const wipe = ramp(p, 0.6, 0.93); // 0: all before, 1: all after
  // Darker behind the title card, lighter so the satellite images read.
  const dim = (0.55 + 0.2 * titleCard) * (1 - blatten) + 0.25 * blatten;
  const lineAt = 100 - wipe * 100;

  return (
    <main id="main-content" className="preamble">
      <section ref={ref} className="pre-stage" aria-label="Nepal, August 2026, and Blatten, May 2025">
        <div className="pre-sticky">
          <img className="pre-img" src="/preamble/tibet-bridge.jpg" alt="A destroyed bridge over a flooded river on the Tibet–Nepal border" />
          <img className="pre-img" src="/preamble/tibet-flood.jpg" alt="A house half-buried in flood debris" style={{ opacity: flood * (1 - blatten) }} />
          <img className="pre-img" src="/preamble/blatten-before.jpg" alt="Satellite image of Blatten village before the glacier collapse, September 2024" style={{ opacity: blatten }} />
          <img className="pre-img" src="/preamble/blatten-after.jpg" alt="Satellite image of Blatten buried by debris after the glacier collapse, May 2025" style={{ opacity: blatten, clipPath: `inset(0 0 0 ${lineAt}%)` }} />
          {/* The veil (dimming, words, scroll cue) fades in 0.4 s after the photo appears. */}
          <div className="pre-veil">
          <div className="pre-dim" style={{ opacity: dim }} />

          <div className="pre-copy" style={{ opacity: 1 - ramp(p, 0.08, 0.12) }}>
            <h1 className="pre-big pre-intro">This is Nepal on 26 August 2026.</h1>
          </div>
          <div className="pre-copy" style={{ opacity: span(p, 0.14, 0.18, 0.27, 0.31) }}>
            <h2 className="pre-big">Countless deaths and even more casualties.</h2>
            <p className="pre-small" style={{ opacity: ramp(p, 0.18, 0.22) }}>On 26 August this year, flash floods devastated the China–Nepal border. Thawing permafrost was cited as a major contributing factor.</p>
          </div>
          <div className="pre-copy" style={{ opacity: titleCard }}>
            <h2 className="pre-big">But it doesn’t have to be this way.</h2>
          </div>

          <div className="pre-wipe" style={{ opacity: ramp(p, 0.58, 0.62) }} aria-hidden="true">
            <i className="pre-line" style={{ left: `${lineAt}%` }} />
            <span className="pre-tag pre-tag-left" style={{ opacity: lineAt > 12 ? 1 : 0 }}>Before · 19 Sep 2024</span>
            <span className="pre-tag pre-tag-right" style={{ opacity: lineAt < 88 ? 1 : 0 }}>After · 29 May 2025</span>
            <span className="pre-place">Blatten, Swiss Alps · the Birch Glacier collapsed on 28 May 2025</span>
          </div>

          <div className="pre-copy" style={{ opacity: span(p, 0.56, 0.6, 0.93, 0.97) }}>
            <p className="pre-small pre-over">Similar disasters have been mitigated before. On 28 May 2025, Swiss authorities had already evacuated the village of Blatten when its monitoring stations sounded the alarm.</p>
          </div>

          <div className="pre-cue" style={{ opacity: 1 - ramp(p, 0.02, 0.08) }} aria-hidden="true"><span>Scroll down</span><ChevronIcon /></div>
          </div>
          <small className="pre-credit">
            {blatten < 0.5 ? 'Photos: Rajesh Kumar Singh / AP' : 'Before: Esri World Imagery · After: Planet Labs · via Sonda Internacional'}
          </small>
        </div>
      </section>

      <section className="pre-body">
        <Reveal className="pre-medium"><p>However, not all places in the world have access to this life-saving infrastructure, leading to disasters that could have been mitigated.</p></Reveal>
        <div className="pre-spacer" />
        <Reveal className="pre-medium"><p><b>Prescience</b> uses NISAR’s radar vision from space to forewarn governments, NGOs and communities, so they can take action before disaster strikes.</p></Reveal>

        <Reveal className="pre-statement">
          <h2>Humanity has the data.</h2>
          <p>All of the world’s major permafrost regions already have published and frequently updated NISAR coverage. We already have the means to save lives.</p>
        </Reveal>

        <Reveal className="pre-map"><PermafrostWorldMap /></Reveal>

        <Reveal className="pre-cta">
          <button className="save-world-button" onClick={enterMap}>Save communities around the world now <ArrowRightIcon /></button>
        </Reveal>
      </section>
    </main>
  );
}
