// Page addresses carry people's Dropbox share links (folder IDs and rlkeys), so analytics
// only ever sees the *kind* of page: home, demo, a folder or a file, never which one.

export function redactUrl(raw: string): string {
  const u = new URL(raw);
  const segs = u.pathname.split('/').filter(Boolean);
  let path = '/';
  if ((segs[0] === 'scl' && segs[1] === 'fo') || segs[0] === 'sh') path = '/scl/fo/[folder]';
  else if ((segs[0] === 'scl' && segs[1] === 'fi') || segs[0] === 's') path = '/scl/fi/[file]';
  else if (segs.length) path = '/[other]';

  let query = '';
  if (u.searchParams.has('demo')) query = '?demo';
  else if (path === '/' && u.searchParams.has('url')) query = '?url=[link]';
  // Everything else (rlkey, p, OAuth code/state, …) and the #hash are dropped.
  return `${u.origin}${path}${query}`;
}
