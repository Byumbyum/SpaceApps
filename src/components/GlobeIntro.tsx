export function GlobeIntro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`globe-scene ${compact ? 'globe-compact' : ''}`} aria-label="Stylized globe locating northern Alaska">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="globe">
        <div className="globe-grid" />
        <div className="active-region" title="Display region: 50–73°N, 124–176°W" />
        <div className="mvp-pulse" title="Northern Dalton corridor MVP" />
      </div>
      {!compact && (
        <div className="globe-caption">
          
          <strong>A narrow corridor. A changing ground surface.</strong>
        </div>
      )}
    </div>
  );
}
