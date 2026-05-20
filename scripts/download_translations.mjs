// Bulk-download public-domain Bible translations from API.Bible.
// Saves each translation as data/<code>/<code>.json in our standard schema:
//   [ { "book": "Genesis", "chapters": [ ["v1","v2",...], ... ] }, ... ]
//
// Usage:  node scripts/download_translations.mjs [code1 code2 ...]
//   default codes: web asv

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load API key from .env
function loadEnv() {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();
const API_KEY = process.env.API_BIBLE_KEY;
if (!API_KEY) {
  console.error("Missing API_BIBLE_KEY in .env");
  process.exit(1);
}

const REQ_DELAY_MS = 200; // ~5 req/sec, well under most rate limits

const BIBLE_IDS = {
  web: "9879dbb7cfe39e4d-01",   // World English Bible (standard)
  asv: "06125adad2d5898a-01",   // American Standard Version
};

const BOOKS_66 = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra",
  "Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah",
  "Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
  "2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
  "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon",
  "Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation",
];

const OSIS = {
  "Genesis":"GEN","Exodus":"EXO","Leviticus":"LEV","Numbers":"NUM",
  "Deuteronomy":"DEU","Joshua":"JOS","Judges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Kings":"1KI","2 Kings":"2KI",
  "1 Chronicles":"1CH","2 Chronicles":"2CH","Ezra":"EZR","Nehemiah":"NEH",
  "Esther":"EST","Job":"JOB","Psalms":"PSA","Proverbs":"PRO",
  "Ecclesiastes":"ECC","Song of Solomon":"SNG","Isaiah":"ISA","Jeremiah":"JER",
  "Lamentations":"LAM","Ezekiel":"EZK","Daniel":"DAN","Hosea":"HOS",
  "Joel":"JOL","Amos":"AMO","Obadiah":"OBA","Jonah":"JON","Micah":"MIC",
  "Nahum":"NAM","Habakkuk":"HAB","Zephaniah":"ZEP","Haggai":"HAG",
  "Zechariah":"ZEC","Malachi":"MAL","Matthew":"MAT","Mark":"MRK",
  "Luke":"LUK","John":"JHN","Acts":"ACT","Romans":"ROM",
  "1 Corinthians":"1CO","2 Corinthians":"2CO","Galatians":"GAL",
  "Ephesians":"EPH","Philippians":"PHP","Colossians":"COL",
  "1 Thessalonians":"1TH","2 Thessalonians":"2TH","1 Timothy":"1TI",
  "2 Timothy":"2TI","Titus":"TIT","Philemon":"PHM","Hebrews":"HEB",
  "James":"JAS","1 Peter":"1PE","2 Peter":"2PE","1 John":"1JN",
  "2 John":"2JN","3 John":"3JN","Jude":"JUD","Revelation":"REV",
};

// Get chapter counts from KJV
const kjv = JSON.parse(
  readFileSync(resolve(ROOT, "data/kjv/kjv.json"), "utf8").replace(/^﻿/, "")
);
const CHAPTER_COUNTS = kjv.map((b) => b.chapters.length);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChapter(bibleId, chapterId) {
  const url =
    `https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}` +
    `?content-type=text&include-notes=false&include-titles=false` +
    `&include-chapter-numbers=false&include-verse-spans=false`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "api-key": API_KEY } });
    if (res.ok) {
      const json = await res.json();
      return json.data.content;
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = 1000 * Math.pow(2, attempt);
      console.warn(`  ${chapterId} → HTTP ${res.status}, retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${chapterId}: ${body.slice(0, 200)}`);
  }
  throw new Error(`Gave up on ${chapterId} after 5 attempts`);
}

// Parse "[1] text [2] text [3] text" → ["text","text","text"]
function parseChapter(content, expectedVerses) {
  // Verses are separated by [N] markers
  const out = [];
  const re = /\[(\d+)\]\s*(.+?)(?=\s*\[\d+\]|$)/gs;
  let match;
  while ((match = re.exec(content)) !== null) {
    const v = +match[1];
    const t = match[2].replace(/\s+/g, " ").trim();
    out[v - 1] = t;
  }
  // Fill any missing slots
  for (let i = 0; i < out.length; i++) if (out[i] == null) out[i] = "";
  return out;
}

async function downloadTranslation(code) {
  const bibleId = BIBLE_IDS[code];
  if (!bibleId) throw new Error(`Unknown translation code: ${code}`);
  console.log(`\n=== ${code.toUpperCase()} (${bibleId}) ===`);
  const dir = resolve(ROOT, `data/${code}`);
  mkdirSync(dir, { recursive: true });
  const outPath = resolve(dir, `${code}.json`);

  // Resume support — load existing if present
  let result;
  if (existsSync(outPath)) {
    result = JSON.parse(readFileSync(outPath, "utf8"));
    console.log("Resuming from existing file");
  } else {
    result = BOOKS_66.map((book, i) => ({
      book,
      chapters: Array(CHAPTER_COUNTS[i]).fill(null),
    }));
  }

  const totalChapters = CHAPTER_COUNTS.reduce((a, b) => a + b, 0);
  let done = 0, fetched = 0, started = Date.now();

  for (let bIdx = 0; bIdx < BOOKS_66.length; bIdx++) {
    const book = BOOKS_66[bIdx];
    const osis = OSIS[book];
    for (let cNum = 1; cNum <= CHAPTER_COUNTS[bIdx]; cNum++) {
      done++;
      const existing = result[bIdx].chapters[cNum - 1];
      if (existing && existing.length > 0 && existing.some((v) => v && v.length > 0)) {
        continue; // already downloaded
      }
      const chapterId = `${osis}.${cNum}`;
      try {
        const content = await fetchChapter(bibleId, chapterId);
        const verses = parseChapter(content);
        if (verses.length === 0) {
          console.warn(`  ${chapterId} → no verses parsed`);
        }
        result[bIdx].chapters[cNum - 1] = verses;
        fetched++;
        if (fetched % 25 === 0) {
          // Periodic save
          writeFileSync(outPath, JSON.stringify(result), "utf8");
          const rate = fetched / ((Date.now() - started) / 1000);
          console.log(`  ${done}/${totalChapters} (${fetched} fetched, ${rate.toFixed(1)}/s)`);
        }
      } catch (e) {
        console.error(`  ${chapterId} → ${e.message}`);
        // Save what we have and re-throw
        writeFileSync(outPath, JSON.stringify(result), "utf8");
        throw e;
      }
      await sleep(REQ_DELAY_MS);
    }
  }

  // Final save
  writeFileSync(outPath, JSON.stringify(result), "utf8");
  const totalVerses = result.reduce(
    (a, b) => a + b.chapters.reduce((c, ch) => c + (ch ? ch.length : 0), 0),
    0
  );
  console.log(`✓ ${code}: ${result.length} books, ${totalVerses} verses → ${outPath}`);
}

const codes = process.argv.slice(2);
const targets = codes.length > 0 ? codes : ["web", "asv"];
for (const code of targets) {
  await downloadTranslation(code);
}
console.log("\nDone.");
