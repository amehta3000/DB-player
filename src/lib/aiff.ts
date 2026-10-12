// AIFF / AIFF-C -> WAV conversion. Chrome and Firefox can't play AIFF natively, so
// AIFF files are downloaded, rewritten as WAV in memory, and played from a blob URL.

export function browserPlaysAiff(): boolean {
  const a = document.createElement('audio');
  return !!(a.canPlayType('audio/aiff') || a.canPlayType('audio/x-aiff'));
}

function readExtended(view: DataView, off: number): number {
  // 80-bit IEEE 754 extended precision, big-endian.
  const expon = view.getUint16(off);
  const hi = view.getUint32(off + 2);
  const lo = view.getUint32(off + 6);
  if (expon === 0 && hi === 0 && lo === 0) return 0;
  const sign = expon & 0x8000 ? -1 : 1;
  const e = (expon & 0x7fff) - 16383;
  return sign * (hi * 2 ** (e - 31) + lo * 2 ** (e - 63));
}

function fourcc(view: DataView, off: number): string {
  return String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
}

interface Comm {
  channels: number;
  frames: number;
  bits: number;
  rate: number;
  compression: string;
}

export function aiffToWav(buf: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buf);
  if (buf.byteLength < 12 || fourcc(view, 0) !== 'FORM') throw new Error('Not an AIFF file');
  const form = fourcc(view, 8);
  if (form !== 'AIFF' && form !== 'AIFC') throw new Error('Not an AIFF file');

  let comm: Comm | null = null;
  let ssnd: { start: number; length: number } | null = null;

  let off = 12;
  while (off + 8 <= buf.byteLength) {
    const id = fourcc(view, off);
    const size = view.getUint32(off + 4);
    const body = off + 8;
    if (id === 'COMM') {
      comm = {
        channels: view.getUint16(body),
        frames: view.getUint32(body + 2),
        bits: view.getUint16(body + 6),
        rate: readExtended(view, body + 8),
        compression: form === 'AIFC' && size >= 22 ? fourcc(view, body + 18) : 'NONE',
      };
    } else if (id === 'SSND') {
      const dataOffset = view.getUint32(body);
      const start = body + 8 + dataOffset;
      // Some writers leave size at 0 or overshoot; clamp to what's actually there.
      const declared = size - 8 - dataOffset;
      ssnd = { start, length: Math.max(0, Math.min(declared, buf.byteLength - start)) };
    }
    off = body + size + (size & 1);
  }
  if (!comm || !ssnd) throw new Error('AIFF file is missing audio data');

  const { channels, bits, rate } = comm;
  const comp = comm.compression;
  let float = false;
  let littleEndian = false;
  if (comp === 'NONE' || comp === 'twos') {
    // big-endian integer PCM
  } else if (comp === 'sowt') {
    littleEndian = true;
  } else if (comp === 'fl32' || comp === 'FL32' || comp === 'fl64' || comp === 'FL64') {
    float = true;
  } else {
    throw new Error(`Unsupported AIFF-C compression “${comp}”`);
  }

  const bytesPer = float ? (comp.toLowerCase() === 'fl64' ? 8 : 4) : Math.ceil(bits / 8);
  const outBits = bytesPer * 8;
  const frameBytes = bytesPer * channels;
  const frames = Math.min(comm.frames || Infinity, Math.floor(ssnd.length / frameBytes));
  const dataLen = frames * frameBytes;

  const out = new ArrayBuffer(44 + dataLen);
  const w = new DataView(out);
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) w.setUint8(o + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  w.setUint32(4, 36 + dataLen, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  w.setUint32(16, 16, true);
  w.setUint16(20, float ? 3 : 1, true);
  w.setUint16(22, channels, true);
  w.setUint32(24, Math.round(rate), true);
  w.setUint32(28, Math.round(rate) * frameBytes, true);
  w.setUint16(32, frameBytes, true);
  w.setUint16(34, outBits, true);
  ascii(36, 'data');
  w.setUint32(40, dataLen, true);

  const src = new Uint8Array(buf, ssnd.start, dataLen);
  const dst = new Uint8Array(out, 44, dataLen);
  if (littleEndian) {
    dst.set(src);
  } else if (bytesPer === 1) {
    // AIFF 8-bit is signed, WAV 8-bit is unsigned.
    for (let i = 0; i < dataLen; i++) dst[i] = (src[i] + 128) & 0xff;
  } else {
    // Byte-swap each sample. Samples narrower than their container (e.g. 20-bit in 24)
    // are left-justified in both formats, so a plain swap is correct.
    for (let i = 0; i < dataLen; i += bytesPer) {
      for (let b = 0; b < bytesPer; b++) dst[i + b] = src[i + bytesPer - 1 - b];
    }
  }
  return out;
}
