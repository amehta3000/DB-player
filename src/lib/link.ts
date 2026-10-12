// Parsing of Dropbox shared links, and of the ways a link can be handed to the player:
//   https://player.example/?url=<dropbox link>
//   https://player.example/#<dropbox link>
//   https://player.example/scl/fo/<id>/<key>?rlkey=...   (swap www.dropbox.com for the player host)

export type LinkKind = 'folder' | 'file';

export interface SharedLink {
  /** Canonical link passed to the Dropbox API. */
  url: string;
  kind: LinkKind;
  /** For file links: the file name taken from the URL. */
  fileName?: string;
}

const DROPBOX_HOSTS = new Set(['www.dropbox.com', 'dropbox.com', 'dl.dropbox.com', 'dl.dropboxusercontent.com']);
// Query params Dropbox adds that don't identify the link.
const NOISE_PARAMS = ['dl', 'raw', 'st', 'e', 'preview', 'subfolder_nav_tracking'];
// Our own params, which may ride along on a path-style player URL.
export const PLAYER_PARAMS = ['p', 'url', 'demo'];

export function parseSharedLink(input: string): SharedLink | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (!DROPBOX_HOSTS.has(u.hostname)) return null;
  return fromPathAndQuery(u.pathname, u.searchParams);
}

function fromPathAndQuery(pathname: string, search: URLSearchParams): SharedLink | null {
  const segs = pathname.split('/').filter(Boolean);
  let kind: LinkKind;
  if (segs[0] === 'scl' && (segs[1] === 'fo' || segs[1] === 'fi') && segs.length >= 3) {
    kind = segs[1] === 'fo' ? 'folder' : 'file';
  } else if (segs[0] === 'sh' && segs.length >= 3) {
    kind = 'folder';
  } else if (segs[0] === 's' && segs.length >= 3) {
    kind = 'file';
  } else {
    return null;
  }

  const params = new URLSearchParams(search);
  for (const p of [...NOISE_PARAMS, ...PLAYER_PARAMS]) params.delete(p);
  const qs = params.toString();
  const url = `https://www.dropbox.com/${segs.join('/')}${qs ? `?${qs}` : ''}`;
  const fileName = kind === 'file' ? decodeURIComponent(segs[segs.length - 1]) : undefined;
  return { url, kind, fileName };
}

/** Extract a shared link from the player's own location, in any of the supported shapes. */
export function linkFromLocation(loc: { pathname: string; search: string; hash: string }): SharedLink | null {
  const search = new URLSearchParams(loc.search);

  const fromPath = fromPathAndQuery(loc.pathname, search);
  if (fromPath) return fromPath;

  const q = search.get('url');
  if (q) return parseSharedLink(q);

  const hash = loc.hash.replace(/^#/, '');
  if (hash) return parseSharedLink(decodeURIComponent(hash));

  return null;
}

/** The path-style player URL for a link: same path as Dropbox, on our host. */
export function playerUrlFor(link: SharedLink, origin: string): string {
  const u = new URL(link.url);
  return `${origin}${u.pathname}${u.search}`;
}

/** Direct, no-auth URL for a single shared file (works as an <audio> src). */
export function rawFileUrl(link: SharedLink): string {
  const u = new URL(link.url);
  u.searchParams.set('raw', '1');
  return u.toString();
}
