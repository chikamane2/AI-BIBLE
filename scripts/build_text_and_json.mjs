// Builds:
//   data/kjv/kjv.txt   — plain text from kjv.json
//   data/bsb/bsb.json  — structured JSON from bsb_raw.txt
//   data/bsb/bsb.txt   — clean plain text from bsb_raw.txt
// Also prints book + verse counts for both translations.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------- canonical 66-book order with full names ----------
const BOOKS_66 = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra",
  "Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos",
  "Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah",
  "Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
  "2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
  "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon",
  "Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude",
  "Revelation",
];

// ---------- KJV: JSON -> plain text ----------
function buildKjvText() {
  const raw = readFileSync(resolve(ROOT, "data/kjv/kjv.json"), "utf8");
  const data = JSON.parse(raw.replace(/^﻿/, ""));
  if (data.length !== 66) throw new Error(`KJV: expected 66 books, got ${data.length}`);

  let totalVerses = 0;
  const out = [];
  data.forEach((book, bIdx) => {
    const name = BOOKS_66[bIdx];
    out.push(`# ${name}`);
    book.chapters.forEach((chapter, cIdx) => {
      out.push(`\n## ${name} ${cIdx + 1}`);
      chapter.forEach((verse, vIdx) => {
        // KJV digitization uses {...} for two things:
        //   (a) italicized translator-added words: "{Let your}", "{gotten}"
        //   (b) marginal notes: "{the light from...: Heb. between the light...}"
        // Heuristic: marginal notes contain a colon. Strip those entirely;
        // keep italicized words by just removing the braces.
        const clean = verse
          .replace(/\{[^{}]*:[^{}]*\}/g, "") // marginal notes
          .replace(/[{}]/g, "")              // italicization braces
          .replace(/\s+/g, " ")
          .trim();
        out.push(`${cIdx + 1}:${vIdx + 1} ${clean}`);
        totalVerses++;
      });
    });
    out.push("");
  });
  writeFileSync(resolve(ROOT, "data/kjv/kjv.txt"), out.join("\n"), "utf8");
  return { books: data.length, verses: totalVerses };
}

// ---------- BSB: tab text -> JSON + clean text ----------
function buildBsb() {
  const raw = readFileSync(resolve(ROOT, "data/bsb/bsb_raw.txt"), "utf8")
    .replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/);

  // Find the data start: first line whose first tab-field matches "<Book> <chap>:<verse>"
  const refRe = /^(.+?)\s+(\d+):(\d+)$/;
  const verses = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const ref = line.slice(0, tab).trim();
    const text = line.slice(tab + 1).trim();
    const m = ref.match(refRe);
    if (!m) continue;
    let book = m[1].trim();
    if (book === "Psalm") book = "Psalms"; // BSB uses singular
    verses.push({ book, chapter: +m[2], verse: +m[3], text });
  }

  // Group into structured form: [{ book, chapters: [[verseText, ...], ...] }]
  const byBook = new Map();
  for (const v of verses) {
    if (!byBook.has(v.book)) byBook.set(v.book, []);
    const chapters = byBook.get(v.book);
    while (chapters.length < v.chapter) chapters.push([]);
    chapters[v.chapter - 1][v.verse - 1] = v.text;
  }

  // Re-order to canonical 66-book order
  const structured = BOOKS_66.map((name) => {
    const chapters = byBook.get(name);
    if (!chapters) throw new Error(`BSB: missing book "${name}"`);
    return { book: name, chapters };
  });

  writeFileSync(
    resolve(ROOT, "data/bsb/bsb.json"),
    JSON.stringify(structured, null, 2),
    "utf8",
  );

  // Plain text version
  const out = [];
  for (const { book, chapters } of structured) {
    out.push(`# ${book}`);
    chapters.forEach((chapter, cIdx) => {
      out.push(`\n## ${book} ${cIdx + 1}`);
      chapter.forEach((text, vIdx) => {
        out.push(`${cIdx + 1}:${vIdx + 1} ${text}`);
      });
    });
    out.push("");
  }
  writeFileSync(resolve(ROOT, "data/bsb/bsb.txt"), out.join("\n"), "utf8");

  return { books: structured.length, verses: verses.length };
}

const kjv = buildKjvText();
const bsb = buildBsb();
console.log("KJV:", kjv);
console.log("BSB:", bsb);
