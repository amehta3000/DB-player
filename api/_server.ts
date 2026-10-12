// Guest mode: the host's own Dropbox token, kept server-side, reads shared links on behalf of
// listeners who haven't signed in. Only shared links are accepted, so this can only reach
// files that are already public to anyone holding the link.

import { parseSharedLink } from '../src/lib/link';

declare const process: { env: Record<string, string | undefined> };

const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;

export const guestEnabled = Boolean(DROPBOX_APP_KEY && DROPBOX_APP_SECRET && DROPBOX_REFRESH_TOKEN);

let cached: { token: string; expiresAt: number } | null = null;

export async function serverToken(): Promise<string> {
  if (cached && cached.expiresAt - 120_000 > Date.now()) return cached.token;
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: DROPBOX_REFRESH_TOKEN! }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const j = await res.json();
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Validate ?url=&path= and return the canonical link, or an error response. */
export function readParams(req: Request): { url: string; path: string } | Response {
  if (!guestEnabled) return json({ error: 'Guest mode is not configured on this server.' }, 501);
  const q = new URL(req.url).searchParams;
  const link = parseSharedLink(q.get('url') ?? '');
  if (!link || link.kind !== 'folder') return json({ error: 'Expected a Dropbox shared folder link.' }, 400);
  const path = q.get('path') ?? '';
  if (path && !path.startsWith('/')) return json({ error: 'Bad path.' }, 400);
  return { url: link.url, path };
}
