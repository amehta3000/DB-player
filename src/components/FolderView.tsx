import { memo, useMemo, useState, type PointerEvent } from 'react';
import type { Entry, Listing, Track } from '../lib/dropboxApi';
import { formatBytes, formatDate, formatTime, trackTitle } from '../lib/format';
import { Cover } from './Cover';
import { CheckIcon, ChevronIcon, ExternalIcon, FolderIcon, LinkIcon, PauseIcon, PlayIcon, ResumeIcon, SearchIcon, ShuffleIcon } from './Icons';

type SortKey = 'name' | 'modified' | 'size';
interface Sort {
  key: SortKey;
  dir: 1 | -1;
}

const SORT_KEY = 'dbp.sort';
// First click on a column: names A→Z, but newest and biggest first.
const DEFAULT_DIR: Record<SortKey, 1 | -1> = { name: 1, modified: -1, size: -1 };
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function readSort(): Sort {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null');
    if (s && ['name', 'modified', 'size'].includes(s.key) && (s.dir === 1 || s.dir === -1)) return s;
  } catch {
    /* ignore */
  }
  return { key: 'name', dir: 1 };
}

function compareTracks(a: Track, b: Track, { key, dir }: Sort): number {
  if (key !== 'name') {
    const av = key === 'size' ? a.size : a.modified;
    const bv = key === 'size' ? b.size : b.modified;
    // Missing values always sink to the bottom, whichever direction.
    if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
    if (av !== bv) return (av < bv ? -1 : 1) * dir;
  }
  return collator.compare(a.name, b.name) * (key === 'name' ? dir : 1);
}

function SortButton({ k, label, sort, onSort, className }: { k: SortKey; label: string; sort: Sort; onSort(k: SortKey): void; className: string }) {
  const active = sort.key === k;
  return (
    <span className={className} role="columnheader" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={`sort-btn${active ? ' on' : ''}`} onClick={() => onSort(k)} title={`Sort by ${label.toLowerCase()}`}>
        {label}
        <ChevronIcon size={13} className="sort-arrow" style={{ transform: `rotate(${active && sort.dir === 1 ? -90 : 90}deg)` }} />
      </button>
    </span>
  );
}

export interface Resume {
  track: Track;
  time: number;
}

interface Props {
  listing: Listing | null;
  loading: boolean;
  error: string | null;
  path: string;
  dropboxUrl: string;
  currentId: string | null;
  playing: boolean;
  resume: Resume | null;
  onOpenFolder(path: string): void;
  onPlay(tracks: Track[], index: number, opts?: { shuffle?: boolean; startAt?: number }): void;
  onToggle(): void;
  onResume(): void;
  onShare(): Promise<void>;
}

function Breadcrumbs({ root, path, onOpen }: { root: string; path: string; onOpen(p: string): void }) {
  const segs = path.split('/').filter(Boolean);
  if (!segs.length) return null;
  return (
    <nav className="crumbs" aria-label="Folder path">
      <button onClick={() => onOpen('')}>{root}</button>
      {segs.map((s, i) => {
        const p = '/' + segs.slice(0, i + 1).join('/');
        const last = i === segs.length - 1;
        return (
          <span key={p} className="crumb">
            <ChevronIcon size={14} />
            {last ? <span aria-current="page">{s}</span> : <button onClick={() => onOpen(p)}>{s}</button>}
          </span>
        );
      })}
    </nav>
  );
}

// Clicked rows shouldn't keep a focus ring once keyboard shortcuts are used; keyboard focus is unaffected.
const blurOnPointer = (e: PointerEvent<HTMLButtonElement>) => e.currentTarget.blur();

const Row = memo(function Row({
  entry,
  n,
  active,
  playing,
  onClick,
}: {
  entry: Entry;
  n: number;
  active: boolean;
  playing: boolean;
  onClick(): void;
}) {
  if (entry.kind === 'folder') {
    return (
      <li>
        <button className="row folder-row" onClick={onClick} onPointerUp={blurOnPointer}>
          <span className="col-n">
            <FolderIcon size={22} className="folder-glyph" />
          </span>
          <span className="col-name">
            <span className="name">{entry.name}</span>
          </span>
          <span className="col-date" />
          <span className="col-size">
            <ChevronIcon size={16} />
          </span>
        </button>
      </li>
    );
  }
  return (
    <li>
      <button className={`row track-row${active ? ' active' : ''}`} onClick={onClick} onPointerUp={blurOnPointer} aria-current={active ? 'true' : undefined}>
        <span className="col-n">
          {active && playing ? (
            <span className="eq" aria-label="Playing">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <>
              <span className="num">{n}</span>
              <PlayIcon size={16} className="row-play" />
            </>
          )}
        </span>
        <span className="col-name">
          <Cover name={entry.name} size={36} />
          <span className="name" title={entry.name}>
            {trackTitle(entry.name)}
          </span>
          <span className="badge">{entry.ext}</span>
        </span>
        <span className="col-date">{formatDate(entry.modified)}</span>
        <span className="col-size">{formatBytes(entry.size)}</span>
      </button>
    </li>
  );
});

