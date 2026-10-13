import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { titleFromDropboxHtml } from '../api/share';

describe('titleFromDropboxHtml', () => {
  it('reads og:title and strips Dropbox branding', () => {
    expect(titleFromDropboxHtml('<meta property="og:title" content="raw_export">')).toBe('raw_export');
    expect(titleFromDropboxHtml('<meta content="Dropbox - PartTimeChiller-Demos - Simplify your life" property="og:title" />')).toBe(
      'PartTimeChiller-Demos',
    );
    expect(titleFromDropboxHtml('<title>Beats &amp; Bounces - Dropbox</title>')).toBe('Beats & Bounces');
  });

  it('returns null when there is nothing useful', () => {
    expect(titleFromDropboxHtml('<title>Dropbox</title>')).toBeNull();
    expect(titleFromDropboxHtml('<html></html>')).toBeNull();
  });
});

describe('share handler', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = (url: string) => handler(new Request(url)).then((r) => r.text());

  it('titles a path-style folder link with the folder name', async () => {
    const fetchMock = vi.fn(async () => new Response('<meta property="og:title" content="Dropbox - raw_export">'));
    vi.stubGlobal('fetch', fetchMock);
    const html = await call('https://dbplayer.app/api/share?prefix=scl&rest=fo/abc/def&rlkey=k123');
    expect(fetchMock).toHaveBeenCalledWith('https://www.dropbox.com/scl/fo/abc/def?rlkey=k123', expect.anything());
    expect(html).toContain('<meta property="og:title" content="raw_export · DB Player">');
    expect(html).toContain('<meta property="og:image" content="https://dbplayer.app/og.png">');
    expect(html).toContain('<meta property="og:url" content="https://dbplayer.app/scl/fo/abc/def?rlkey=k123">');
  });

  it('uses the subfolder name when ?p= is set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<meta property="og:title" content="raw_export">')));
    const html = await call('https://dbplayer.app/api/share?prefix=scl&rest=fo/abc/def&rlkey=k&p=%2F2024');
    expect(html).toContain('content="2024 · DB Player"');
  });

  it('falls back to a generic title when Dropbox is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const html = await call('https://dbplayer.app/api/share?prefix=scl&rest=fo/abc/def&rlkey=k');
    expect(html).toContain('content="Shared folder · DB Player"');
  });

  it('handles ?url= links and escapes names', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<meta property="og:title" content="&lt;b&gt;Beats&quot;">')));
    const link = encodeURIComponent('https://www.dropbox.com/scl/fo/abc/def?rlkey=k&dl=0');
    const html = await call(`https://dbplayer.app/api/share?url=${link}`);
    expect(html).toContain('content="&lt;b&gt;Beats&quot; · DB Player"');
  });

  it('names single-file links without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = await call('https://dbplayer.app/api/share?prefix=scl&rest=fi/xyz/my%20beat.mp3&rlkey=k');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain('content="my beat · DB Player"');
  });
});
