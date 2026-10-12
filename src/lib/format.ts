export function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatBytes(n?: number): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function trackTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

// A small palette in the spirit of Dropbox's brand colors, for per-track cover tiles.
const TILES: [string, string][] = [
  ['#0061FE', '#82B4FF'],
  ['#FA551E', '#FFAFA5'],
  ['#007891', '#7FD4E4'],
  ['#3A2A6B', '#C8AFF0'],
  ['#1E1919', '#B4DC19'],
  ['#9B0032', '#FAD24B'],
];

export function tileFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TILES[h % TILES.length];
}
