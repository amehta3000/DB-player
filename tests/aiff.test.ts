import { describe, expect, it } from 'vitest';
import { aiffToWav } from '../src/lib/aiff';
import { makeAiff } from '../src/lib/demo';
import { apiArg } from '../src/lib/dropboxApi';

function ascii(view: DataView, off: number) {
  return String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(off + i)));
}

describe('aiffToWav', () => {
  it('converts 16-bit big-endian AIFF to little-endian WAV', () => {
    const samples = Int16Array.from([0, 1, -1, 12345, -32768, 32767, 258]);
    const wav = new DataView(aiffToWav(makeAiff(samples, 44100)));
    expect(ascii(wav, 0)).toBe('RIFF');
    expect(ascii(wav, 8)).toBe('WAVE');
    expect(wav.getUint16(20, true)).toBe(1); // PCM
    expect(wav.getUint16(22, true)).toBe(1); // mono
    expect(wav.getUint32(24, true)).toBe(44100);
    expect(wav.getUint16(34, true)).toBe(16);
    expect(wav.getUint32(40, true)).toBe(samples.length * 2);
    const out = Array.from({ length: samples.length }, (_, i) => wav.getInt16(44 + i * 2, true));
    expect(out).toEqual(Array.from(samples));
  });

  it('reads non-power-of-two sample rates from the 80-bit float', () => {
    const wav = new DataView(aiffToWav(makeAiff(Int16Array.from([1, 2]), 22050)));
    expect(wav.getUint32(24, true)).toBe(22050);
    const wav48 = new DataView(aiffToWav(makeAiff(Int16Array.from([1, 2]), 48000)));
    expect(wav48.getUint32(24, true)).toBe(48000);
  });

  it('handles 24-bit stereo and skips unknown chunks', () => {
    // Hand-built AIFF: COMM (2ch, 2 frames, 24-bit, 44100), a junk chunk with odd size, SSND.
    const frames = [
      [0x123456, -2],
      [-0x123456, 0x7fffff],
    ];
    const data: number[] = [];
    for (const f of frames) for (const s of f) data.push((s >> 16) & 0xff, (s >> 8) & 0xff, s & 0xff);
    const parts: number[] = [];
    const str = (s: string) => [...s].forEach((c) => parts.push(c.charCodeAt(0)));
    const u32 = (n: number) => parts.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    const u16 = (n: number) => parts.push((n >> 8) & 0xff, n & 0xff);
    str('COMM');
    u32(18);
    u16(2);
    u32(2);
    u16(24);
    parts.push(0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0); // 44100
    str('JUNK');
    u32(3);
    parts.push(1, 2, 3, 0); // odd size + pad byte
    str('SSND');
    u32(8 + data.length);
    u32(0);
    u32(0);
    parts.push(...data);
    const body = new Uint8Array([...'FORM'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'AIFF'].map((c) => c.charCodeAt(0)), parts));
    new DataView(body.buffer).setUint32(4, body.length - 8);

    const wav = new DataView(aiffToWav(body.buffer));
    expect(wav.getUint16(22, true)).toBe(2);
    expect(wav.getUint32(24, true)).toBe(44100);
    expect(wav.getUint16(34, true)).toBe(24);
    const read24 = (o: number) => {
      const v = wav.getUint8(o) | (wav.getUint8(o + 1) << 8) | (wav.getUint8(o + 2) << 16);
      return v & 0x800000 ? v - 0x1000000 : v;
    };
    expect([read24(44), read24(47), read24(50), read24(53)]).toEqual([0x123456, -2, -0x123456, 0x7fffff]);
  });

  it('rejects non-AIFF input', () => {
    expect(() => aiffToWav(new ArrayBuffer(64))).toThrow(/Not an AIFF/);
  });
});

describe('apiArg', () => {
  it('escapes non-ASCII for the Dropbox-API-Arg header', () => {
    expect(apiArg({ path: '/Beats/café ♫.mp3' })).toBe('{"path":"/Beats/caf\\u00e9 \\u266b.mp3"}');
  });
});
