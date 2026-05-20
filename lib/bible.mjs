// Core engine for the Hope Finder.
//   - Local lookup of KJV + BSB from JSON files
//   - Reference parsing ("John 3:16", "1 John 3:16-17", "Psalms 23")
//   - NKJV fetch via API.Bible with on-disk cache (saves the 5K/mo budget)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BOOKS_66, OSIS, normalizeBook } from "./osis.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------- env loading (no dotenv dep) ----------
function loadEnv() {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

// ---------- local data (lazy-loaded) ----------
const _cache = {};
function loadTranslation(code) {
  if (_cache[code]) return _cache[code];
  const path = resolve(ROOT, `data/${code}/${code}.json`);
  if (!existsSync(path)) {
    throw new Error(`Translation "${code}" not found at ${path}`);
  }
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  _cache[code] = JSON.parse(raw);
  return _cache[code];
}

function cleanKjv(text) {
  return text
    .replace(/\{[^{}]*:[^{}]*\}/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- reference parser ----------
// Matches "Book Ch", "Book Ch:V", "Book Ch V", "Book Ch:V-V", "Book Ch V-V"
const REF_RE = /^\s*((?:\d\s+)?[A-Za-z][A-Za-z\s]+?)\s+(\d+)(?:[\s:]+(\d+)(?:\s*-\s*(\d+))?)?\s*$/;

export function parseRef(input) {
  const m = String(input).match(REF_RE);
  if (!m) throw new Error(`Could not parse reference: "${input}"`);
  const book = normalizeBook(m[1]);
  if (!book) throw new Error(`Unknown book: "${m[1].trim()}"`);
  const chapter = +m[2];
  const verseStart = m[3] ? +m[3] : null;
  const verseEnd = m[4] ? +m[4] : verseStart;
  return { book, chapter, verseStart, verseEnd };
}

export function refToString({ book, chapter, verseStart, verseEnd }) {
  if (!verseStart) return `${book} ${chapter}`;
  if (verseEnd && verseEnd !== verseStart) return `${book} ${chapter}:${verseStart}-${verseEnd}`;
  return `${book} ${chapter}:${verseStart}`;
}

// ---------- local lookup ----------
function getBookData(translation, book) {
  const data = loadTranslation(translation);
  const idx = BOOKS_66.indexOf(book);
  if (idx < 0) throw new Error(`Book not found: ${book}`);
  return data[idx];
}

function postProcess(translation, text) {
  return translation === "kjv" ? cleanKjv(text) : text;
}

export function getVerse(translation, book, chapter, verse) {
  const entry = getBookData(translation, book);
  const ch = entry.chapters[chapter - 1];
  if (!ch) throw new Error(`${book} has no chapter ${chapter}`);
  const text = ch[verse - 1];
  if (text == null) throw new Error(`${book} ${chapter}:${verse} not found`);
  return postProcess(translation, text);
}

export function getRange(translation, ref) {
  const { book, chapter, verseStart, verseEnd } = ref;
  const entry = getBookData(translation, book);
  const ch = entry.chapters[chapter - 1];
  if (!ch) throw new Error(`${book} has no chapter ${chapter}`);
  if (!verseStart) {
    return ch.map((t, i) => ({ verse: i + 1, text: postProcess(translation, t) }));
  }
  const out = [];
  for (let v = verseStart; v <= verseEnd; v++) {
    const t = ch[v - 1];
    if (t == null) break;
    out.push({ verse: v, text: postProcess(translation, t) });
  }
  return out;
}

// ---------- NKJV via API.Bible (with disk cache) ----------
const NKJV_BIBLE_ID = "63097d2a0a2f7db3-01";
const CACHE_PATH = resolve(ROOT, "data/nkjv/cache.json");

let _nkjvCache = null;
function loadCache() {
  if (_nkjvCache) return _nkjvCache;
  _nkjvCache = existsSync(CACHE_PATH)
    ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
    : {};
  return _nkjvCache;
}
function saveCache() {
  if (_nkjvCache) writeFileSync(CACHE_PATH, JSON.stringify(_nkjvCache, null, 2), "utf8");
}

function osisVerseId({ book, chapter, verseStart }) {
  return `${OSIS[book]}.${chapter}.${verseStart}`;
}

export async function getNKJV(ref) {
  const key = process.env.API_BIBLE_KEY;
  if (!key) throw new Error("API_BIBLE_KEY missing in .env");
  const { book, chapter, verseStart, verseEnd } = ref;
  if (!verseStart) throw new Error("NKJV fetch requires a verse, not whole chapter");
  const cache = loadCache();
  const out = [];
  for (let v = verseStart; v <= verseEnd; v++) {
    const id = `${OSIS[book]}.${chapter}.${v}`;
    if (cache[id]) {
      out.push({ verse: v, text: cache[id] });
      continue;
    }
    const url =
      `https://rest.api.bible/v1/bibles/${NKJV_BIBLE_ID}/verses/${id}` +
      `?content-type=text&include-notes=false&include-titles=false` +
      `&include-verse-numbers=false&include-chapter-numbers=false`;
    const res = await fetch(url, { headers: { "api-key": key } });
    if (!res.ok) {
      throw new Error(`NKJV fetch ${id} failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const text = (json?.data?.content || "").replace(/\s+/g, " ").trim();
    cache[id] = text;
    out.push({ verse: v, text });
  }
  saveCache();
  return out;
}

// ---------- topics ----------
let _topics = null;
export function loadTopics() {
  if (_topics) return _topics;
  _topics = JSON.parse(readFileSync(resolve(ROOT, "lib/topics.json"), "utf8"));
  return _topics;
}

export function findTopic(query) {
  const topics = loadTopics();
  const q = query.toLowerCase().trim();
  if (topics[q]) return { name: q, ...topics[q] };
  // fuzzy: alias match
  for (const [name, t] of Object.entries(topics)) {
    if (name.includes(q) || q.includes(name)) return { name, ...t };
    if ((t.aliases || []).some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) {
      return { name, ...t };
    }
  }
  return null;
}

// ---------- full-text search ----------
export function searchText(query, translation = "bsb", limit = 25) {
  const data = loadTranslation(translation);
  const q = query.toLowerCase();
  const out = [];
  data.forEach((book, bIdx) => {
    book.chapters.forEach((chapter, cIdx) => {
      chapter.forEach((verse, vIdx) => {
        const text = postProcess(translation, verse);
        if (text.toLowerCase().includes(q)) {
          out.push({
            ref: `${BOOKS_66[bIdx]} ${cIdx + 1}:${vIdx + 1}`,
            text,
          });
          if (out.length >= limit) throw new _Stop(out);
        }
      });
    });
  });
  return out;
}
class _Stop { constructor(v) { this.v = v; } }

export function searchTextSafe(query, translation = "bsb", limit = 25) {
  try { return searchText(query, translation, limit); }
  catch (e) { if (e instanceof _Stop) return e.v; throw e; }
}

// ---------- verse of the day ----------
let _daily = null;
function loadDaily() {
  if (_daily) return _daily;
  _daily = JSON.parse(readFileSync(resolve(ROOT, "lib/daily.json"), "utf8"));
  return _daily;
}

export function verseOfTheDay(date = new Date()) {
  const list = loadDaily();
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  const entry = list[dayOfYear % list.length];
  // Backwards-compat: support both old (string ref) and new (object) shapes
  return typeof entry === "string" ? { ref: entry } : entry;
}
