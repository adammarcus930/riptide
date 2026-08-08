// Generates the Riptide app icons: an anti-aliased double wave (accent over a
// dimmer echo) on the ice-dark base. Pure JS PNG encoder — no image deps.
// Paths are resolved relative to this script (web/scripts) so cwd doesn't matter.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function png(size, colorAt) {
  const crc = (buf) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colorAt(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [13, 16, 19];        // #0D1013
const ACCENT = [67, 201, 255];  // #43C9FF
const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] * (1 - k) + b[i] * k));
const ECHO = mix(ACCENT, BG, 0.55); // dimmer second wave

// Coverage 0..1 for distance d from a band center of half-thickness t (AA edge aa px).
const cov = (d, t, aa) => Math.max(0, Math.min(1, (t - d) / aa + 0.5));

function wave(size) {
  const amp = size * 0.085;
  const t1 = size * 0.07;   // main band half-thickness
  const t2 = size * 0.045;  // echo band half-thickness
  const aa = Math.max(1, size * 0.008);
  return (x, y) => {
    const ph = (x / size) * Math.PI * 2 * 1.15;
    const c1 = size * 0.44 + amp * Math.sin(ph + 2.4);
    const c2 = size * 0.65 + amp * 0.8 * Math.sin(ph + 3.0);
    let col = BG;
    const a2 = cov(Math.abs(y - c2), t2, aa);
    if (a2 > 0) col = mix(col, ECHO, a2);
    const a1 = cov(Math.abs(y - c1), t1, aa);
    if (a1 > 0) col = mix(col, ACCENT, a1);
    return col;
  };
}

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(publicDir, { recursive: true });
for (const [name, size] of [
  ['icon-180.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  writeFileSync(resolve(publicDir, name), png(size, wave(size)));
}
console.log('wrote wave icons (180, 192, 512, maskable-512)');
