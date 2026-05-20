// Sanity-check all bundled translations match the canonical 66-book structure
// and report verse counts. Run after downloads finish.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const TRANSLATIONS = ["kjv", "bsb", "web", "asv"];

// Reference chapter counts (from KJV — should match across all translations)
const kjvPath = resolve(ROOT, "data/kjv/kjv.json");
const kjvData = JSON.parse(readFileSync(kjvPath, "utf8").replace(/^﻿/, ""));
const REF_CHAPTER_COUNTS = kjvData.map((b) => b.chapters.length);

let allOk = true;
console.log("Validating translations...\n");
console.log("Book                  KJV    BSB    WEB    ASV");
console.log("──────────────────────────────────────────────────");

const results = {};
for (const code of TRANSLATIONS) {
  const path = resolve(ROOT, `data/${code}/${code}.json`);
  if (!existsSync(path)) {
    results[code] = null;
    continue;
  }
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const data = JSON.parse(raw);
  results[code] = data;
}

let totals = { kjv: 0, bsb: 0, web: 0, asv: 0 };
for (let bIdx = 0; bIdx < BOOKS_66.length; bIdx++) {
  const row = [BOOKS_66[bIdx].padEnd(20)];
  for (const code of TRANSLATIONS) {
    const data = results[code];
    if (!data) { row.push("  —  "); continue; }
    if (data.length !== 66) {
      row.push(" !66 ");
      allOk = false;
      continue;
    }
    const book = data[bIdx];
    const chCount = book.chapters.length;
    const verseCount = book.chapters.reduce((a, b) => a + (b ? b.length : 0), 0);
    totals[code] += verseCount;
    if (chCount !== REF_CHAPTER_COUNTS[bIdx]) {
      row.push(` ch${chCount}!`);
      allOk = false;
    } else {
      row.push(String(verseCount).padStart(5));
    }
  }
  // Only show full per-book table on demand; just check a few
  if (bIdx < 5 || bIdx === 18 /*Psalms*/ || bIdx === 42 /*John*/ || bIdx === 65 /*Revelation*/) {
    console.log(row.join("  "));
  }
}

console.log("──────────────────────────────────────────────────");
console.log(
  "TOTAL".padEnd(20) +
  "  " + String(totals.kjv).padStart(5) +
  "  " + String(totals.bsb).padStart(5) +
  "  " + String(totals.web || "—").padStart(5) +
  "  " + String(totals.asv || "—").padStart(5)
);

console.log("\nSummary:");
for (const code of TRANSLATIONS) {
  if (results[code]) {
    console.log(`  ${code.toUpperCase()}: ${results[code].length} books, ${totals[code]} verses`);
  } else {
    console.log(`  ${code.toUpperCase()}: not present`);
  }
}

if (!allOk) {
  console.log("\n⚠ Some translations have structural issues — review above.");
  process.exit(1);
}
console.log("\n✓ All present translations look structurally sound.");
