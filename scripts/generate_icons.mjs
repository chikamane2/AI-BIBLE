// Generate Android-ready PNG icons for the PWA / TWA — no external deps.
// Produces a simple "navy square + gold cross" icon at 192x192 and 512x512.
// Run with: node scripts/generate_icons.mjs

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------- Minimal pure-JS PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace
  const raw = Buffer.alloc(height * (width * 4 + 1));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Icon design: navy bg, gold cross ----------
const NAVY = [30, 58, 95];      // #1e3a5f
const GOLD = [212, 168, 87];    // #d4a857

function iconPixel(x, y, size) {
  const cx = size / 2;
  // Vertical bar of the cross
  const vBarHalf = size * 0.05;
  const vTop = size * 0.22;
  const vBottom = size * 0.80;
  if (Math.abs(x - cx) < vBarHalf && y > vTop && y < vBottom) {
    return [GOLD[0], GOLD[1], GOLD[2], 255];
  }
  // Horizontal bar of the cross
  const hY = size * 0.40;
  const hBarHalf = size * 0.05;
  const hLeft = size * 0.30;
  const hRight = size * 0.70;
  if (Math.abs(y - hY) < hBarHalf && x > hLeft && x < hRight) {
    return [GOLD[0], GOLD[1], GOLD[2], 255];
  }
  return [NAVY[0], NAVY[1], NAVY[2], 255];
}

function generate(size, path) {
  const png = makePng(size, size, (x, y) => iconPixel(x, y, size));
  writeFileSync(path, png);
  const kb = (png.length / 1024).toFixed(1);
  console.log(`✓ ${path}  ${size}×${size}  (${kb} KB)`);
}

generate(192, resolve(ROOT, "web/icons/icon-192.png"));
generate(512, resolve(ROOT, "web/icons/icon-512.png"));
console.log("\nIcons generated. Update manifest.json to reference them.");
