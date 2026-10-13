// Recently opened shared folders, kept in this browser so you can always find your way back.

export interface RecentFolder {
  /** Player URL path + query, e.g. "/scl/fo/…?rlkey=…". */
  href: string;
  name: string;
  /** Canonical Dropbox link, used to de-duplicate. */
  linkUrl: string;
  at: number;
}

const KEY = 'dbp.recent';
const MAX = 6;

export function readRecent(): RecentFolder[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => r && r.href && r.name && r.linkUrl) : [];
  } catch {
    return [];
  }
}

function write(list: RecentFolder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

export function rememberFolder(entry: Omit<RecentFolder, 'at'>) {
  write([{ ...entry, at: Date.now() }, ...readRecent().filter((r) => r.linkUrl !== entry.linkUrl)]);
}

export function forgetFolder(linkUrl: string): RecentFolder[] {
  const next = readRecent().filter((r) => r.linkUrl !== linkUrl);
  write(next);
  return next;
}

export function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
