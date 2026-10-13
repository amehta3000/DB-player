import { useState, type FormEvent } from 'react';
import { trackTitle } from '../lib/format';
import { parseSharedLink, playerUrlFor } from '../lib/link';
import { timeAgo, type RecentFolder } from '../lib/recent';
import { HeroPreview } from './HeroPreview';
import { ChevronIcon, CloseIcon, FolderIcon, KeyboardIcon, PlayIcon } from './Icons';

interface Props {
  onOpen(url: string): void;
  recent: RecentFolder[];
  onForget(linkUrl: string): void;
  nowPlaying: { folder: string; track: string; onBack(): void } | null;
}

export function Landing({ onOpen, recent, onForget, nowPlaying }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const host = location.host;
  const bookmarklet = `javascript:location.href='${location.origin}/?url='+encodeURIComponent(location.href)`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const link = parseSharedLink(value);
    if (!link) {
      setError('That doesn’t look like a Dropbox shared link. It should start with https://www.dropbox.com/scl/…');
      return;
    }
    onOpen(playerUrlFor(link, location.origin));
  };

  return (
    <main className="landing">
      <section className="hero">
        <span className="eyebrow">For producers on the go</span>
        <h1>
          Every Dropbox folder,
          <br />
          <span className="accent">a playlist.</span>
        </h1>
        <p className="lede">
          Paste a shared folder link and listen straight through — skip, scrub, shuffle and loop your bounces without opening files one by one. MP3, WAV and
          AIFF.
        </p>

        <form className="open-form" onSubmit={submit}>
          <input
            type="url"
            inputMode="url"
            placeholder="https://www.dropbox.com/scl/fo/…"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError('');
            }}
            aria-label="Dropbox shared link"
            autoFocus
          />
          <button className="btn primary" type="submit">
            <PlayIcon size={18} /> Open player
          </button>
        </form>
        {error ? <p className="form-error">{error}</p> : <p className="hint">
          No link handy? <a href="/?demo">Try the demo folder</a>.
        </p>}

        {(nowPlaying || recent.length > 0) && (
          <div className="recent">
            {nowPlaying && (
              <button className="now-card" onClick={nowPlaying.onBack}>
                <span className="eq" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="now-card-text">
                  <span className="now-card-label">Now playing · {nowPlaying.folder}</span>
                  <span className="now-card-track">{trackTitle(nowPlaying.track)}</span>
                </span>
                <span className="now-card-go">
                  Back to playlist <ChevronIcon size={16} />
                </span>
              </button>
            )}
            {recent.length > 0 && (
              <>
                <h2 className="recent-title">Recent folders</h2>
                <ul className="recent-list">
                  {recent.map((r) => (
                    <li key={r.linkUrl}>
                      <a
                        className="recent-item"
                        href={r.href}
                        onClick={(e) => {
                          e.preventDefault();
                          onOpen(r.href);
                        }}
                      >
                        <FolderIcon size={22} className="folder-glyph" />
                        <span className="recent-name">{r.name}</span>
                        <span className="recent-when">{timeAgo(r.at)}</span>
                      </a>
                      <button className="recent-x" onClick={() => onForget(r.linkUrl)} aria-label={`Remove ${r.name} from recent folders`} title="Remove">
                        <CloseIcon size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <section className="preview">
        <HeroPreview />
      </section>

      <section className="tips">
        <article className="tip">
          <span className="tip-n">1</span>
          <h3>Swap the domain</h3>
          <p>
            In any Dropbox shared link, replace <b className="hl-old">www.dropbox.com</b> with <b className="hl-new">{host}</b>. Keep the rest of the
            link the same.
          </p>
          <div className="swap" aria-hidden="true">
            <span className="swap-label">Dropbox link</span>
            <code className="swap-line">
              https://<mark className="old">www.dropbox.com</mark>/scl/fo/…
            </code>
            <span className="swap-arrow">↓</span>
            <span className="swap-label">Player link</span>
            <code className="swap-line">
              https://<mark className="new">{host}</mark>/scl/fo/…
            </code>
          </div>
        </article>
        <article className="tip">
          <span className="tip-n">2</span>
          <h3>One-click bookmark</h3>
          <p>Drag this to your bookmarks bar, then click it on any Dropbox folder page.</p>
          {/* React blocks javascript: hrefs in JSX, so the bookmarklet is set on the DOM node. */}
          <a className="bookmarklet" ref={(el) => el?.setAttribute('href', bookmarklet)} onClick={(e) => e.preventDefault()} draggable>
            <PlayIcon size={14} /> Open in DB Player
          </a>
        </article>
        <article className="tip">
          <span className="tip-n">3</span>
          <h3>Hands on the keys</h3>
          <p>
            <kbd>Space</kbd> play · <kbd>J</kbd>/<kbd>L</kbd> ±10s · <kbd>N</kbd>/<kbd>P</kbd> next/prev · <kbd>0</kbd>–<kbd>9</kbd> jump
          </p>
          <span className="tip-foot">
            <KeyboardIcon size={16} /> Lock-screen and headphone controls work too.
          </span>
        </article>
      </section>
    </main>
  );
}
