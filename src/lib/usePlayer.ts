import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiffToWav, browserPlaysAiff } from './aiff';
import { isAiff, type Track } from './dropboxApi';
import type { SharedLink } from './link';
import type { Source } from './sources';

export type Repeat = 'off' | 'all' | 'one';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const VOLUME_KEY = 'dbp.volume';

function shuffled(n: number, first: number): number[] {
  const rest = [...Array(n).keys()].filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 ? [first, ...rest] : rest;
}

/** Queue position after `pos`, or null at the end of the queue (when not repeating). */
export function nextPos(length: number, pos: number, repeat: Repeat, fromEnded: boolean): number | null {
  if (!length) return null;
  const p = pos + 1;
  if (p < length) return p;
  return repeat === 'all' || !fromEnded ? 0 : null;
}

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export interface Player {
  queue: Track[];
  current: Track | null;
  index: number;
  playing: boolean;
  time: number;
  duration: number;
  buffered: number;
  status: LoadStatus;
  /** Download progress (0–1) while a whole file is being fetched, e.g. AIFF in Chrome. */
  loadProgress: number | null;
  error: string | null;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  playQueue(tracks: Track[], start: number, startAt?: number, shuffle?: boolean): void;
  playIndex(i: number): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(t: number): void;
  skip(dt: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
}

export function usePlayer(source: Source | null, link: SharedLink | null, albumName = ''): Player {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }
  const audio = audioRef.current!;

  const [queue, setQueue] = useState<Track[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off');
  // Bumped whenever a track should (re)load; reordering the queue alone must not reload.
  const [loadNonce, setLoadNonce] = useState(0);

  const index = pos >= 0 ? (order[pos] ?? -1) : -1;
  const current = index >= 0 ? (queue[index] ?? null) : null;

  const seq = useRef(0);
  const blobUrls = useRef(new Map<string, string>()); // track id -> object URL (most recent last)
  const fellBack = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  // The source and link the current queue came from (the page may have moved on since).
  const ctx = useRef({ source, link });
  const playsAiff = useMemo(() => (typeof document !== 'undefined' ? browserPlaysAiff() : true), []);

  const rememberBlob = useCallback((id: string, url: string) => {
    const m = blobUrls.current;
    m.delete(id);
    m.set(id, url);
    while (m.size > 3) {
      const [oldId, oldUrl] = m.entries().next().value!;
      if (oldUrl === audio.src) break;
      URL.revokeObjectURL(oldUrl);
      m.delete(oldId);
    }
  }, [audio]);

  /** Download the whole file (converting AIFF if needed) and return a blob URL. */
  const blobUrlFor = useCallback(
    async (track: Track, mySeq: number | null): Promise<string> => {
      const cached = blobUrls.current.get(track.id);
      if (cached) return cached;
      const { source, link } = ctx.current;
      // mySeq null = background prefetch for the next track: no progress shown.
      if (mySeq != null) setLoadProgress(0);
      let blob = await source!.download(link!, track, (p) => mySeq != null && mySeq === seq.current && setLoadProgress(p));
      if (isAiff(track.name) && !playsAiff) {
        blob = new Blob([aiffToWav(await blob.arrayBuffer())], { type: 'audio/wav' });
      }
      const url = URL.createObjectURL(blob);
      rememberBlob(track.id, url);
      return url;
    },
    [playsAiff, rememberBlob],
  );

  const load = useCallback(
    async (track: Track, autoplay: boolean, startAt = 0) => {
      const { source, link } = ctx.current;
      if (!source || !link) return;
      const mySeq = ++seq.current;
      audio.pause();
      setStatus('loading');
      setError(null);
      setLoadProgress(null);
      setTime(startAt);
      setDuration(0);
      setBuffered(0);
      fellBack.current = false;
      pendingSeek.current = startAt > 0 ? startAt : null;
      try {
        const needsDownload = isAiff(track.name) && !playsAiff;
        const src = needsDownload ? await blobUrlFor(track, mySeq) : (blobUrls.current.get(track.id) ?? (await source.streamUrl(link, track)));
        if (mySeq !== seq.current) return;
        fellBack.current = needsDownload || src.startsWith('blob:');
        audio.src = src;
        setLoadProgress(null);
        if (autoplay) {
          await audio.play().catch((e: unknown) => {
            // Autoplay blocked (e.g. resume on page load): stay paused, ready to go.
            if (e instanceof DOMException && e.name === 'NotAllowedError') setPlaying(false);
            else if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
          });
        }
      } catch (e) {
        if (mySeq !== seq.current) return;
        setStatus('error');
        setLoadProgress(null);
        setError(e instanceof Error ? e.message : 'Couldn’t play this file');
        setPlaying(false);
      }
    },
    [audio, blobUrlFor, playsAiff],
  );

  // Next-track hand-off. Mobile browsers freeze a locked or backgrounded page's timers as
  // soon as audio stops, so anything async after `ended` (React effects, fetching a URL)
  // may never run. The next track's URL is resolved ahead of time and swapped in
  // synchronously inside the `ended` handler, keeping audio going without a gap.
  const prepared = useRef<{ id: string; url: string; at: number } | null>(null);
  const preparing = useRef<string | null>(null);
  const handedOff = useRef<string | null>(null);
  const live = useRef({ order, pos, queue, repeat });
  live.current = { order, pos, queue, repeat };

  const prepareNext = useCallback(async () => {
    const { order, pos, queue, repeat } = live.current;
    const p = nextPos(order.length, pos, repeat, true);
    if (p == null || p === pos) return;
    const track = queue[order[p]];
    if (!track || preparing.current === track.id) return;
    const ready = prepared.current;
    // Stream URLs embed an access token; refresh one that's been sitting a while.
    if (ready?.id === track.id && (ready.url.startsWith('blob:') || Date.now() - ready.at < 5 * 60_000)) return;
    const { source, link } = ctx.current;
    if (!source || !link) return;
    preparing.current = track.id;
    try {
      const url =
        blobUrls.current.get(track.id) ??
        (isAiff(track.name) && !playsAiff ? await blobUrlFor(track, null) : await source.streamUrl(link, track));
      prepared.current = { id: track.id, url, at: Date.now() };
    } catch {
      /* fall back to a normal load when the track comes up */
    } finally {
      preparing.current = null;
    }
  }, [blobUrlFor, playsAiff]);
  const prepareRef = useRef(prepareNext);
  prepareRef.current = prepareNext;

  /** Start queue position p right now if its URL is ready. Returns false if it isn't. */
  const handOff = useCallback(
    (p: number): boolean => {
      const { order, queue } = live.current;
      const track = queue[order[p]];
      const ready = prepared.current;
      if (!track || !ready || ready.id !== track.id) return false;
      prepared.current = null;
      ++seq.current;
      fellBack.current = ready.url.startsWith('blob:');
      pendingSeek.current = null;
      audio.src = ready.url;
      audio.play().catch(() => {});
      handedOff.current = track.id;
      setTime(0);
      setDuration(0);
      setBuffered(0);
      setError(null);
      setLoadProgress(null);
      setStatus('loading');
      setPos(p);
      return true;
    },
    [audio],
  );

  // Load whenever the current track changes.
  const startAtRef = useRef(0);
  const autoplayRef = useRef(true);
  useEffect(() => {
    if (current && handedOff.current === current.id) {
      // `ended` already started this track; don't interrupt it.
      handedOff.current = null;
    } else if (current) load(current, autoplayRef.current, startAtRef.current);
    startAtRef.current = 0;
    autoplayRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, loadNonce]);

  const advance = useCallback(
    (dir: 1 | -1, fromEnded = false) => {
      if (!order.length) return;
      let p = pos + dir;
      if (p >= order.length) {
        if (repeat === 'all' || !fromEnded) p = 0;
        else {
          setPlaying(false);
          audio.currentTime = 0;
          return;
        }
      }
      if (p < 0) p = repeat === 'all' ? order.length - 1 : 0;
      if (p === pos) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else setPos(p);
    },
    [audio, order.length, pos, repeat],
  );

  const next = useCallback(() => {
    const p = nextPos(order.length, pos, repeat, false);
    if (p == null || p === pos || !handOff(p)) advance(1);
  }, [advance, handOff, order.length, pos, repeat]);
  const prev = useCallback(() => {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else advance(-1);
  }, [advance, audio]);

  // Audio element events.
  const onEnded = useRef<() => void>(() => {});
  onEnded.current = () => {
    if (repeat === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    const p = nextPos(order.length, pos, repeat, true);
    if (p == null || p === pos || !handOff(p)) advance(1, true);
  };
  useEffect(() => {
    const updateBuffered = () => {
      const b = audio.buffered;
      setBuffered(b.length ? b.end(b.length - 1) : 0);
    };
    const handlers: Record<string, () => void> = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      playing: () => {
        setStatus('ready');
        // Whole-file downloads (AIFF) take a while, so start those early.
        const { order, pos, queue, repeat } = live.current;
        const p = nextPos(order.length, pos, repeat, true);
        const nextTrack = p == null ? null : queue[order[p]];
        if (nextTrack && isAiff(nextTrack.name)) prepareRef.current();
      },
      canplay: () => setStatus((s) => (s === 'loading' ? 'ready' : s)),
      waiting: () => setStatus('loading'),
      timeupdate: () => {
        setTime(audio.currentTime);
        if (Number.isFinite(audio.duration) && audio.duration - audio.currentTime < 30) prepareRef.current();
      },
      durationchange: () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0),
      loadedmetadata: () => {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        if (pendingSeek.current != null) {
          audio.currentTime = pendingSeek.current;
          pendingSeek.current = null;
        }
      },
      progress: updateBuffered,
      ended: () => onEnded.current(),
      error: () => {
        if (!audio.src || audio.src === location.href) return;
        const track = currentRef.current;
        // Streaming failed (format, auth, or range support): fall back to a full download once.
        if (track && !fellBack.current) {
          fellBack.current = true;
          const mySeq = ++seq.current;
          const at = audio.currentTime;
          setStatus('loading');
          blobUrlFor(track, mySeq)
            .then((url) => {
              if (mySeq !== seq.current) return;
              pendingSeek.current = at || null;
              audio.src = url;
              setLoadProgress(null);
              return audio.play();
            })
            .catch((e) => {
              if (mySeq !== seq.current) return;
              setStatus('error');
              setLoadProgress(null);
              setError(e instanceof Error ? e.message : 'Couldn’t play this file');
            });
          return;
        }
        setStatus('error');
        setPlaying(false);
        setError('This file couldn’t be played in your browser.');
      },
    };
    for (const [ev, fn] of Object.entries(handlers)) audio.addEventListener(ev, fn);
    return () => {
      for (const [ev, fn] of Object.entries(handlers)) audio.removeEventListener(ev, fn);
    };
  }, [audio, blobUrlFor]);

  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    audio.volume = volume;
    audio.muted = muted;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* ignore */
    }
  }, [audio, volume, muted]);

  const playQueue = useCallback(
    (tracks: Track[], start: number, startAt = 0, shuffleTo?: boolean) => {
      ctx.current = { source, link };
      startAtRef.current = startAt;
      autoplayRef.current = true;
      setQueue(tracks);
      const sh = shuffleTo ?? shuffle;
      if (shuffleTo != null) setShuffle(shuffleTo);
      const o = sh ? shuffled(tracks.length, start) : [...tracks.keys()];
      setOrder(o);
      setPos(o.indexOf(start));
      setLoadNonce((n) => n + 1);
    },
    [shuffle, source, link],
  );

  const playIndex = useCallback(
    (i: number) => {
      setPos(order.indexOf(i));
      setLoadNonce((n) => n + 1);
    },
    [order],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (status === 'error') load(current, true, 0);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [audio, current, load, status]);

  const seek = useCallback(
    (t: number) => {
      const d = Number.isFinite(audio.duration) ? audio.duration : duration;
      const clamped = Math.max(0, Math.min(d || 0, t));
      audio.currentTime = clamped;
      setTime(clamped);
    },
    [audio, duration],
  );
  const skip = useCallback((dt: number) => seek(audio.currentTime + dt), [audio, seek]);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const nextS = !s;
      if (queue.length) {
        const o = nextS ? shuffled(queue.length, index) : [...queue.keys()];
        // Keep the current track playing; only the order of what follows changes.
        setOrder(o);
        setPos(Math.max(0, o.indexOf(index)));
      }
      return nextS;
    });
  }, [index, queue]);

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);
  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
    setMuted(false);
  }, []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  // Lock-screen / headphone controls.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const set = (a: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, fn);
      } catch {
        /* unsupported action */
      }
    };
    set('play', () => audio.play().catch(() => {}));
    set('pause', () => audio.pause());
    set('nexttrack', next);
    set('previoustrack', prev);
    set('seekbackward', (d) => skip(-(d.seekOffset ?? 10)));
    set('seekforward', (d) => skip(d.seekOffset ?? 10));
    set('seekto', (d) => d.seekTime != null && seek(d.seekTime));
  }, [audio, next, prev, seek, skip]);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || !current || typeof MediaMetadata === 'undefined') return;
    ms.metadata = new MediaMetadata({
      title: current.name.replace(/\.[^.]+$/, ''),
      artist: current.path.split('/').slice(-2, -1)[0] || albumName,
      album: albumName,
      artwork: [{ src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml' }],
    });
  }, [current, albumName]);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms?.setPositionState || !duration) return;
    try {
      ms.setPositionState({ duration, position: Math.min(time, duration), playbackRate: 1 });
    } catch {
      /* ignore */
    }
  }, [time, duration]);

  // Keep the tab title in sync, like a music app.
  useEffect(() => {
    if (current) document.title = `${playing ? '▶ ' : ''}${current.name.replace(/\.[^.]+$/, '')} · DB Player`;
  }, [current, playing]);

  return {
    queue,
    current,
    index,
    playing,
    time,
    duration,
    buffered,
    status,
    loadProgress,
    error,
    volume,
    muted,
    shuffle,
    repeat,
    playQueue,
    playIndex,
    toggle,
    next,
    prev,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  };
}
