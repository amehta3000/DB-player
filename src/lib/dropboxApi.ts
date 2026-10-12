// Minimal Dropbox API v2 client for reading shared links. Shared by the browser
// (signed-in mode) and the serverless functions in /api (guest mode).

export const AUDIO_EXTENSIONS = ['mp3', 'aif', 'aiff', 'aifc', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus'];

export interface Track {
  kind: 'track';
  id: string;
  name: string;
  /** Path relative to the shared link's root, e.g. "/Beats/beat 1.mp3". */
  path: string;
  ext: string;
  size?: number;
  modified?: string;
}

export interface SubFolder {
  kind: 'folder';
  id: string;
  name: string;
  path: string;
}

export type Entry = Track | SubFolder;

export interface Listing {
  name: string;
  entries: Entry[];
}

export class DropboxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly summary = '',
  ) {
    super(message);
  }
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function isAudio(name: string): boolean {
  return AUDIO_EXTENSIONS.includes(extOf(name));
}

export function isAiff(name: string): boolean {
  return ['aif', 'aiff', 'aifc'].includes(extOf(name));
}

export function mimeFor(name: string): string {
  const ext = extOf(name);
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    aif: 'audio/aiff',
    aiff: 'audio/aiff',
    aifc: 'audio/aiff',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** JSON for the Dropbox-API-Arg header, which must be pure ASCII. */
export function apiArg(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/$/, '')}/${name}`;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function friendlyError(status: number, summary: string): string {
  if (summary.includes('shared_link_not_found')) return 'That shared link doesn’t exist or has been removed.';
  if (summary.includes('shared_link_access_denied')) return 'This link is restricted — the owner needs to set it to “Anyone with the link”.';
  if (summary.includes('shared_link_is_directory')) return 'That path is a folder, not a file.';
  if (summary.includes('not_found')) return 'That folder couldn’t be found inside the shared link.';
  if (status === 401) return 'Your Dropbox session expired. Reconnect to continue.';
  if (status === 429) return 'Dropbox is rate-limiting requests. Try again in a moment.';
  return `Dropbox error (${status}${summary ? `: ${summary}` : ''})`;
}

async function rpc<T>(token: string, endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let summary = '';
    try {
      const text = await res.text();
      try {
        summary = JSON.parse(text).error_summary ?? text;
      } catch {
        summary = text;
      }
    } catch {
      /* ignore */
    }
    throw new DropboxError(friendlyError(res.status, summary), res.status, summary);
  }
  return res.json() as Promise<T>;
}

interface RawEntry {
  '.tag': 'file' | 'folder' | 'deleted';
  id?: string;
  name: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
}

interface ListResult {
  entries: RawEntry[];
  cursor: string;
  has_more: boolean;
}

/** List one level of a shared folder link: audio files and subfolders, naturally sorted.
 *  `name` is always the name of the link's root folder. */
export async function listSharedFolder(token: string, url: string, path: string): Promise<Listing> {
  const [meta, raw] = await Promise.all([
    rpc<{ name: string }>(token, 'sharing/get_shared_link_metadata', { url }),
    (async () => {
      const all: RawEntry[] = [];
      let page = await rpc<ListResult>(token, 'files/list_folder', { path, shared_link: { url } });
      all.push(...page.entries);
      while (page.has_more) {
        page = await rpc<ListResult>(token, 'files/list_folder/continue', { cursor: page.cursor });
        all.push(...page.entries);
      }
      return all;
    })(),
  ]);

  const entries: Entry[] = [];
  for (const e of raw) {
    const p = joinPath(path, e.name);
    if (e['.tag'] === 'folder') {
      entries.push({ kind: 'folder', id: e.id ?? p, name: e.name, path: p });
    } else if (e['.tag'] === 'file' && isAudio(e.name)) {
      entries.push({
        kind: 'track',
        id: e.id ?? p,
        name: e.name,
        path: p,
        ext: extOf(e.name),
        size: e.size,
        modified: e.client_modified ?? e.server_modified,
      });
    }
  }
  entries.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : collator.compare(a.name, b.name)));
  return { name: meta.name, entries };
}

export const CONTENT_ENDPOINT = 'https://content.dropboxapi.com/2/sharing/get_shared_link_file';
