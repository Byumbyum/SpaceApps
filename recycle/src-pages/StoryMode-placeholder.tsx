import { useAppStore } from '../store';
import { ArrowRightIcon } from './Icons';

// Placeholder while the story is being written: one way in, to the guided tutorial.
export function StoryMode() {
  const setMode = useAppStore((state) => state.setMode);
  return (
    <main id="main-content" className="story-page story-blank">
      <button className="save-world-button" onClick={() => setMode('tutorial')}>Learn how to save the world <ArrowRightIcon /></button>
    </main>
  );
}
