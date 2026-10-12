// Demo folder (?demo): a few synthesized loops so the player can be tried without Dropbox.

import type { Listing, Track } from './dropboxApi';

const RATE = 22050;

const DEMO: { name: string; bpm: number; root: number; seconds: number }[] = [
  { name: 'night drive (bounce v3).mp3', bpm: 92, root: 41, seconds: 48 },
  { name: 'sunday sketch.wav', bpm: 84, root: 45, seconds: 36 },
  { name: 'tape loop 07.aif', bpm: 120, root: 38, seconds: 30 },
  { name: 'vox chop idea.mp3', bpm: 140, root: 43, seconds: 40 },
];

export function demoListing(): Listing {
  return {
    name: 'Demo beats',
    entries: DEMO.map((d, i) => ({
      kind: 'track',
      id: `demo-${i}`,
      name: d.name,
      path: `/${d.name}`,
      ext: d.name.split('.').pop()!,
      size: d.seconds * RATE * 2,
      modified: new Date(Date.UTC(2026, 9, 1 + i * 2, 18, 30)).toISOString(),
    })),
  };
}

function synth(bpm: number, root: number, seconds: number): Int16Array {
  const n = seconds * RATE;
  const out = new Int16Array(n);
  const beat = (60 / bpm) * RATE;
  const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const bassline = [0, 0, 7, 5, 0, 3, 10, 7];
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const posInBeat = i % beat;
    const beatIdx = Math.floor(i / beat);
    const kt = posInBeat / RATE;
    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-kt * 30)) * kt) * Math.exp(-kt * 9);
    const half = (i + beat / 2) % beat;
    const hat = noise() * Math.exp(-(half / RATE) * 60) * 0.25;
    const bt = (i % (beat * 2)) / RATE;
    const note = hz(root + bassline[Math.floor(beatIdx / 2) % bassline.length]);
    const bass = Math.sign(Math.sin(2 * Math.PI * note * t)) * 0.18 * Math.exp(-bt * 1.5);
    const pad = Math.sin(2 * Math.PI * hz(root + 24) * t) * 0.06 + Math.sin(2 * Math.PI * hz(root + 31) * t) * 0.05;
    const fade = Math.min(1, t / 0.5, (seconds - t) / 1.5);
    out[i] = Math.max(-1, Math.min(1, (kick * 0.6 + hat + bass + pad) * fade)) * 32000;
  }
  return out;
}

export function makeWav(samples: Int16Array, rate = RATE): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const s = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  s(8, 'WAVE');
  s(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  s(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((x, i) => v.setInt16(44 + i * 2, x, true));
  return buf;
}

/** Mono 16-bit big-endian AIFF. */
export function makeAiff(samples: Int16Array, rate = RATE): ArrayBuffer {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(54 + dataLen);
  const v = new DataView(buf);
  const s = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'FORM');
  v.setUint32(4, 46 + dataLen);
  s(8, 'AIFF');
  s(12, 'COMM');
  v.setUint32(16, 18);
  v.setUint16(20, 1);
  v.setUint32(22, samples.length);
  v.setUint16(26, 16);
  // 80-bit extended sample rate
  const exp = Math.floor(Math.log2(rate));
  v.setUint16(28, exp + 16383);
  v.setUint32(30, Math.round(rate * 2 ** (31 - exp)) >>> 0);
  v.setUint32(34, 0);
  s(38, 'SSND');
  v.setUint32(42, 8 + dataLen);
  v.setUint32(46, 0);
  v.setUint32(50, 0);
  samples.forEach((x, i) => v.setInt16(54 + i * 2, x));
  return buf;
}

export function demoFile(track: Track): ArrayBuffer {
  const d = DEMO.find((x) => `/${x.name}` === track.path) ?? DEMO[0];
  const samples = synth(d.bpm, d.root, d.seconds);
  return track.ext === 'aif' ? makeAiff(samples) : makeWav(samples);
}
