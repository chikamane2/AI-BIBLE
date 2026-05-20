// Tiny zero-dep static server for local web/ testing.
// Usage: node scripts/dev_server.mjs [port]   (default 8080)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../web");
const PORT = +process.argv[2] || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".ico":  "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = decodeURIComponent(url.pathname);
    if (path === "/" || path === "") path = "/index.html";

    // Resolve and contain to ROOT
    const full = resolve(ROOT, "." + path);
    if (!full.startsWith(ROOT + sep) && full !== ROOT) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    let target = full;
    try {
      const s = await stat(full);
      if (s.isDirectory()) target = resolve(full, "index.html");
    } catch {
      res.writeHead(404); res.end("Not found"); return;
    }

    const data = await readFile(target);
    const ext = extname(target).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    // gzip text-based responses — cuts the 9MB+ of Bible JSON to ~2MB on the wire
    const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
    const compressible = /text|json|javascript|svg|manifest/.test(mime);
    if (acceptsGzip && compressible && data.length > 1024) {
      const gz = gzipSync(data);
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Encoding": "gzip",
        "Cache-Control": "no-cache",
      });
      res.end(gz);
    } else {
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
      res.end(data);
    }
  } catch (e) {
    res.writeHead(500); res.end(`Error: ${e.message}`);
  }
});

// Find this machine's LAN address so a phone on the same WiFi can connect.
function lanAddress() {
  for (const iface of Object.values(networkInterfaces())) {
    for (const info of iface || []) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return null;
}

server.listen(PORT, "0.0.0.0", () => {
  const lan = lanAddress();
  console.log(`Hope dev server running.`);
  console.log(`  On this PC:  http://localhost:${PORT}`);
  if (lan) console.log(`  On your phone (same WiFi):  http://${lan}:${PORT}`);
  console.log(`Serving: ${ROOT}`);
  console.log("Press Ctrl+C to stop.");
});
