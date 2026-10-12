// Where tracks come from. Three ways to reach a shared folder:
//  - connected: the listener signed in with Dropbox (PKCE); the browser calls Dropbox directly.
//  - guest:     the host deployed /api with its own Dropbox token; no sign-in for listeners.
//  - demo:      synthesized tracks, no network.
// Single-file links (/scl/fi/…) need none of these: Dropbox serves them with ?raw=1.

import { getAccessToken } from './auth';
import { demoFile, demoListing } from './demo';
import { CONTENT_ENDPOINT, DropboxError, apiArg, extOf, listSharedFolder, mimeFor, type Listing, type Track } from './dropboxApi';
import { rawFileUrl, type SharedLink } from './link';

export type SourceMode = 'connected' | 'guest' | 'demo';

export type Progress = (fraction: number | null) => void;

export interface Source {
  mode: SourceMode;
  list(link: SharedLink, path: string): Promise<Listing>;
  /** A URL an <audio> element can stream (with seeking). */
  streamUrl(link: SharedLink, track: Track): Promise<string>;
  /** Whole-file download, for formats the browser can't stream (AIFF in Chrome/Firefox). */
  download(link: SharedLink, track: Track, onProgress: Progress): Promise<Blob>;
}

export function singleFileListing(link: SharedLink): Listing {
  const name = link.fileName ?? 'Shared file';
  return {
    name,
    entries: [{ kind: 'track', id: link.url, name, path: '', ext: extOf(name) }],
  };
}

async function readWithProgress(res: Response, type: string, onProgress: Progress): Promise<Blob> {
  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) {
    onProgress(null);
    return new Blob([await res.arrayBuffer()], { type });
  }
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  return new Blob(chunks, { type });
}

async function fetchOk(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let msg = `Couldn’t load the file (${res.status})`;
    try {
      const j = await res.clone().json();
      if (j.error) msg = j.error;
    } catch {
      /* not json */
    }
    throw new DropboxError(msg, res.status);
  }
  return res;
}

function isSingle(track: Track) {
  return track.path === '';
}

export const connectedSource: Source = {
  mode: 'connected',
  async list(link, path) {
    try {
      return await listSharedFolder(await getAccessToken(), link.url, path);
    } catch (e) {
      if (e instanceof DropboxError && e.status === 401) return listSharedFolder(await getAccessToken(true), link.url, path);
      throw e;
    }
  },
  async streamUrl(link, track) {
    if (isSingle(track)) return rawFileUrl(link);
    // Content endpoints accept auth and args as URL params, which lets <audio> stream
    // straight from Dropbox with Range requests instead of downloading first.
    const q = new URLSearchParams({
      authorization: `Bearer ${await getAccessToken()}`,
      arg: apiArg({ url: link.url, path: track.path }),
    });
    return `${CONTENT_ENDPOINT}?${q}`;
  },
  async download(link, track, onProgress) {
    if (isSingle(track)) return readWithProgress(await fetchOk(rawFileUrl(link)), mimeFor(track.name), onProgress);
    const res = await fetchOk(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Dropbox-API-Arg': apiArg({ url: link.url, path: track.path }) },
    });
    return readWithProgress(res, mimeFor(track.name), onProgress);
  },
};

function guestQuery(link: SharedLink, path: string) {
  return new URLSearchParams({ url: link.url, path }).toString();
}

export const guestSource: Source = {
  mode: 'guest',
  async list(link, path) {
    const res = await fetchOk(`/api/list?${guestQuery(link, path)}`);
    return res.json();
  },
  async streamUrl(link, track) {
    return isSingle(track) ? rawFileUrl(link) : `/api/stream?${guestQuery(link, track.path)}`;
  },
  async download(link, track, onProgress) {
    const url = isSingle(track) ? rawFileUrl(link) : `/api/stream?${guestQuery(link, track.path)}`;
    return readWithProgress(await fetchOk(url), mimeFor(track.name), onProgress);
  },
};

const demoBlobs = new Map<string, Blob>();
const demoUrls = new Map<string, string>();
function demoBlob(track: Track): Blob {
  let b = demoBlobs.get(track.path);
  if (!b) {
    b = new Blob([demoFile(track)], { type: track.ext === 'aif' ? 'audio/aiff' : 'audio/wav' });
    demoBlobs.set(track.path, b);
  }
  return b;
}

export const demoSource: Source = {
  mode: 'demo',
  async list() {
    await new Promise((r) => setTimeout(r, 350));
    return demoListing();
  },
  async streamUrl(_link, track) {
    let url = demoUrls.get(track.path);
    if (!url) demoUrls.set(track.path, (url = URL.createObjectURL(demoBlob(track))));
    return url;
  },
  async download(_link, track, onProgress) {
    onProgress(1);
    return demoBlob(track);
  },
};

/** Whether this deployment has guest mode (/api with a server-side Dropbox token). */
export async function guestAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return false;
    const j = await res.json();
    return j.guest === true;
  } catch {
    return false;
  }
}
