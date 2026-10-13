// Link previews for shared player URLs. Chat apps (iMessage, Slack, WhatsApp, …) fetch the page
// with a bot user agent and read Open Graph tags without running JavaScript, so vercel.json
// routes those bots here. We answer with a tiny HTML page whose title is the folder's name.

import { listSharedFolder } from '../src/lib/dropboxApi';
import { linkFromLocation, parseSharedLink, type SharedLink } from '../src/lib/link';
import { guestEnabled, serverToken } from './_server';

export const config = { runtime: 'edge' };

const SITE = 'DB Player';
const DEFAULT_DESC = 'Every Dropbox folder, a playlist. Play, skip, scrub and shuffle without opening files one by one.';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function unesc(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Pull og:title out of an HTML page, minus Dropbox's own branding around it. */
export function titleFromDropboxHtml(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i) ??
    html.match(/<title>([^<]*)<\/title>/i);
  if (!m) return null;
  const t = unesc(m[1])
    .trim()
    .replace(/^Dropbox\s*[-–—|:]\s*/i, '')
    .replace(/\s*[-–—|]\s*(Dropbox|Simplify your life)\s*$/i, '')
    .replace(/\s*[-–—|]\s*(Dropbox|Simplify your life)\s*$/i, '')
    .trim();
  return t && !/^dropbox$/i.test(t) ? t : null;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

interface Info {
  name: string;
  tracks?: number;
}

/** Best effort: the Dropbox API when this deployment has a server token, else Dropbox's own preview tags. */
async function lookup(link: SharedLink, path: string): Promise<Info | null> {
  if (link.kind === 'file') return link.fileName ? { name: link.fileName.replace(/\.[^.]+$/, '') } : null;
  if (guestEnabled) {
    const listing = await withTimeout(
      (async () => listSharedFolder(await serverToken(), link.url, path))(),
      3000,
    );
    if (listing) {
      return {
        name: path ? path.split('/').pop()! : listing.name,
        tracks: listing.entries.filter((e) => e.kind === 'track').length,
      };
    }
  }
  const html = await withTimeout(
    fetch(link.url, { headers: { 'User-Agent': 'facebookexternalhit/1.1', Accept: 'text/html' } }).then((r) => (r.ok ? r.text() : '')),
    3000,
  );
  const name = html ? titleFromDropboxHtml(html) : null;
  if (!name) return null;
  return { name: path ? path.split('/').pop()! : name };
}

export function renderSharePage(opts: { url: string; image: string; title: string; description: string }): string {
  const t = esc(opts.title);
  const d = esc(opts.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(opts.url)}">
<meta property="og:image" content="${esc(opts.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="DB Player: a Dropbox folder playing as a playlist">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(opts.image)}">
</head>
<body><a href="${esc(opts.url)}">${t}</a></body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const q = u.searchParams;
  // vercel.json passes the original path as prefix/rest; the rest of the query rides along.
  const prefix = q.get('prefix');
  const rest = q.get('rest');
  const passthrough = new URLSearchParams(q);
  passthrough.delete('prefix');
  passthrough.delete('rest');
  const search = passthrough.toString() ? `?${passthrough}` : '';
  const pagePath = prefix && rest ? `/${prefix}/${encodeURI(rest)}` : '/';
  const pageUrl = `${u.origin}${pagePath}${search}`;

  const link = prefix && rest ? linkFromLocation({ pathname: pagePath, search, hash: '' }) : parseSharedLink(q.get('url') ?? '');
  const path = q.get('p') ?? '';
  const info = link ? await lookup(link, path) : null;

  const title = info ? `${info.name} · ${SITE}` : link ? `Shared ${link.kind === 'file' ? 'track' : 'folder'} · ${SITE}` : SITE;
  const description = info?.tracks
    ? `${info.tracks} ${info.tracks === 1 ? 'track' : 'tracks'}. Tap to listen as a playlist: play, skip, scrub and shuffle.`
    : link
      ? `Tap to listen as a playlist: play, skip, scrub and shuffle, straight from Dropbox.`
      : DEFAULT_DESC;

  return new Response(renderSharePage({ url: pageUrl, image: `${u.origin}/og.png`, title, description }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
