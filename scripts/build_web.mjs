// Copies data files into web/data/ so the static site has everything it needs.
// Run with: node scripts/build_web.mjs

import { copyFileSync, mkdirSync, existsSync, statSync, readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const required = [
  ["data/kjv/kjv.json",   "web/data/kjv.json"],
  ["data/bsb/bsb.json",   "web/data/bsb.json"],
  ["lib/topics.json",     "web/data/topics.json"],
  ["lib/daily.json",      "web/data/daily.json"],
  ["lib/voice.json",      "web/data/voice.json"],
  ["lib/quiz.json",       "web/data/quiz.json"],
  ["lib/plans.json",      "web/data/plans.json"],
];
// Optional translations — copied if present
const optional = [
  ["data/web/web.json",   "web/data/web.json"],
  ["data/asv/asv.json",   "web/data/asv.json"],
];

mkdirSync(resolve(ROOT, "web/data"), { recursive: true });

for (const [src, dst] of required) {
  const s = resolve(ROOT, src);
  const d = resolve(ROOT, dst);
  if (!existsSync(s)) {
    console.error(`✗ missing: ${src}`);
    process.exit(1);
  }
  copyFileSync(s, d);
  const kb = (statSync(d).size / 1024).toFixed(0);
  console.log(`✓ ${src} → ${dst}  (${kb} KB)`);
}
for (const [src, dst] of optional) {
  const s = resolve(ROOT, src);
  const d = resolve(ROOT, dst);
  if (!existsSync(s)) {
    console.log(`  (skip ${src} — not downloaded yet)`);
    if (existsSync(d)) unlinkSync(d);
    continue;
  }
  // Verify completeness — count non-empty verses
  const data = JSON.parse(readFileSync(s, "utf8"));
  const totalVerses = data.reduce(
    (a, b) => a + b.chapters.reduce((c, ch) => c + (ch ? ch.filter(Boolean).length : 0), 0),
    0,
  );
  if (totalVerses < 30000) {
    console.log(`  (skip ${src} — incomplete: ${totalVerses} verses, downloads still running)`);
    if (existsSync(d)) unlinkSync(d);
    continue;
  }
  copyFileSync(s, d);
  const kb = (statSync(d).size / 1024).toFixed(0);
  console.log(`✓ ${src} → ${dst}  (${kb} KB, ${totalVerses} verses)`);
}

console.log("\nDone. Test locally: npx serve web   (or)   python -m http.server -d web");
