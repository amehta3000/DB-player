import { useEffect, useState, type CSSProperties } from 'react';
import { trackTitle } from '../lib/format';
import type { Player } from '../lib/usePlayer';
import { Cover } from './Cover';
import {
  Back10Icon,
  ChevronDownIcon,
  Fwd10Icon,
  KeyboardIcon,
  ListIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons';
import { Scrubber } from './Scrubber';

interface Props {
  player: Player;
  folderName: string;
  /** Set when the queue's folder isn't the page being shown. */
  onOpenPlaylist?(): void;
  onShowShortcuts(): void;
}

function statusLine(p: Player, folderName: string): string {
  if (p.status === 'error') return p.error ?? 'Couldn’t play this file';
  if (p.loadProgress != null) return `Preparing ${p.current?.ext.toUpperCase()} · ${Math.round(p.loadProgress * 100)}%`;
  if (p.status === 'loading' && !p.time) return 'Loading…';
  return `${folderName} · ${p.index + 1} of ${p.queue.length}`;
}

function Transport({ p, big = false }: { p: Player; big?: boolean }) {
  const s = big ? 30 : 22;
  return (
    <div className={`transport${big ? ' big' : ''}`}>
      <button className={`icon-btn toggle${p.shuffle ? ' on' : ''}`} onClick={p.toggleShuffle} aria-label="Shuffle" aria-pressed={p.shuffle} title="Shuffle (S)">
        <ShuffleIcon size={big ? 24 : 18} />
      </button>
      <button className="icon-btn" onClick={p.prev} aria-label="Previous" title="Previous (P)">
        <PrevIcon size={s} />
      </button>
      <button className="icon-btn" onClick={() => p.skip(-10)} aria-label="Back 10 seconds" title="Back 10s (J)">
        <Back10Icon size={s} />
      </button>
      <button className={`play-btn${p.status === 'loading' && p.playing ? ' busy' : ''}`} onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
        {p.playing ? <PauseIcon size={big ? 34 : 22} /> : <PlayIcon size={big ? 34 : 22} />}
      </button>
      <button className="icon-btn" onClick={() => p.skip(10)} aria-label="Forward 10 seconds" title="Forward 10s (L)">
        <Fwd10Icon size={s} />
      </button>
      <button className="icon-btn" onClick={p.next} aria-label="Next" title="Next (N)">
        <NextIcon size={s} />
      </button>
      <button
        className={`icon-btn toggle${p.repeat !== 'off' ? ' on' : ''}`}
        onClick={p.cycleRepeat}
        aria-label={`Repeat: ${p.repeat}`}
        title={`Repeat ${p.repeat === 'off' ? 'off' : p.repeat === 'all' ? 'all' : 'one'} (R)`}
      >
        <RepeatIcon size={big ? 24 : 18} one={p.repeat === 'one'} />
      </button>
    </div>
  );
}

export function PlayerBar({ player: p, folderName, onOpenPlaylist, onShowShortcuts }: Props) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  if (!p.current) return null;
  const t = p.current;
  const level = p.muted ? 0 : p.volume;
  const isError = p.status === 'error';

  return (
    <>
      <footer className="playerbar" aria-label="Player">
        <div className="mini-progress" style={{ width: `${p.duration ? (p.time / p.duration) * 100 : (p.loadProgress ?? 0) * 100}%` }} />
        <button
          className={`now${onOpenPlaylist ? ' linkable' : ''}`}
          onClick={() => {
            // Phones open the full-screen player; on desktop the track info leads back to its playlist.
            if (matchMedia('(max-width: 760px)').matches) setExpanded(true);
            else onOpenPlaylist?.();
          }}
          aria-label={onOpenPlaylist ? 'Go to playlist' : 'Open now playing'}
          title={onOpenPlaylist ? `Back to ${folderName}` : undefined}
        >
          <Cover name={t.name} size={48} playing={p.playing} />
          <span className="now-text">
            <span className="now-title" title={t.name}>
              {trackTitle(t.name)}
            </span>
            <span className={`now-sub${isError ? ' err' : ''}`}>{statusLine(p, folderName)}</span>
          </span>
        </button>

        <div className="center">
          <Transport p={p} />
          <Scrubber time={p.time} duration={p.duration} buffered={p.buffered} loadProgress={p.loadProgress} onSeek={p.seek} />
        </div>

        <div className="right">
          <button className="icon-btn" onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} title="Mute (M)">
            <VolumeIcon size={20} level={level} />
          </button>
          <input
            type="range"
            className="range volume"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.01}
            value={level}
            style={{ '--pct': `${level * 100}%`, '--buf': '0%' } as CSSProperties}
            onChange={(e) => p.setVolume(Number(e.target.value))}
          />
          <button className="icon-btn" onClick={onShowShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <KeyboardIcon size={20} />
          </button>
        </div>

        <div className="mobile-actions">
          <button className="icon-btn" onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'}>
            {p.playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label="Next">
            <NextIcon size={24} />
          </button>
        </div>
      </footer>

      {expanded && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Now playing">
          <div className="sheet-head">
            <button className="icon-btn" onClick={() => setExpanded(false)} aria-label="Close">
              <ChevronDownIcon size={26} />
            </button>
            <span className="sheet-folder">{folderName}</span>
            {onOpenPlaylist ? (
              <button
                className="icon-btn"
                onClick={() => {
                  setExpanded(false);
                  onOpenPlaylist();
                }}
                aria-label="Go to playlist"
                title="Go to playlist"
              >
                <ListIcon size={24} />
              </button>
            ) : (
              <span style={{ width: 40 }} />
            )}
          </div>
          <div className="sheet-art">
            <Cover name={t.name} size={320} playing={p.playing} />
          </div>
          <div className="sheet-meta">
            <div className="sheet-title">{trackTitle(t.name)}</div>
            <div className={`now-sub${isError ? ' err' : ''}`}>
              <span className="badge">{t.ext}</span> {statusLine(p, folderName)}
            </div>
          </div>
          <Scrubber time={p.time} duration={p.duration} buffered={p.buffered} loadProgress={p.loadProgress} onSeek={p.seek} />
          <Transport p={p} big />
        </div>
      )}
    </>
  );
}
