import { DropboxError, listSharedFolder } from '../src/lib/dropboxApi';
import { json, readParams, serverToken } from './_server';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const p = readParams(req);
  if (p instanceof Response) return p;
  try {
    const listing = await listSharedFolder(await serverToken(), p.url, p.path);
    return new Response(JSON.stringify(listing), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' },
    });
  } catch (e) {
    const status = e instanceof DropboxError ? (e.status === 409 ? 404 : e.status) : 502;
    return json({ error: e instanceof Error ? e.message : 'Failed to list folder' }, status);
  }
}
