const fs = require('fs');
const zlib = require('zlib');

const SIZE = 128;
const BG = [34, 211, 238, 255]; // accent cyan, matches docs/og-image.svg
const FG = [15, 23, 42, 255]; // dark navy, matches docs/og-image.svg

function inP(x, y) {
  // stem
  if (x >= 40 && x < 56 && y >= 32 && y < 96) return true;
  // bowl (outer minus inner rect carves the counter)
  const outer = x >= 40 && x < 88 && y >= 32 && y < 66;
  const inner = x >= 56 && x < 72 && y >= 40 && y < 58;
  if (outer && !inner) return true;
  return false;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const offset = (y * SIZE + x) * 4;
    const color = inP(x, y) ? FG : BG;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }
}

// prepend filter byte 0 to each scanline
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const idatData = zlib.deflateSync(raw, { level: 9 });

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = process.argv[2];
fs.writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);
