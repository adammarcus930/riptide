// Generates flat accent-colored square PNG placeholders at required sizes.
// Paths are resolved relative to this script (web/scripts) so cwd doesn't matter.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function png(size, [r, g, b]) {
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
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array(size).fill(Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array(size).fill(row));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(publicDir, { recursive: true });
const accent = [0x43, 0xc9, 0xff];
writeFileSync(resolve(publicDir, 'icon-192.png'), png(192, accent));
writeFileSync(resolve(publicDir, 'icon-512.png'), png(512, accent));
writeFileSync(resolve(publicDir, 'icon-maskable-512.png'), png(512, accent));
console.log('wrote placeholder icons');