export const FolderView = memo(function FolderView(props: Props) {
  const { listing, loading, error, path, dropboxUrl, currentId, playing, resume } = props;
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState(readSort);

  const onSort = (key: SortKey) => {
    const next: Sort = { key, dir: sort.key === key ? (-sort.dir as 1 | -1) : DEFAULT_DIR[key] };
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // Folders stay on top (by name); tracks follow the chosen sort, which is also the play order.
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = listing?.entries ?? [];
    const shown = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
    const dirs = shown.filter((e) => e.kind === 'folder');
    const files = shown.filter((e): e is Track => e.kind === 'track').sort((a, b) => compareTracks(a, b, sort));
    return [...dirs, ...files];
  }, [listing, query, sort]);
  const tracks = useMemo(() => entries.filter((e): e is Track => e.kind === 'track'), [entries]);
  const folders = entries.length - tracks.length;
  const totalSize = tracks.reduce((s, t) => s + (t.size ?? 0), 0);
  const name = path ? path.split('/').pop()! : (listing?.name ?? '');
  const currentHere = tracks.some((t) => t.id === currentId);

  const share = async () => {
    await props.onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (error) {
    return (
      <section className="panel state">
        <h2>Couldn’t open this folder</h2>
        <p>{error}</p>
        <a className="btn secondary" href={dropboxUrl} target="_blank" rel="noreferrer">
          Open in Dropbox <ExternalIcon size={16} />
        </a>
      </section>
    );
  }

  return (
    <section className="folder">
      <header className="folder-head">
        {listing && <Breadcrumbs root={listing.name} path={path} onOpen={props.onOpenFolder} />}
        <div className="folder-title-row">
          <div className="folder-art">
            <FolderIcon size={44} />
          </div>
          <div className="folder-titles">
            <span className="eyebrow">Shared folder</span>
            <h1>{loading && !listing ? <span className="skeleton" style={{ width: 220 }} /> : name}</h1>
            <p className="meta">
              {listing ? (
                <>
                  {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
                  {folders > 0 && ` · ${folders} ${folders === 1 ? 'folder' : 'folders'}`}
                  {totalSize > 0 && ` · ${formatBytes(totalSize)}`}
                </>
              ) : (
                'Reading folder…'
              )}
            </p>
          </div>
        </div>

        <div className="actions">
          <button
            className="btn primary"
            disabled={!tracks.length}
            onClick={() => (currentHere ? props.onToggle() : props.onPlay(tracks, 0))}
          >
            {currentHere && playing ? (
              <>
                <PauseIcon size={18} /> Pause
              </>
            ) : (
              <>
                <PlayIcon size={18} /> {currentHere ? 'Resume' : 'Play all'}
              </>
            )}
          </button>
          <button className="btn secondary" disabled={tracks.length < 2} onClick={() => props.onPlay(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true })}>
            <ShuffleIcon size={18} /> Shuffle
          </button>
          {resume && !currentId && (
            <button className="btn ghost resume" onClick={props.onResume}>
              <ResumeIcon size={18} /> Pick up “{trackTitle(resume.track.name)}” at {formatTime(resume.time)}
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={share} title="Copy a player link to share">
            {copied ? <CheckIcon size={18} /> : <LinkIcon size={18} />} <span className="hide-sm">{copied ? 'Copied' : 'Copy link'}</span>
          </button>
          <a className="btn ghost" href={dropboxUrl} target="_blank" rel="noreferrer" title="Open in Dropbox">
            <ExternalIcon size={18} /> <span className="hide-sm">Dropbox</span>
          </a>
        </div>
      </header>

      <div className="panel list-panel">
        <div className="list-tools">
          <label className="search">
            <SearchIcon size={18} />
            <input type="search" placeholder="Filter tracks" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter tracks" />
          </label>
        </div>
        <div className="list-head" role="row">
          <span className="col-n" aria-hidden="true">#</span>
          <SortButton k="name" label="Name" sort={sort} onSort={onSort} className="col-name" />
          <SortButton k="modified" label="Modified" sort={sort} onSort={onSort} className="col-date" />
          <SortButton k="size" label="Size" sort={sort} onSort={onSort} className="col-size" />
        </div>
        {loading && !listing ? (
          <ul className="rows">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="row skeleton-row">
                <span className="skeleton" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
              </li>
            ))}
          </ul>
        ) : entries.length ? (
          <ul className="rows">
            {entries.map((e) => {
              const ti = e.kind === 'track' ? tracks.indexOf(e) : -1;
              return (
                <Row
                  key={e.id}
                  entry={e}
                  n={ti + 1}
                  active={e.id === currentId}
                  playing={playing}
                  onClick={() => (e.kind === 'folder' ? props.onOpenFolder(e.path) : e.id === currentId ? props.onToggle() : props.onPlay(tracks, ti))}
                />
              );
            })}
          </ul>
        ) : (
          <div className="empty">{query ? `No tracks match “${query}”.` : 'No audio files in this folder.'}</div>
        )}
      </div>
    </section>
  );
});
