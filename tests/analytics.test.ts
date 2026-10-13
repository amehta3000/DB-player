import { describe, expect, it } from 'vitest';
import { redactUrl } from '../src/lib/analytics';

const O = 'https://dbplayer.app';

describe('redactUrl', () => {
  it('hides folder and file links', () => {
    expect(redactUrl(`${O}/scl/fo/l5541091cnbeiurzrefmz/AIkY6ecnajmAN9cZxAHxHmo?rlkey=28c9ned5&p=%2F2024`)).toBe(`${O}/scl/fo/[folder]`);
    expect(redactUrl(`${O}/sh/abc/def?dl=0`)).toBe(`${O}/scl/fo/[folder]`);
    expect(redactUrl(`${O}/scl/fi/xyz/my%20beat.mp3?rlkey=k`)).toBe(`${O}/scl/fi/[file]`);
  });

  it('keeps home and demo, drops everything else', () => {
    expect(redactUrl(`${O}/`)).toBe(`${O}/`);
    expect(redactUrl(`${O}/?demo`)).toBe(`${O}/?demo`);
    expect(redactUrl(`${O}/?code=secret&state=x`)).toBe(`${O}/`);
    expect(redactUrl(`${O}/?url=${encodeURIComponent('https://www.dropbox.com/scl/fo/a/b?rlkey=c')}`)).toBe(`${O}/?url=[link]`);
    expect(redactUrl(`${O}/#https://www.dropbox.com/scl/fo/a/b?rlkey=c`)).toBe(`${O}/`);
    expect(redactUrl(`${O}/whatever/else?x=1`)).toBe(`${O}/[other]`);
  });

  it('never leaks an rlkey', () => {
    const urls = [`${O}/scl/fo/a/b?rlkey=SECRET`, `${O}/?url=${encodeURIComponent('https://www.dropbox.com/scl/fo/a/b?rlkey=SECRET')}`];
    for (const u of urls) expect(redactUrl(u)).not.toContain('SECRET');
  });
});
