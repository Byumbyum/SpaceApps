import { storyChapters } from '../data/story';
import { useAppStore } from '../store';
import { EvidenceTag } from './EvidenceTag';
import { GlobeIntro } from './GlobeIntro';
import { StoryVisual } from './StoryVisual';

export function StoryMode() {
  const activeChapter = useAppStore((state) => state.activeChapter);
  const setActiveChapter = useAppStore((state) => state.setActiveChapter);
  const setMode = useAppStore((state) => state.setMode);
  const chapter = storyChapters[activeChapter];

  return (
    <main id="main-content" className="story-page">
      <section className="story-hero">
        <div className="story-hero-copy">
          
          <h1>When frozen ground<br /><em>starts to move.</em></h1>
          <p className="objective">We identify and explain radar-observed ground changes that may indicate emerging permafrost-related hazards, and show clearly which observations are trustworthy.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => document.getElementById('story-chapters')?.scrollIntoView({ behavior: 'smooth' })}>Begin the story <span>↓</span></button>
            <button className="text-button" onClick={() => setMode('explore')}>Open Explore mode →</button>
          </div>
          <div className="hero-facts"><span><b>2016–2026</b> radar context</span><span><b>100 m</b> analysis grid</span><span><b>2 indices</b> never probabilities</span></div>
        </div>
        <GlobeIntro />
      </section>

      <section id="story-chapters" className="chapter-stage">
        <nav className="chapter-rail" aria-label="Story chapters">
          {storyChapters.map((item, index) => (
            <button key={item.number} className={index === activeChapter ? 'active' : ''} onClick={() => setActiveChapter(index)} aria-label={`Chapter ${item.number}: ${item.title}`}>
              <span>{item.number}</span><i />
            </button>
          ))}
        </nav>
        <article className="chapter-card" key={chapter.number}>
          <div className="chapter-copy">
            <div className="chapter-meta"><span>{chapter.number} / 09</span><EvidenceTag kind={chapter.evidence} /></div>
            
            <h2>{chapter.title}</h2>
            <p className="chapter-summary">{chapter.summary}</p>
            <div className="evidence-split">
              <div><span className="split-label">{chapter.measuredTitle}</span><p>{chapter.measured}</p></div>
              <div><span className="split-label">{chapter.researchTitle}</span><p>{chapter.research}</p></div>
            </div>
            <div className="chapter-controls">
              <button disabled={activeChapter === 0} onClick={() => setActiveChapter(activeChapter - 1)}>← Previous</button>
              {activeChapter < storyChapters.length - 1 ? (
                <button onClick={() => setActiveChapter(activeChapter + 1)}>Next chapter →</button>
              ) : (
                <button className="primary-button compact" onClick={() => setMode('explore')}>Explore the evidence →</button>
              )}
            </div>
          </div>
          <div className="chapter-visual-wrap"><StoryVisual chapter={chapter} /></div>
        </article>
      </section>
    </main>
  );
}
