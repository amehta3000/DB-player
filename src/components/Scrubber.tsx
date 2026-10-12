import { useState, type CSSProperties } from 'react';
import { formatTime } from '../lib/format';

interface Props {
  time: number;
  duration: number;
  buffered: number;
  loadProgress: number | null;
  onSeek(t: number): void;
  compact?: boolean;
}

export function Scrubber({ time, duration, buffered, loadProgress, onSeek, compact }: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? time;
  const pct = duration ? (shown / duration) * 100 : 0;
  const buf = loadProgress != null ? loadProgress * 100 : duration ? (buffered / duration) * 100 : 0;
  const style = { '--pct': `${pct}%`, '--buf': `${buf}%` } as CSSProperties;

  const commit = () => {
    if (drag != null) onSeek(drag);
    setDrag(null);
  };

  return (
    <div className={`scrubber${compact ? ' compact' : ''}`}>
      {!compact && <span className="time">{formatTime(shown)}</span>}
      <input
        type="range"
        className="range"
        aria-label="Seek"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(shown, duration || 0)}
        disabled={!duration}
        style={style}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      {!compact && <span className="time">{duration ? formatTime(duration) : '–:––'}</span>}
    </div>
  );
}
