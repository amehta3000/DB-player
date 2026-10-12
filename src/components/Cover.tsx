import { tileFor } from '../lib/format';

/** Generated cover tile: two brand-ish colors and a few waveform bars, seeded by the file name. */
export function Cover({ name, size = 48, playing = false }: { name: string; size?: number; playing?: boolean }) {
  const [bg, fg] = tileFor(name);
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) >>> 0;
  const bars = Array.from({ length: 7 }, (_, i) => 0.28 + (((h >> (i * 3)) & 7) / 7) * 0.62);
  return (
    <div className={`cover${playing ? ' is-playing' : ''}`} style={{ width: size, height: size, background: bg }} aria-hidden="true">
      <svg viewBox="0 0 70 70" width="100%" height="100%">
        {bars.map((b, i) => (
          <rect key={i} className="cover-bar" style={{ animationDelay: `${i * -0.13}s` }} x={10 + i * 7.6} y={35 - b * 22} width={4.4} height={b * 44} rx={2.2} fill={fg} />
        ))}
      </svg>
    </div>
  );
}
