import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectGate } from './components/ConnectGate';
import { FolderView, type Resume } from './components/FolderView';
import { Landing } from './components/Landing';
import { Logo } from './components/Icons';
import { PlayerBar } from './components/PlayerBar';
import { Shortcuts } from './components/Shortcuts';
import { completeConnect, disconnect, isConnected } from './lib/auth';
import type { Listing, Track } from './lib/dropboxApi';
import { linkFromLocation, playerUrlFor, type SharedLink } from './lib/link';
import { connectedSource, demoSource, guestAvailable, guestSource, singleFileListing, type Source } from './lib/sources';
import { usePlayer } from './lib/usePlayer';

const DEMO_LINK: SharedLink = { url: 'https://www.dropbox.com/scl/fo/demo', kind: 'folder' };

function snapshot() {
  const q = new URLSearchParams(location.search);
  const demo = q.has('demo');
  return {
    demo,
    link: demo ? DEMO_LINK : linkFromLocation(location),
    path: q.get('p') ?? '',
  };
}

function resumeKey(link: SharedLink) {
  return `dbp.resume:${link.url}`;
}

function readResume(link: SharedLink): Resume | null {
  try {
    const r = JSON.parse(localStorage.getItem(resumeKey(link)) ?? 'null') as Resume | null;
    return r && r.track && r.time > 5 ? r : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [loc, setLoc] = useState(snapshot);
  const [booted, setBooted] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [rootName, setRootName] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const listCache = useRef(new Map<string, Listing>());

  const { link, path, demo } = loc;
  const effectiveSource = source ?? (link?.kind === 'file' ? guestSource : null);
  const player = usePlayer(effectiveSource, link, rootName);

  const navigate = useCallback((url: string, replace = false) => {
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    setLoc(snapshot());
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setLoc(snapshot());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Boot: finish an OAuth redirect if this is one, then pick how to reach Dropbox.
  useEffect(() => {
    (async () => {
      try {
        const back = await completeConnect();
        if (back) navigate(back, true);
      } catch (e) {
        console.error(e);
        navigate('/', true);
      }
      const s = snapshot();
      setSource(s.demo ? demoSource : isConnected() ? connectedSource : (await guestAvailable()) ? guestSource : null);
      setBooted(true);
    })();
  }, [navigate]);

  // Load the folder listing.
  const linkUrl = link?.url;
  useEffect(() => {
    if (!booted || !link) return;
    if (link.kind === 'file') {
      const l = singleFileListing(link);
      setListing(l);
      setRootName(l.name);
      return;
    }
    if (!source) return;
    const key = `${link.url}|${path}`;
    const cached = listCache.current.get(key);
    setListError(null);
    setListing(cached ?? null);
    setListLoading(!cached);
    let alive = true;
    source
      .list(link, path)
      .then((l) => {
        if (!alive) return;
        listCache.current.set(key, l);
        setListing(l);
        setRootName(l.name);
      })
      .catch((e) => alive && !cached && setListError(e instanceof Error ? e.message : 'Something went wrong'))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, source, linkUrl, path]);

  useEffect(() => {
    if (!player.current) document.title = rootName ? `${rootName} · DB Player` : 'DB Player';
  }, [rootName, player.current]);

  // Remember where we were, per shared link.
  const resume = useMemo(() => (link && booted ? readResume(link) : null), [link, booted]);
  const saveTick = Math.floor(player.time / 5);
  useEffect(() => {
    if (!link || !player.current || demo) return;
    try {
      localStorage.setItem(resumeKey(link), JSON.stringify({ track: player.current, time: player.time } satisfies Resume));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.current, saveTick]);

  const { playQueue, toggle } = player;
  const onPlay = useCallback(
    (tracks: Track[], index: number, opts?: { shuffle?: boolean; startAt?: number }) => playQueue(tracks, index, opts?.startAt, opts?.shuffle),
    [playQueue],
  );

  const onResume = useCallback(() => {
    if (!resume) return;
    const tracks = (listing?.entries ?? []).filter((e): e is Track => e.kind === 'track');
    const i = tracks.findIndex((t) => t.id === resume.track.id);
    if (i >= 0) playQueue(tracks, i, resume.time);
    else playQueue([resume.track], 0, resume.time);
  }, [listing, playQueue, resume]);

  const onOpenFolder = useCallback(
    (p: string) => {
      const u = new URL(location.href);
      if (p) u.searchParams.set('p', p);
      else u.searchParams.delete('p');
      navigate(u.pathname + u.search + u.hash);
    },
    [navigate],
  );

  const onShare = useCallback(async () => {
    let url = location.href;
    if (link && !demo) {
      url = playerUrlFor(link, location.origin);
      if (path) url += `${url.includes('?') ? '&' : '?'}p=${encodeURIComponent(path)}`;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link', url);
    }
  }, [link, demo, path]);

  // Keyboard shortcuts.
  const keyRef = useRef(player);
  keyRef.current = player;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('input, textarea, select, [contenteditable]') && !(t instanceof HTMLInputElement && t.type === 'range')) return;
      const p = keyRef.current;
      if (e.key === '?') return setShowKeys((s) => !s);
      if (e.key === 'Escape') return setShowKeys(false);
      if (!p.current) return;
      const k = e.key.toLowerCase();
      const act: Record<string, () => void> = {
        ' ': p.toggle,
        k: p.toggle,
        j: () => p.skip(-10),
        l: () => p.skip(10),
        arrowleft: () => p.skip(-5),
        arrowright: () => p.skip(5),
        n: p.next,
        p: p.prev,
        s: p.toggleShuffle,
        r: p.cycleRepeat,
        m: p.toggleMute,
        arrowup: () => p.setVolume(p.volume + 0.1),
        arrowdown: () => p.setVolume(p.volume - 0.1),
      };
      let fn = act[k];
      if (!fn && /^[0-9]$/.test(k) && p.duration) fn = () => p.seek((Number(k) / 10) * p.duration);
      if (!fn) return;
      // Let buttons keep Space/Enter for themselves only when they aren't player controls.
      if (k === ' ' && t instanceof HTMLButtonElement) t.blur();
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let body;
  if (!link) body = <Landing onOpen={(url) => navigate(url)} />;
  else if (!booted) body = <main className="boot" aria-busy="true" />;
  else if (!effectiveSource) body = <ConnectGate dropboxUrl={link.url} />;
  else
    body = (
      <main className="main">
        <FolderView
          listing={listing}
          loading={listLoading}
          error={listError}
          path={path}
          dropboxUrl={link.url}
          currentId={player.current?.id ?? null}
          playing={player.playing}
          resume={resume}
          onOpenFolder={onOpenFolder}
          onPlay={onPlay}
          onToggle={toggle}
          onResume={onResume}
          onShare={onShare}
        />
      </main>
    );

  return (
    <div className={`app${player.current ? ' has-player' : ''}`}>
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <Logo />
          <span>DB Player</span>
        </a>
        <div className="topbar-right">
          {source?.mode === 'demo' && <span className="chip">Demo</span>}
          {source?.mode === 'guest' && <span className="chip">Guest mode</span>}
          {source?.mode === 'connected' && (
            <button
              className="chip chip-btn"
              title="Disconnect Dropbox from this browser"
              onClick={() => {
                disconnect();
                location.reload();
              }}
            >
              <span className="dot" /> Dropbox connected
            </button>
          )}
        </div>
      </header>

      {body}

      {!player.current && (
        <footer className="site-foot">
          DB Player is an independent tool and isn’t affiliated with or endorsed by Dropbox, Inc. Files stream from Dropbox to your browser.
        </footer>
      )}

      <PlayerBar player={player} folderName={rootName} onShowShortcuts={() => setShowKeys(true)} />
      {showKeys && <Shortcuts onClose={() => setShowKeys(false)} />}
    </div>
  );
}
