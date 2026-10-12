import { CONTENT_ENDPOINT, apiArg, mimeFor } from '../src/lib/dropboxApi';
import { json, readParams, serverToken } from './_server';

export const config = { runtime: 'edge' };

// Streams one file from a shared folder, passing Range through so the player can seek.
export default async function handler(req: Request): Promise<Response> {
  const p = readParams(req);
  if (p instanceof Response) return p;
  if (!p.path) return json({ error: 'Missing path.' }, 400);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await serverToken()}`,
    'Dropbox-API-Arg': apiArg({ url: p.url, path: p.path }),
  };
  const range = req.headers.get('Range');
  if (range) headers.Range = range;

  const upstream = await fetch(CONTENT_ENDPOINT, { method: 'POST', headers });
  if (!upstream.ok && upstream.status !== 206) {
    return json({ error: `Dropbox returned ${upstream.status}` }, upstream.status === 409 ? 404 : 502);
  }

  const out = new Headers({
    'Content-Type': mimeFor(p.path),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });
  for (const h of ['Content-Length', 'Content-Range', 'ETag']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
