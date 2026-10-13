import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { formatTime } from '../lib/format';
import { Cover } from './Cover';
import { FolderIcon, Logo, NextIcon, PauseIcon, PrevIcon, RepeatIcon, ShuffleIcon } from './Icons';

// An animated, self-playing mock of the player for the home page: the address bar swaps
// www.dropbox.com for this host, then the folder opens as a playlist and plays through.

// `daysAgo` keeps the Modified column looking fresh: dates are relative to today.
const TRACKS = [
  { name: '115 - PartTimeChiller - House Bass Trax 1.m4a', daysAgo: 1, size: '3.8 MB', len: 214 },
  { name: '100 - PartTimeChiller - Piano Overlord - 201601.mp3', daysAgo: 3, size: '6.7 MB', len: 263 },
  { name: '130 - PartTimeChiller - Nice heat Doyo - 20190420.m4a', daysAgo: 9, size: '1.3 MB', len: 98 },
  { name: '160 - PartTimeChiller - Bonsall pt2 - 20200729.m4a', daysAgo: 16, size: '2.0 MB', len: 151 },
  { name: '140 - PartTimeChiller - Beat Down ii - 20190810.m4a', daysAgo: 27, size: '2.0 MB', len: 147 },
];

function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
const PATH = '/scl/fo/l5541091cnbeiurzrefmz/AIkY6ecnajmAN9cZxAHxHmo?rlkey=28c9ned5qt22pvxdmpaksbgm2';
const CANVAS_W = 960;
const TRACK_MS = 3600;
// Each track is shown from this point in, progressing in real time.
const START = 0.18;

type Phase = 'dropbox' | 'select' | 'typing' | 'load' | 'play';

const title = (n: string) => n.replace(/\.[^.]+$/, '');
const ext = (n: string) => n.split('.').pop()!;

export function HeroPreview() {
  const host = location.host;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<Phase>(reduced ? 'play' : 'dropbox');
  const [typed, setTyped] = useState(reduced ? host.length : 0);
  const [track, setTrack] = useState(0);
  const [elapsed, setElapsed] = useState(reduced ? Math.round(TRACKS[0].len * START) : 0);

  // Timeline: dropbox → select → typing → load → play track 0 → play track 1 → loop.
  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let t = 0;
    const run = () => {
      t = 0;
      at((t += 0), () => {
        setPhase('dropbox');
        setTyped(0);
        setTrack(0);
      });
      at((t += 1500), () => setPhase('select'));
      at((t += 900), () => setPhase('typing'));
      for (let i = 1; i <= host.length; i++) at((t += 70), () => setTyped(i));
      at((t += 450), () => setPhase('load'));
      at((t += 650), () => setPhase('play'));
      at((t += TRACK_MS), () => setTrack(1));
      at((t += TRACK_MS), run);
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [host, reduced]);

  // Fake playback clock while playing.
  useEffect(() => {
    if (phase !== 'play' || reduced) return;
    setElapsed(Math.round(TRACKS[track].len * START));
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, track, reduced]);

  // Render on a fixed-width canvas and scale it to fit, so it looks identical at any width.
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const fit = () => {
      if (!wrap.current || !canvas.current) return;
      const s = wrap.current.clientWidth / CANVAS_W;
      setScale(s);
      setHeight(canvas.current.offsetHeight * s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const opened = phase === 'load' || phase === 'play';
  const playing = phase === 'play';
  const cur = TRACKS[track];

  return (
    <div className="pv-wrap" ref={wrap} style={{ height }} aria-label="Preview: a Dropbox folder link opened in DB Player" role="img">
      <div className="pv" ref={canvas} style={{ transform: `scale(${scale})` }} aria-hidden="true">
        <div className="pv-chrome">
          <span className="pv-dots">
            <i />
            <i />
            <i />
          </span>
          <div className="pv-url">
            <svg className="pv-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            https://
            {phase === 'dropbox' || phase === 'select' ? (
              <span className={`pv-host old${phase === 'select' ? ' sel' : ''}`}>www.dropbox.com</span>
            ) : (
              <span className="pv-host new">
                {host.slice(0, typed)}
                {phase === 'typing' && <span className="pv-caret" />}
              </span>
            )}
            <span className="pv-path">{PATH}</span>
          </div>
        </div>

        <div className={`pv-screen${opened ? ' open' : ''}`}>
          <div className="pv-top">
            <span className="pv-brand">
              <Logo size={22} /> DB Player
            </span>
            <span className="pv-chip">
              <span className="dot" /> Dropbox connected
            </span>
          </div>

          <div className="pv-head">
            <div className="pv-folder">
              <FolderIcon size={30} />
            </div>
            <div>
              <div className="pv-eyebrow">Shared folder</div>
              <div className="pv-title">PartTimeChiller-Demos</div>
              <div className="pv-meta">51 tracks · 278 MB</div>
            </div>
          </div>

          <div className="pv-list">
            <div className="pv-cols">
              <span>#</span>
              <span>Name</span>
              <span className="on">Modified ⌄</span>
              <span>Size</span>
            </div>
            {TRACKS.map((t, i) => {
              const active = playing && i === track;
              return (
                <div key={t.name} className={`pv-row${active ? ' active' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="pv-n">
                    {active ? (
                      <span className="eq">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="pv-name">
                    <Cover name={t.name} size={30} />
                    <span className="pv-tname">{title(t.name)}</span>
                    <span className="badge">{ext(t.name)}</span>
                  </span>
                  <span className="pv-dim">{recentDate(t.daysAgo)}</span>
                  <span className="pv-dim pv-size">{t.size}</span>
                </div>
              );
            })}
          </div>

          <div className={`pv-bar${playing ? ' show' : ''}`}>
            <span className="pv-now">
              <Cover name={cur.name} size={38} playing={playing} />
              <span>
                <span className="pv-ntitle">{title(cur.name)}</span>
                <span className="pv-nsub">PartTimeChiller-Demos · {track + 1} of 51</span>
              </span>
            </span>
            <span className="pv-ctl">
              <span className="pv-transport">
                <ShuffleIcon size={15} />
                <PrevIcon size={17} />
                <span className="pv-play">
                  <PauseIcon size={16} />
                </span>
                <NextIcon size={17} />
                <RepeatIcon size={15} />
              </span>
              <span className="pv-prog">
                <span>{formatTime(elapsed)}</span>
                <span className="pv-track">
                  <span
                    key={`${track}-${phase}`}
                    className="pv-fill"
                    style={
                      {
                        animationDuration: `${TRACK_MS}ms`,
                        '--from': `${START * 100}%`,
                        '--to': `${(START + TRACK_MS / 1000 / cur.len) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </span>
                <span>{formatTime(cur.len)}</span>
              </span>
            </span>
          </div>
        </div>

        {!opened && (
          <div className="pv-hint">
            <span className="pv-hint-card">
              Replace <b className="hl-old">www.dropbox.com</b> with <b className="hl-new">{host}</b>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
