import { describe, expect, it } from 'vitest';
import { linkFromLocation, parseSharedLink, playerUrlFor, rawFileUrl } from '../src/lib/link';

const FOLDER =
  'https://www.dropbox.com/scl/fo/l5541091cnbeiurzrefmz/AIkY6ecnajmAN9cZxAHxHmo?rlkey=28c9ned5qt22pvxdmpaksbgm2&st=mnjqkvqp&dl=0';
const CANON = 'https://www.dropbox.com/scl/fo/l5541091cnbeiurzrefmz/AIkY6ecnajmAN9cZxAHxHmo?rlkey=28c9ned5qt22pvxdmpaksbgm2';

const loc = (href: string) => {
  const u = new URL(href);
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};

describe('parseSharedLink', () => {
  it('canonicalizes a folder link, dropping dl/st', () => {
    expect(parseSharedLink(FOLDER)).toEqual({ url: CANON, kind: 'folder', fileName: undefined });
  });

  it('parses file links and their names', () => {
    const l = parseSharedLink('https://www.dropbox.com/scl/fi/abc123/my%20beat.aif?rlkey=xyz&dl=0');
    expect(l).toEqual({ url: 'https://www.dropbox.com/scl/fi/abc123/my%20beat.aif?rlkey=xyz', kind: 'file', fileName: 'my beat.aif' });
  });

  it('accepts legacy /sh/ and /s/ links and bare dropbox.com', () => {
    expect(parseSharedLink('https://dropbox.com/sh/abc/def?dl=0')?.kind).toBe('folder');
    expect(parseSharedLink('https://www.dropbox.com/s/abc/song.mp3?dl=0')?.kind).toBe('file');
  });

  it('rejects non-Dropbox and non-shared URLs', () => {
    expect(parseSharedLink('https://example.com/scl/fo/a/b?rlkey=c')).toBeNull();
    expect(parseSharedLink('https://www.dropbox.com/home/Music')).toBeNull();
    expect(parseSharedLink('not a url')).toBeNull();
  });
});

describe('linkFromLocation', () => {
  it('reads a path-style player URL (domain swapped)', () => {
    const l = linkFromLocation(loc(FOLDER.replace('www.dropbox.com', 'player.app')));
    expect(l?.url).toBe(CANON);
  });

  it('ignores the player’s own params on a path-style URL', () => {
    const l = linkFromLocation(loc(`https://player.app/scl/fo/a/b?rlkey=k&p=%2FSub`));
    expect(l?.url).toBe('https://www.dropbox.com/scl/fo/a/b?rlkey=k');
  });

  it('reads ?url= and #hash forms', () => {
    expect(linkFromLocation(loc(`https://player.app/?url=${encodeURIComponent(FOLDER)}`))?.url).toBe(CANON);
    expect(linkFromLocation(loc(`https://player.app/#${FOLDER}`))?.url).toBe(CANON);
  });

  it('returns null on the bare home page', () => {
    expect(linkFromLocation(loc('https://player.app/'))).toBeNull();
  });
});

describe('url builders', () => {
  it('round-trips through the player URL', () => {
    const link = parseSharedLink(FOLDER)!;
    const playerUrl = playerUrlFor(link, 'https://player.app');
    expect(playerUrl).toBe(CANON.replace('https://www.dropbox.com', 'https://player.app'));
    expect(linkFromLocation(loc(playerUrl))).toEqual(link);
  });

  it('builds raw file URLs', () => {
    const link = parseSharedLink('https://www.dropbox.com/scl/fi/abc/x.mp3?rlkey=k&dl=0')!;
    expect(rawFileUrl(link)).toBe('https://www.dropbox.com/scl/fi/abc/x.mp3?rlkey=k&raw=1');
  });
});
