// Hope — Bible Study Web App
// Vanilla JS, no framework. Loads KJV + BSB from local JSON files
// (cached by the service worker after first load).

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

const ALIASES = {
  "gen":"Genesis","ex":"Exodus","lev":"Leviticus","num":"Numbers","deut":"Deuteronomy",
  "josh":"Joshua","judg":"Judges","ru":"Ruth","1sam":"1 Samuel","2sam":"2 Samuel",
  "1kgs":"1 Kings","2kgs":"2 Kings","1chr":"1 Chronicles","2chr":"2 Chronicles",
  "neh":"Nehemiah","est":"Esther","ps":"Psalms","psalm":"Psalms","prov":"Proverbs",
  "eccl":"Ecclesiastes","song":"Song of Solomon","isa":"Isaiah","jer":"Jeremiah",
  "lam":"Lamentations","ezek":"Ezekiel","dan":"Daniel","hos":"Hosea","obad":"Obadiah",
  "jon":"Jonah","mic":"Micah","nah":"Nahum","hab":"Habakkuk","zeph":"Zephaniah",
  "hag":"Haggai","zech":"Zechariah","mal":"Malachi","matt":"Matthew","mt":"Matthew",
  "mk":"Mark","lk":"Luke","jn":"John","rom":"Romans","1cor":"1 Corinthians",
  "2cor":"2 Corinthians","gal":"Galatians","eph":"Ephesians","phil":"Philippians",
  "col":"Colossians","1thess":"1 Thessalonians","2thess":"2 Thessalonians",
  "1tim":"1 Timothy","2tim":"2 Timothy","tit":"Titus","phlm":"Philemon",
  "heb":"Hebrews","jas":"James","1pet":"1 Peter","2pet":"2 Peter","1jn":"1 John",
  "2jn":"2 John","3jn":"3 John","rev":"Revelation",
};

// Accepts "John 3:16", "John 3 16", "John 3", "Romans 8:28-31", "Romans 8 28-31"
const REF_RE = /^\s*((?:\d\s+)?[A-Za-z][A-Za-z\s]+?)\s+(\d+)(?:[\s:]+(\d+)(?:\s*-\s*(\d+))?)?\s*$/;

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 5) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function normalizeBook(name) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (BOOKS_66.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  const ci = BOOKS_66.find((b) => b.toLowerCase() === lower);
  if (ci) return ci;
  // prefix match — only if unambiguous
  const compact = lower.replace(/\s+/g, "");
  const prefixHits = BOOKS_66.filter((b) =>
    b.toLowerCase().replace(/\s+/g, "").startsWith(compact),
  );
  if (prefixHits.length === 1) return prefixHits[0];
  // fuzzy match for misspellings
  let best = null, bestDist = Infinity;
  for (const b of BOOKS_66) {
    const d = editDistance(lower, b.toLowerCase());
    if (d < bestDist) { bestDist = d; best = b; }
  }
  const threshold = Math.max(2, Math.ceil(lower.length / 3));
  if (best && bestDist <= threshold) return best;
  return null;
}

function parseRef(input) {
  const m = String(input).match(REF_RE);
  if (!m) throw new Error(`Could not parse reference: "${input}"`);
  const book = normalizeBook(m[1]);
  if (!book) throw new Error(`Unknown book: "${m[1].trim()}"`);
  return {
    book,
    chapter: +m[2],
    verseStart: m[3] ? +m[3] : null,
    verseEnd: m[4] ? +m[4] : (m[3] ? +m[3] : null),
  };
}

function refToString({ book, chapter, verseStart, verseEnd }) {
  if (!verseStart) return `${book} ${chapter}`;
  if (verseEnd && verseEnd !== verseStart) return `${book} ${chapter}:${verseStart}-${verseEnd}`;
  return `${book} ${chapter}:${verseStart}`;
}

function cleanKjv(s) {
  return s.replace(/\{[^{}]*:[^{}]*\}/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function getRange(translation, ref, data) {
  const arr = data[translation];
  if (!arr) throw new Error(`Translation "${translation}" not loaded`);
  const idx = BOOKS_66.indexOf(ref.book);
  const entry = arr[idx];
  if (!entry) throw new Error(`No book ${ref.book}`);
  const ch = entry.chapters[ref.chapter - 1];
  if (!ch) throw new Error(`${ref.book} has no chapter ${ref.chapter}`);
  const post = (t) => translation === "kjv" ? cleanKjv(t) : t;
  if (!ref.verseStart) {
    return ch.map((t, i) => ({ verse: i + 1, text: post(t) }));
  }
  const out = [];
  for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
    const t = ch[v - 1];
    if (t == null) break;
    out.push({ verse: v, text: post(t) });
  }
  return out;
}

// ---------- Text-to-speech (built-in browser voice, free + offline) ----------
const tts = {
  supported: typeof window !== "undefined" && "speechSynthesis" in window,
  speaking: false,
  button: null,
  chunks: [],
  idx: 0,
  voice: null,        // chosen SpeechSynthesisVoice
  voices: [],         // available English voices (best-ranked first)

  start(text, button) {
    this.stop();
    if (!this.supported || !text) return;
    // Split into sentence-sized chunks — long single utterances get cut off
    // by a known bug in several browsers' speech engines.
    this.chunks = (text.match(/[^.!?]+[.!?]*/g) || [text])
      .map((s) => s.trim())
      .filter(Boolean);
    this.idx = 0;
    this.button = button;
    this.speaking = true;
    this._setButton(true);
    this._next();
  },

  _next() {
    if (this.idx >= this.chunks.length) { this._done(); return; }
    const u = new SpeechSynthesisUtterance(this.chunks[this.idx]);
    u.rate = 0.9;       // measured, unhurried — suits Scripture
    u.pitch = 1;
    if (this.voice) u.voice = this.voice;
    u.onend = () => { if (this.speaking) { this.idx++; this._next(); } };
    u.onerror = () => this._done();
    window.speechSynthesis.speak(u);
  },

  stop() {
    if (this.supported) window.speechSynthesis.cancel();
    this._done();
  },

  _done() {
    this.speaking = false;
    this._setButton(false);
  },

  _setButton(playing) {
    if (!this.button) return;
    const idle = this.button.dataset.idleLabel || "▶ Listen";
    this.button.textContent = playing ? "■ Stop" : idle;
    this.button.classList.toggle("playing", playing);
  },

  toggle(text, button) {
    if (this.speaking && this.button === button) this.stop();
    else this.start(text, button);
  },
};

// Build a single readable string from a devotional/topic
function readableFrom(parts) {
  return parts.filter(Boolean).join(". ").replace(/\.\.+/g, ".");
}

// Rank voices — prefer modern "natural/neural" voices, then Google, then named ones.
function scoreVoice(v) {
  const n = (v.name || "").toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 100;
  if (/google/.test(n)) s += 50;
  if (/\bmicrosoft\b/.test(n)) s += 15;
  if (/en[-_]us/i.test(v.lang)) s += 10;
  if (/en[-_]gb/i.test(v.lang)) s += 8;
  // Generic robotic defaults — push down
  if (/^(microsoft david|microsoft zira|microsoft mark)/.test(n)) s -= 5;
  return s;
}

async function initVoices() {
  if (!tts.supported) return;
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (!voices.length) {
    await new Promise((res) => {
      synth.onvoiceschanged = () => res();
      setTimeout(res, 1200); // fallback if the event never fires
    });
    voices = synth.getVoices();
  }
  const eng = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = eng.length ? eng : voices;
  tts.voices = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  // Default: Microsoft David (Windows male), otherwise best-ranked English voice.
  tts.voice = tts.voices.find((v) => /microsoft david/i.test(v.name))
    || tts.voices[0]
    || null;
  // Restore saved per-device preference, if any.
  try {
    const saved = localStorage.getItem("hope.voice");
    if (saved) {
      const match = tts.voices.find((v) => v.name === saved);
      if (match) tts.voice = match;
    }
  } catch { /* ignore */ }
  // If the Me hub is already rendered, fill the dropdown now.
  if (document.getElementById("voice-select")) populateMeVoiceSelect();
}

function populateMeVoiceSelect() {
  const sel = document.getElementById("voice-select");
  if (!sel) return;
  if (!tts.voices.length) {
    sel.innerHTML = "<option>Default device voice</option>";
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = tts.voices
    .map((v) => `<option value="${escapeHtml(v.name)}"${v === tts.voice ? " selected" : ""}>${escapeHtml(v.name)}</option>`)
    .join("");
  sel.onchange = () => {
    const match = tts.voices.find((v) => v.name === sel.value);
    if (!match) return;
    tts.voice = match;
    try { localStorage.setItem("hope.voice", match.name); } catch { /* ignore */ }
    // Short preview so you hear the choice immediately
    tts.start("For God so loved the world. This is how Scripture will sound.", null);
  };
}

// Readable text for each section's Listen button (set by render functions)
const readable = { daily: "", topic: "", reader: "" };

// ---------- Tabs ----------
function show(id) {
  tts.stop(); // stop narration when navigating away
  if (id !== "speak") stopSpeakTimer(); // pause the countdown ticker off-tab
  document.querySelectorAll("main > section").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
  // Map topic-view back to "topics" tab visually
  const tabId = id === "topic-view" ? "topics" : id;
  const btn = document.querySelector(`nav button[data-tab="${tabId}"]`);
  if (btn) btn.classList.add("active");
  window.scrollTo(0, 0);
}

// ---------- VOD ----------
function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
function renderVod(data) {
  const entry = data.daily[dayOfYear() % data.daily.length];
  const refStr = typeof entry === "string" ? entry : entry.ref;
  const ref = parseRef(refStr);
  const kjv = getRange("kjv", ref, data);
  const bsb = getRange("bsb", ref, data);
  document.getElementById("daily-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
  const card = document.getElementById("vod-card");
  card.innerHTML = `
    <div class="ref">${escapeHtml(refToString(ref))}</div>
    ${kjv.map((v, i) => `
      <div class="verse-line"><span class="label-kjv">KJV</span> ${escapeHtml(v.text)}</div>
      <div class="verse-line"><span class="label-bsb">BSB</span> ${escapeHtml(bsb[i]?.text || "")}</div>
    `).join("")}
  `;

  // Assemble readable text for the Listen button
  readable.daily = readableFrom([
    `Today's verse, ${refToString(ref)}`,
    bsb.map((v) => v.text).join(" "),
    typeof entry === "object" ? entry.sermon : "",
    typeof entry === "object" && entry.prayer ? "Let us pray. " + entry.prayer : "",
    typeof entry === "object" && entry.declaration ? "Now declare. " + entry.declaration : "",
  ]);

  const devotional = document.getElementById("devotional");
  if (typeof entry === "object" && (entry.sermon || entry.prayer || entry.declaration)) {
    let html = "";
    if (entry.sermon) {
      html += `
        <div class="dev-block dev-sermon">
          <div class="dev-label">Sermon</div>
          <div class="dev-text">${escapeHtml(entry.sermon)}</div>
        </div>`;
    }
    if (entry.prayer) {
      html += `
        <div class="dev-block dev-prayer">
          <div class="dev-label">Prayer</div>
          <div class="dev-text">${escapeHtml(entry.prayer)}</div>
        </div>`;
    }
    if (entry.declaration) {
      html += `
        <div class="dev-block dev-declaration">
          <div class="dev-label">Declaration</div>
          <div class="dev-text">${escapeHtml(entry.declaration)}</div>
        </div>`;
    }
    devotional.innerHTML = html;
  } else {
    devotional.innerHTML = "";
  }
}

// ---------- Topics ----------
function renderTopicGrid(data) {
  const grid = document.getElementById("topic-grid");
  grid.innerHTML = Object.entries(data.topics).map(([name, t]) => `
    <button class="topic-card" data-topic="${escapeHtml(name)}">
      <div class="topic-name">${escapeHtml(name)}</div>
      <div class="topic-title">${escapeHtml(t.title)}</div>
    </button>
  `).join("");
  grid.querySelectorAll(".topic-card").forEach((b) => {
    b.addEventListener("click", () => renderTopicView(b.dataset.topic, data));
  });
}

function renderTopicView(topicName, data) {
  const t = data.topics[topicName];
  if (!t) return;
  document.getElementById("topic-title").textContent = t.title;
  document.getElementById("topic-intro").textContent = t.intro || "";
  document.getElementById("topic-message").textContent = t.message || "";
  const container = document.getElementById("topic-refs");
  container.innerHTML = t.refs.map((r) => {
    let block = `<div class="ref-block">`;
    try {
      const ref = parseRef(r.ref);
      const kjv = getRange("kjv", ref, data);
      const bsb = getRange("bsb", ref, data);
      block += `<div class="ref-line">${escapeHtml(refToString(ref))}</div>`;
      if (r.note) block += `<div class="ref-note">${escapeHtml(r.note)}</div>`;
      for (let i = 0; i < kjv.length; i++) {
        block += `
          <div class="verse-line kjv"><span class="label">KJV ${kjv[i].verse}</span><span>${escapeHtml(kjv[i].text)}</span></div>
          <div class="verse-line bsb"><span class="label">BSB ${bsb[i]?.verse || ""}</span><span>${escapeHtml(bsb[i]?.text || "")}</span></div>
        `;
      }
    } catch (e) {
      block += `<div class="ref-note">${escapeHtml(r.ref)} — ${escapeHtml(e.message)}</div>`;
    }
    block += `</div>`;
    return block;
  }).join("");

  // Readable text for the Listen button
  readable.topic = readableFrom([
    t.title,
    t.message,
    t.prayer ? "Let us pray. " + t.prayer : "",
    t.declaration ? "Now declare. " + t.declaration : "",
  ]);

  const devotional = document.getElementById("topic-devotional");
  let devHtml = "";
  if (t.prayer) {
    devHtml += `
      <div class="dev-block dev-prayer">
        <div class="dev-label">Pray</div>
        <div class="dev-text">${escapeHtml(t.prayer)}</div>
      </div>`;
  }
  if (t.declaration) {
    devHtml += `
      <div class="dev-block dev-declaration">
        <div class="dev-label">Declare</div>
        <div class="dev-text">${escapeHtml(t.declaration)}</div>
      </div>`;
  }
  devotional.innerHTML = devHtml;
  show("topic-view");
}

// ---------- Search (smart: keyword OR reference) ----------
// Looks like a reference if it ends with a chapter number, e.g. "John 3", "Psalms 23:4".
function looksLikeReference(input) {
  return /\s\d+(:\d+(-\d+)?)?\s*$/.test(input) || /^\d?\s?[A-Za-z]+\s+\d/.test(input);
}

function renderRefComparison(input, data, stats, container) {
  let ref;
  try {
    ref = parseRef(input);
  } catch (e) {
    stats.textContent = "";
    container.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
    return;
  }
  const available = Object.keys(TRANSLATION_LABELS).filter((c) => data[c]);
  const ranges = available.map((tx) => ({ tx, verses: getRange(tx, ref, data) }));
  stats.innerHTML = `Showing <strong>${escapeHtml(refToString(ref))}</strong> across ${ranges.length} translations`;
  let html = `<div class="ref-block">`;
  const verseCount = ranges[0].verses.length;
  for (let i = 0; i < verseCount; i++) {
    for (const { tx, verses } of ranges) {
      const v = verses[i];
      if (!v) continue;
      html += `
        <div class="verse-line ${tx}"><span class="label">${TRANSLATION_LABELS[tx]} ${v.verse}</span><span>${escapeHtml(v.text)}</span></div>`;
    }
  }
  html += `</div>`;
  // Offer a jump to read the full chapter
  html += `<button class="kw-result" data-book="${escapeHtml(ref.book)}" data-chapter="${ref.chapter}">
      <div class="kw-ref-line">Read all of ${escapeHtml(ref.book)} ${ref.chapter} ›</div>
    </button>`;
  container.innerHTML = html;
  container.querySelectorAll(".kw-result").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderBibleRead(btn.dataset.book, +btn.dataset.chapter, bibleState.tx, data);
    });
  });
}

// Live book-name autocomplete — so the user never has to spell a book.
function updateBookSuggestions(input) {
  const box = document.getElementById("lookup-suggestions");
  const trimmed = input.trim();
  // Hide once they've started typing a number, or input is too short
  if (!trimmed || trimmed.length < 2 || /\d/.test(trimmed)) {
    box.innerHTML = "";
    return;
  }
  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const scored = BOOKS_66.map((b) => {
    const bl = b.toLowerCase();
    const bc = bl.replace(/\s+/g, "");
    let score;
    if (bc.startsWith(compact)) score = 0;          // prefix — best
    else if (bc.includes(compact)) score = 1;        // substring
    else score = 2 + editDistance(lower, bl);        // fuzzy — ranked after
    return { book: b, score };
  })
    .filter((x) => x.score <= 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  if (scored.length === 0) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = scored
    .map((s) => `<button class="book-suggestion" data-book="${escapeHtml(s.book)}">${escapeHtml(s.book)}</button>`)
    .join("");
  box.querySelectorAll(".book-suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById("lookup-input");
      el.value = btn.dataset.book + " ";
      el.focus();
      box.innerHTML = "";
    });
  });
}

function renderLookup(input, data) {
  const stats = document.getElementById("lookup-stats");
  const container = document.getElementById("lookup-results");
  if (!input || input.length < 2) {
    stats.textContent = "";
    container.innerHTML = "";
    return;
  }
  // If it looks like a Bible reference, show the cross-translation comparison
  if (looksLikeReference(input)) {
    renderRefComparison(input, data, stats, container);
    return;
  }
  // Otherwise — keyword search
  const q = input.toLowerCase();
  const matches = { ot: [], nt: [] };
  for (let bIdx = 0; bIdx < data.bsb.length; bIdx++) {
    const book = data.bsb[bIdx];
    for (let cIdx = 0; cIdx < book.chapters.length; cIdx++) {
      const chapter = book.chapters[cIdx];
      for (let vIdx = 0; vIdx < chapter.length; vIdx++) {
        const text = chapter[vIdx];
        if (text && text.toLowerCase().includes(q)) {
          const entry = {
            book: BOOKS_66[bIdx],
            chapter: cIdx + 1,
            verse: vIdx + 1,
            text,
          };
          if (bIdx < 39) matches.ot.push(entry);
          else matches.nt.push(entry);
        }
      }
    }
  }
  const total = matches.ot.length + matches.nt.length;
  if (total === 0) {
    stats.textContent = `No verses contain "${input}".`;
    container.innerHTML = "";
    return;
  }
  stats.innerHTML = `Found <strong>${total}</strong> verse${total === 1 ? "" : "s"} containing "<strong>${escapeHtml(input)}</strong>" — Old Testament: ${matches.ot.length}, New Testament: ${matches.nt.length}`;

  function renderGroup(title, list) {
    if (list.length === 0) return "";
    let html = `<div class="kw-group-label">${title} (${list.length})</div>`;
    html += list.map((m) => `
      <button class="kw-result" data-book="${escapeHtml(m.book)}" data-chapter="${m.chapter}">
        <div class="kw-ref-line">${escapeHtml(m.book)} ${m.chapter}:${m.verse}</div>
        <div class="kw-text">${highlight(m.text, input)}</div>
      </button>
    `).join("");
    return html;
  }
  container.innerHTML = renderGroup("Old Testament", matches.ot) + renderGroup("New Testament", matches.nt);

  // Click a result → jump to Bible reader at that chapter
  container.querySelectorAll(".kw-result").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderBibleRead(btn.dataset.book, +btn.dataset.chapter, bibleState.tx, data);
    });
  });
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  const safeQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(safeQ, "gi"), (m) => `<mark>${m}</mark>`);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Bible browser ----------
const TRANSLATION_LABELS = {
  kjv: "KJV",
  bsb: "BSB",
  web: "WEB",
  asv: "ASV",
};
const TX_PREF_KEY = "hope.tx";
function savedTx() {
  try { return localStorage.getItem(TX_PREF_KEY) || "kjv"; } catch { return "kjv"; }
}
function rememberTx(tx) {
  try { localStorage.setItem(TX_PREF_KEY, tx); } catch {}
}
let bibleState = { book: null, chapter: null, tx: savedTx() };

function renderTxToggle(data) {
  const toggle = document.getElementById("tx-toggle");
  const available = Object.keys(TRANSLATION_LABELS).filter((c) => data[c]);
  toggle.innerHTML = available.map((c) => `
    <button data-tx="${c}"${c === bibleState.tx ? ' class="active"' : ""}>${TRANSLATION_LABELS[c]}</button>
  `).join("");
  toggle.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      if (bibleState.book && bibleState.chapter) {
        renderBibleRead(bibleState.book, bibleState.chapter, b.dataset.tx, data);
      }
    });
  });
}

function renderBibleBooks(data) {
  const ot = BOOKS_66.slice(0, 39);
  const nt = BOOKS_66.slice(39);
  const make = (book) => `
    <button class="book-card" data-book="${escapeHtml(book)}">
      <span class="book-name">${escapeHtml(book)}</span>
      <span class="book-chapters">${data.kjv[BOOKS_66.indexOf(book)].chapters.length} ch</span>
    </button>`;
  document.getElementById("ot-books").innerHTML = ot.map(make).join("");
  document.getElementById("nt-books").innerHTML = nt.map(make).join("");

  document.querySelectorAll(".book-card").forEach((b) => {
    b.addEventListener("click", () => renderBibleChapters(b.dataset.book, data));
  });
}

function renderBibleChapters(book, data) {
  bibleState.book = book;
  const idx = BOOKS_66.indexOf(book);
  const chapters = data.kjv[idx].chapters.length;
  document.getElementById("chapters-book-name").textContent = book;
  document.getElementById("chapters-count").textContent =
    `${chapters} chapter${chapters === 1 ? "" : "s"}`;
  const list = document.getElementById("chapter-grid");
  let html = "";
  for (let c = 1; c <= chapters; c++) {
    const verseCount = data.kjv[idx].chapters[c - 1].length;
    html += `
      <button class="chapter-item" data-chapter="${c}">
        <span class="chapter-item-name">${escapeHtml(book)} ${c}</span>
        <span class="chapter-item-meta">${verseCount} verses ›</span>
      </button>`;
  }
  list.innerHTML = html;
  list.querySelectorAll(".chapter-item").forEach((b) => {
    b.addEventListener("click", () => renderBibleRead(book, +b.dataset.chapter, bibleState.tx, data));
  });
  show("bible-chapters");
}

// One verse row, marks-aware (saved star, highlight tint, note, action bar)
function readerVerseHtml(book, chapter, v) {
  const vid = `${book} ${chapter}:${v.verse}`;
  const m = getMark(vid);
  const hl = m.hl ? ` hl-${m.hl}` : "";
  return `
    <div class="verse-row${hl}" data-vid="${escapeHtml(vid)}">
      <div class="verse-num-large">${v.verse}${m.saved ? '<span class="v-flag">★</span>' : ""}</div>
      <div class="verse-body">
        <div class="verse-text">${escapeHtml(v.text)}</div>
        ${m.note ? `<div class="verse-note">${escapeHtml(m.note)}</div>` : ""}
        <div class="verse-actions">
          <button data-act="save">${m.saved ? "★ Saved" : "☆ Save"}</button>
          <button data-act="highlight">${m.hl ? "Highlight ✓" : "Highlight"}</button>
          <button data-act="note">${m.note ? "Edit note" : "Add note"}</button>
        </div>
      </div>
    </div>`;
}

// Paint the verse list for the current chapter and wire verse interaction.
function paintReaderVerses(book, chapter, data) {
  const verses = getRange(bibleState.tx, { book, chapter, verseStart: null, verseEnd: null }, data);
  const content = document.getElementById("reader-content");
  content.innerHTML = verses.map((v) => readerVerseHtml(book, chapter, v)).join("");
  readable.reader = `${book}, chapter ${chapter}. ` + verses.map((v) => v.text).join(" ");
  content.querySelectorAll(".verse-row").forEach((row) => {
    const vid = row.dataset.vid;
    row.querySelector(".verse-text").addEventListener("click", () => row.classList.toggle("active"));
    row.querySelectorAll(".verse-actions button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === "save") { toggleSaved(vid); paintReaderVerses(book, chapter, data); }
        else if (act === "highlight") { cycleHighlight(vid); paintReaderVerses(book, chapter, data); }
        else if (act === "note") openNoteEditor(row, vid, book, chapter, data);
      });
    });
  });
}

function openNoteEditor(row, vid, book, chapter, data) {
  const m = getMark(vid);
  const actions = row.querySelector(".verse-actions");
  actions.innerHTML = `
    <textarea class="note-input" rows="3" placeholder="Write your note...">${escapeHtml(m.note || "")}</textarea>
    <div class="note-btns">
      <button data-n="save">Save note</button>
      <button data-n="cancel">Cancel</button>
      ${m.note ? '<button data-n="delete">Delete</button>' : ""}
    </div>`;
  actions.querySelector('[data-n="save"]').addEventListener("click", (e) => {
    e.stopPropagation();
    setNote(vid, actions.querySelector(".note-input").value);
    paintReaderVerses(book, chapter, data);
  });
  actions.querySelector('[data-n="cancel"]').addEventListener("click", (e) => {
    e.stopPropagation();
    paintReaderVerses(book, chapter, data);
  });
  const del = actions.querySelector('[data-n="delete"]');
  if (del) del.addEventListener("click", (e) => {
    e.stopPropagation();
    setNote(vid, "");
    paintReaderVerses(book, chapter, data);
  });
}

function renderBibleRead(book, chapter, tx, data) {
  bibleState.book = book;
  bibleState.chapter = chapter;
  bibleState.tx = data[tx] ? tx : "kjv"; // fallback if requested tx is missing
  rememberTx(bibleState.tx);
  markRead(book, chapter);
  document.getElementById("reader-ref").textContent = `${book} ${chapter}`;
  paintReaderVerses(book, chapter, data);
  tts.stop(); // reset Listen button when chapter changes

  // Translation toggle state
  document.querySelectorAll("#tx-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tx === bibleState.tx);
  });

  // Prev/next buttons — wrap across books
  const idx = BOOKS_66.indexOf(book);
  const prev = document.getElementById("reader-prev");
  const next = document.getElementById("reader-next");
  prev.disabled = idx === 0 && chapter === 1;
  next.disabled = idx === BOOKS_66.length - 1 &&
                  chapter === data.kjv[idx].chapters.length;
  show("bible-read");
}

function navigateChapter(delta, data) {
  const idx = BOOKS_66.indexOf(bibleState.book);
  let bIdx = idx, ch = bibleState.chapter + delta;
  if (ch < 1) {
    bIdx -= 1;
    if (bIdx < 0) return;
    ch = data.kjv[bIdx].chapters.length;
  } else if (ch > data.kjv[bIdx].chapters.length) {
    bIdx += 1;
    if (bIdx >= BOOKS_66.length) return;
    ch = 1;
  }
  renderBibleRead(BOOKS_66[bIdx], ch, bibleState.tx, data);
}

// ---------- Speak (Lord, speak to me) ----------
const SPEAK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
let speakTimer = null;

function stopSpeakTimer() {
  if (speakTimer) { clearInterval(speakTimer); speakTimer = null; }
}

function speakRemaining() {
  const last = Store.get("hope.speakLast", 0);
  return Math.max(0, SPEAK_COOLDOWN_MS - (Date.now() - last));
}

function fmtCountdown(ms) {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function speakCardHtml(entry) {
  return `
    <div class="speak-card">
      <div class="speak-quote-mark">"</div>
      <div class="speak-message">${escapeHtml(entry.message)}</div>
      <button class="speak-verse" data-ref="${escapeHtml(entry.verse)}">${escapeHtml(entry.verse)} ›</button>
    </div>
    <div class="speak-actions">
      <button class="listen-btn" id="speak-listen">▶ Listen</button>
    </div>`;
}

function wireSpeakCard(entry, data) {
  const body = document.getElementById("speak-body");
  const verseBtn = body.querySelector(".speak-verse");
  if (verseBtn) {
    verseBtn.addEventListener("click", () => {
      try {
        const ref = parseRef(entry.verse);
        renderBibleRead(ref.book, ref.chapter, bibleState.tx, data);
      } catch { /* ignore */ }
    });
  }
  const listenBtn = body.querySelector("#speak-listen");
  if (listenBtn) {
    if (tts.supported) listenBtn.addEventListener("click", () => tts.toggle(entry.message, listenBtn));
    else listenBtn.style.display = "none";
  }
}

// Decides what the Speak tab shows: the button, or the last word + countdown.
function renderSpeakTab(data) {
  stopSpeakTimer();
  const body = document.getElementById("speak-body");
  const pool = data.voice || [];
  if (!body || pool.length === 0) return;
  const rem = speakRemaining();

  if (rem > 0) {
    // Cooldown active — show the word already given, with a countdown
    const idx = Math.min(Store.get("hope.speakIdx", 0), pool.length - 1);
    const entry = pool[idx];
    body.innerHTML = speakCardHtml(entry) + `
      <div class="speak-cooldown">
        <div class="speak-cd-label">Stay with this word. You can seek another in</div>
        <div class="speak-cd-time" id="speak-cd-time">${fmtCountdown(rem)}</div>
      </div>`;
    wireSpeakCard(entry, data);
    speakTimer = setInterval(() => {
      const r = speakRemaining();
      if (r <= 0) { stopSpeakTimer(); renderSpeakTab(data); return; }
      const el = document.getElementById("speak-cd-time");
      if (el) el.textContent = fmtCountdown(r);
    }, 1000);
  } else {
    // Available
    body.innerHTML = `<button class="speak-trigger" id="speak-trigger">🕊  Lord, speak to me</button>`;
    document.getElementById("speak-trigger").addEventListener("click", () => doSpeak(data));
  }
}

function doSpeak(data) {
  const pool = data.voice || [];
  if (!pool.length) return;
  let idx = Math.floor(Math.random() * pool.length);
  const prev = Store.get("hope.speakIdx", -1);
  if (pool.length > 1 && idx === prev) idx = (idx + 1) % pool.length;
  Store.set("hope.speakIdx", idx);
  Store.set("hope.speakLast", Date.now());
  renderSpeakTab(data);
}

// ---------- Quiz (5 levels) ----------
let quizState = null;

const QUIZ_LEVELS = [
  { n: 1, name: "Beginner" },
  { n: 2, name: "Easy" },
  { n: 3, name: "Moderate" },
  { n: 4, name: "Hard" },
  { n: 5, name: "Expert" },
];
const QUIZ_ROUND_SIZE = 8;        // questions per round
const QUIZ_PASS = 0.5;            // fraction correct needed to advance
let quizSelectedLevel = 1;

function quizUnlocked() {
  try {
    const v = +localStorage.getItem("hope.quizUnlocked");
    return Math.min(5, Math.max(1, v || 1));
  } catch { return 1; }
}
function setQuizUnlocked(n) {
  try { localStorage.setItem("hope.quizUnlocked", String(n)); } catch { /* ignore */ }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuizStart(data) {
  const unlocked = quizUnlocked();
  if (quizSelectedLevel > unlocked) quizSelectedLevel = unlocked;
  if (quizSelectedLevel < 1) quizSelectedLevel = 1;

  const chips = QUIZ_LEVELS.map((L) => {
    const locked = L.n > unlocked;
    const cls = "quiz-level"
      + (L.n === quizSelectedLevel ? " selected" : "")
      + (locked ? " locked" : "");
    return `<button class="${cls}" data-level="${L.n}"${locked ? " disabled" : ""}>${locked ? "🔒" : L.n}</button>`;
  }).join("");
  const cur = QUIZ_LEVELS[quizSelectedLevel - 1];
  const need = Math.ceil(QUIZ_ROUND_SIZE * QUIZ_PASS);

  document.getElementById("quiz-body").innerHTML = `
    <p class="muted center">Bible Quiz — five levels, Beginner to Expert. Answer at least half to unlock the next level. You can drop to an easier level any time.</p>
    <div class="quiz-level-row">${chips}</div>
    <div class="quiz-level-name">Level ${cur.n} · ${cur.name}</div>
    <p class="muted small center">${QUIZ_ROUND_SIZE} questions · pass ${need} to advance</p>
    <button class="speak-trigger" id="quiz-start-btn">Start Level ${cur.n}</button>
    ${unlocked > 1 ? `<button class="quiz-reset" id="quiz-reset">↺ Reset progress to Level 1</button>` : ""}
  `;
  document.querySelectorAll(".quiz-level").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizSelectedLevel = +btn.dataset.level;
      renderQuizStart(data);
    });
  });
  document.getElementById("quiz-start-btn").addEventListener("click", () => startQuiz(data));
  const resetBtn = document.getElementById("quiz-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setQuizUnlocked(1);
      quizSelectedLevel = 1;
      renderQuizStart(data);
    });
  }
}

function startQuiz(data) {
  const level = quizSelectedLevel;
  const pool = data.quiz.filter((q) => q.level === level);
  quizState = {
    level,
    questions: shuffle(pool).slice(0, QUIZ_ROUND_SIZE),
    idx: 0,
    score: 0,
    answered: false,
  };
  renderQuizQuestion(data);
}

function renderQuizQuestion(data) {
  const s = quizState;
  const q = s.questions[s.idx];
  s.answered = false;
  const levelName = QUIZ_LEVELS[s.level - 1].name;
  document.getElementById("quiz-body").innerHTML = `
    <div class="quiz-progress">Level ${s.level} · ${levelName} — Question ${s.idx + 1} of ${s.questions.length}<span>Score ${s.score}</span></div>
    <div class="quiz-question">${escapeHtml(q.q)}</div>
    <div class="quiz-options">
      ${q.options.map((opt, i) => `<button class="quiz-option" data-i="${i}">${escapeHtml(opt)}</button>`).join("")}
    </div>
    <div class="quiz-feedback" id="quiz-feedback"></div>
  `;
  document.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => answerQuiz(+btn.dataset.i, data));
  });
}

function answerQuiz(picked, data) {
  const s = quizState;
  if (s.answered) return;
  s.answered = true;
  const q = s.questions[s.idx];
  const right = picked === q.answer;
  if (right) s.score++;
  document.querySelectorAll(".quiz-option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
    else if (i === picked) btn.classList.add("wrong");
  });
  const last = s.idx + 1 >= s.questions.length;
  const fb = document.getElementById("quiz-feedback");
  fb.innerHTML = `
    <div class="quiz-verdict ${right ? "right" : "miss"}">${right ? "✓ Correct" : "✗ Not quite"}</div>
    <button class="quiz-verse" data-ref="${escapeHtml(q.ref)}">Read ${escapeHtml(q.ref)} ›</button>
    <button class="quiz-next" id="quiz-next">${last ? "See result →" : "Next question →"}</button>
  `;
  fb.querySelector(".quiz-verse").addEventListener("click", () => {
    try {
      const ref = parseRef(q.ref);
      renderBibleRead(ref.book, ref.chapter, bibleState.tx, data);
    } catch { /* ignore */ }
  });
  fb.querySelector("#quiz-next").addEventListener("click", () => {
    s.idx++;
    if (s.idx >= s.questions.length) renderQuizResult(data);
    else renderQuizQuestion(data);
  });
}

function renderQuizResult(data) {
  const s = quizState;
  const total = s.questions.length;
  const need = Math.ceil(total * QUIZ_PASS);
  const passed = s.score >= need;
  const playedLevel = s.level; // remember which level was just played
  let headline, msg, buttonsHtml;

  if (passed && s.level >= 5) {
    // Completed the final level — reset the whole journey
    setQuizUnlocked(1);
    quizSelectedLevel = 1;
    headline = "All 5 levels complete!";
    msg = "You have journeyed from Beginner to Expert in the Word. The quiz now resets — begin again, and see how much deeper it has gone in.";
    buttonsHtml = `<button class="speak-trigger" id="quiz-restart">Start again</button>`;
  } else if (passed) {
    const newUnlocked = Math.max(quizUnlocked(), s.level + 1);
    setQuizUnlocked(newUnlocked);
    headline = `Level ${s.level} passed!`;
    msg = `You have unlocked Level ${s.level + 1} · ${QUIZ_LEVELS[s.level].name}. Move on, or retake this level if you want to lock it in.`;
    buttonsHtml = `
      <button class="speak-trigger" id="quiz-next-level">Continue to Level ${s.level + 1}</button>
      <button class="quiz-secondary" id="quiz-retry">Retry Level ${s.level}</button>
    `;
  } else {
    headline = "Not quite — try again";
    msg = `You needed ${need} of ${total} correct to advance. Review the verses and give this level another go.`;
    buttonsHtml = `<button class="speak-trigger" id="quiz-retry">Retry Level ${s.level}</button>`;
  }

  document.getElementById("quiz-body").innerHTML = `
    <div class="quiz-result-card">
      <div class="quiz-score-big">${s.score}<span>/ ${total}</span></div>
      <div class="quiz-result-headline">${escapeHtml(headline)}</div>
      <div class="quiz-result-msg">${escapeHtml(msg)}</div>
      ${buttonsHtml}
    </div>
  `;
  const restart = document.getElementById("quiz-restart");
  if (restart) restart.addEventListener("click", () => renderQuizStart(data));
  const retry = document.getElementById("quiz-retry");
  if (retry) retry.addEventListener("click", () => {
    quizSelectedLevel = playedLevel;
    startQuiz(data);
  });
  const nextLevel = document.getElementById("quiz-next-level");
  if (nextLevel) nextLevel.addEventListener("click", () => {
    quizSelectedLevel = playedLevel + 1;
    startQuiz(data);
  });
}

// ================= User data (local storage) =================
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
  },
};

// ----- Marks: saved / highlight / note, keyed by "Book Ch:V" -----
const HL_CYCLE = ["", "gold", "green", "blue"];
function getMarks() { return Store.get("hope.marks", {}); }
function getMark(id) { return getMarks()[id] || {}; }
function updateMark(id, patch) {
  const marks = getMarks();
  const entry = { ...(marks[id] || {}), ...patch };
  if (!entry.saved && !entry.hl && !entry.note) delete marks[id];
  else marks[id] = entry;
  Store.set("hope.marks", marks);
}
function toggleSaved(id) {
  const m = getMark(id);
  updateMark(id, { saved: !m.saved });
}
function cycleHighlight(id) {
  const m = getMark(id);
  const next = HL_CYCLE[(HL_CYCLE.indexOf(m.hl || "") + 1) % HL_CYCLE.length];
  updateMark(id, { hl: next || undefined });
}
function setNote(id, text) {
  updateMark(id, { note: text.trim() || undefined });
}

// ----- Reading progress: chapters opened, keyed "Book Ch" -----
function getRead() { return Store.get("hope.read", {}); }
function markRead(book, chapter) {
  const r = getRead();
  const k = `${book} ${chapter}`;
  if (!r[k]) { r[k] = true; Store.set("hope.read", r); }
}
function bookReadCount(book) {
  const r = getRead();
  let n = 0;
  for (const k in r) if (k.startsWith(book + " ")) n++;
  return n;
}

// ----- Streak: consecutive days the app is opened -----
function updateStreak() {
  const s = Store.get("hope.streak", { last: null, count: 0, best: 0 });
  const today = new Date().toDateString();
  if (s.last === today) return s;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  s.count = s.last === yesterday ? s.count + 1 : 1;
  s.last = today;
  s.best = Math.max(s.best || 0, s.count);
  Store.set("hope.streak", s);
  return s;
}
function getStreak() { return Store.get("hope.streak", { count: 0, best: 0 }); }

// ----- Reading plan progress: { planId: [completedDayIndices] } -----
function getPlanProgress(planId) {
  return Store.get("hope.plans", {})[planId] || [];
}
function markPlanDay(planId, dayIdx) {
  const all = Store.get("hope.plans", {});
  const done = new Set(all[planId] || []);
  done.add(dayIdx);
  all[planId] = [...done].sort((a, b) => a - b);
  Store.set("hope.plans", all);
}

// ================= "Me" hub =================
function renderMeHub(data) {
  const streak = getStreak();
  const marks = getMarks();
  const ids = Object.keys(marks);
  const savedN = ids.filter((i) => marks[i].saved).length;
  const hlN = ids.filter((i) => marks[i].hl).length;
  const noteN = ids.filter((i) => marks[i].note).length;
  const chaptersRead = Object.keys(getRead()).length;

  document.getElementById("me-body").innerHTML = `
    <h2>Your walk with God</h2>
    <div class="me-stats">
      <div class="me-stat"><div class="me-stat-n">${streak.count}</div><div class="me-stat-l">day streak</div></div>
      <div class="me-stat"><div class="me-stat-n">${chaptersRead}</div><div class="me-stat-l">chapters read</div></div>
      <div class="me-stat"><div class="me-stat-n">${savedN}</div><div class="me-stat-l">verses saved</div></div>
    </div>
    ${streak.best > streak.count ? `<p class="muted small center">Longest streak: ${streak.best} days</p>` : ""}
    <div class="me-grid">
      <button class="me-card" data-view="plans"><span class="me-card-icon">📖</span>Reading Plans</button>
      <button class="me-card" data-view="saved"><span class="me-card-icon">★</span>Saved Verses<span class="me-card-n">${savedN}</span></button>
      <button class="me-card" data-view="highlights"><span class="me-card-icon">🖍</span>Highlights<span class="me-card-n">${hlN}</span></button>
      <button class="me-card" data-view="notes"><span class="me-card-icon">📝</span>Notes<span class="me-card-n">${noteN}</span></button>
      <button class="me-card" data-view="progress"><span class="me-card-icon">📊</span>Reading Progress</button>
    </div>
    <div class="me-theme">
      <span>Appearance</span>
      <div class="theme-toggle" id="theme-toggle">
        <button data-theme="dark"${currentTheme() === "dark" ? ' class="active"' : ""}>Dark</button>
        <button data-theme="light"${currentTheme() === "light" ? ' class="active"' : ""}>Light</button>
      </div>
    </div>
    <div class="me-theme">
      <span>Reading voice</span>
      <select id="voice-select"></select>
    </div>
  `;
  document.querySelectorAll(".me-card").forEach((b) => {
    b.addEventListener("click", () => openMeView(b.dataset.view, data));
  });
  document.querySelectorAll("#theme-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      setTheme(b.dataset.theme);
      renderMeHub(data);
    });
  });
  populateMeVoiceSelect();
}

function currentTheme() {
  try { return localStorage.getItem("hope.theme") === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}
function setTheme(mode) {
  try { localStorage.setItem("hope.theme", mode); } catch { /* ignore */ }
  document.documentElement.classList.toggle("light", mode === "light");
}

function openMeView(view, data) {
  if (view === "plans") renderMePlans(data);
  else if (view === "saved") renderMarkList(data, "saved");
  else if (view === "highlights") renderMarkList(data, "highlights");
  else if (view === "notes") renderMarkList(data, "notes");
  else if (view === "progress") renderMeProgress(data);
}

// Saved / Highlights / Notes lists
function renderMarkList(data, kind) {
  const titles = { saved: "Saved Verses", highlights: "Highlights", notes: "Notes" };
  const marks = getMarks();
  let ids = Object.keys(marks);
  if (kind === "saved") ids = ids.filter((i) => marks[i].saved);
  else if (kind === "highlights") ids = ids.filter((i) => marks[i].hl);
  else ids = ids.filter((i) => marks[i].note);
  // Sort by canonical Bible order
  ids.sort((a, b) => {
    try {
      const ra = parseRef(a), rb = parseRef(b);
      return (BOOKS_66.indexOf(ra.book) - BOOKS_66.indexOf(rb.book))
        || (ra.chapter - rb.chapter) || (ra.verseStart - rb.verseStart);
    } catch { return 0; }
  });

  let body = `<h2>${titles[kind]}</h2>`;
  if (ids.length === 0) {
    body += `<p class="muted">Nothing here yet. Open the Bible, tap a verse, and you can save, highlight, or note it.</p>`;
  } else {
    body += ids.map((id) => {
      const m = marks[id];
      let txt = "";
      try {
        const ref = parseRef(id);
        txt = getRange("kjv", ref, data)[0]?.text || "";
      } catch { /* ignore */ }
      const hlClass = (kind === "highlights" && m.hl) ? ` hl-${m.hl}` : "";
      return `
        <div class="mark-item${hlClass}">
          <button class="mark-ref" data-ref="${escapeHtml(id)}">${escapeHtml(id)} ›</button>
          <div class="mark-text">${escapeHtml(txt)}</div>
          ${kind === "notes" && m.note ? `<div class="mark-note">${escapeHtml(m.note)}</div>` : ""}
        </div>`;
    }).join("");
  }
  showMeSub(body, data);
  document.querySelectorAll(".mark-ref").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        const ref = parseRef(btn.dataset.ref);
        renderBibleRead(ref.book, ref.chapter, bibleState.tx, data);
      } catch { /* ignore */ }
    });
  });
}

// Reading progress per book
function renderMeProgress(data) {
  let body = `<h2>Reading Progress</h2><p class="muted small">Chapters are marked as you open them in the Bible.</p>`;
  body += `<div class="progress-list">`;
  BOOKS_66.forEach((book, i) => {
    const total = data.kjv[i].chapters.length;
    const read = bookReadCount(book);
    const pct = Math.round((read / total) * 100);
    body += `
      <div class="progress-row">
        <div class="progress-book">${escapeHtml(book)}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-count">${read}/${total}</div>
      </div>`;
  });
  body += `</div>`;
  showMeSub(body, data);
}

// Reading plans list
function renderMePlans(data) {
  let body = `<h2>Reading Plans</h2><p class="muted small">Pick a journey through Scripture. Each day opens a chapter to read.</p>`;
  body += `<div class="plan-list">`;
  for (const plan of data.plans) {
    const done = getPlanProgress(plan.id).length;
    const total = plan.days.length;
    const pct = Math.round((done / total) * 100);
    body += `
      <button class="plan-card" data-plan="${escapeHtml(plan.id)}">
        <div class="plan-card-title">${escapeHtml(plan.title)}</div>
        <div class="plan-card-desc">${escapeHtml(plan.desc)}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="plan-card-meta">${done} of ${total} days${done >= total ? " · complete ✓" : ""}</div>
      </button>`;
  }
  body += `</div>`;
  showMeSub(body, data);
  document.querySelectorAll(".plan-card").forEach((b) => {
    b.addEventListener("click", () => renderPlanDetail(b.dataset.plan, data));
  });
}

function renderPlanDetail(planId, data) {
  const plan = data.plans.find((p) => p.id === planId);
  if (!plan) return;
  const done = new Set(getPlanProgress(planId));
  let body = `<h2>${escapeHtml(plan.title)}</h2><p class="muted">${escapeHtml(plan.desc)}</p>`;
  body += `<div class="plan-days">`;
  plan.days.forEach((day, i) => {
    const isDone = done.has(i);
    body += `
      <button class="plan-day${isDone ? " done" : ""}" data-idx="${i}" data-ref="${escapeHtml(day.ref)}">
        <span class="plan-day-num">${isDone ? "✓" : i + 1}</span>
        <span class="plan-day-info">
          <span class="plan-day-label">${escapeHtml(day.label)}</span>
          <span class="plan-day-ref">${escapeHtml(day.ref)}</span>
        </span>
      </button>`;
  });
  body += `</div>`;
  showMeSub(body, data, () => renderMePlans(data));
  document.querySelectorAll(".plan-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      markPlanDay(planId, +btn.dataset.idx);
      try {
        const ref = parseRef(btn.dataset.ref);
        renderBibleRead(ref.book, ref.chapter, bibleState.tx, data);
      } catch { /* ignore */ }
    });
  });
}

// Render a sub-view into #me-sub; backFn customises the back button target.
function showMeSub(bodyHtml, data, backFn) {
  document.getElementById("me-sub-body").innerHTML = bodyHtml;
  const back = document.getElementById("me-sub-back");
  back.onclick = backFn || (() => { renderMeHub(data); show("me"); });
  show("me-sub");
}

// ---------- Boot ----------
async function tryFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

// Load WEB + ASV after the app is interactive, so startup isn't blocked by
// ~8MB of extra translations. The translation toggle re-renders as each arrives.
async function loadExtraTranslations(data) {
  const web = await tryFetch("data/web.json");
  if (web) { data.web = JSON.parse(web); renderTxToggle(data); }
  const asv = await tryFetch("data/asv.json");
  if (asv) { data.asv = JSON.parse(asv); renderTxToggle(data); }
}

async function boot() {
  // Load only what the app needs to start (KJV + BSB + small data).
  // WEB and ASV stream in afterward — see loadExtraTranslations below.
  const [kjvText, bsbText, topics, daily, voice, quiz, plans] = await Promise.all([
    fetch("data/kjv.json").then((r) => r.text()),
    fetch("data/bsb.json").then((r) => r.text()),
    fetch("data/topics.json").then((r) => r.json()),
    fetch("data/daily.json").then((r) => r.json()),
    fetch("data/voice.json").then((r) => r.json()),
    fetch("data/quiz.json").then((r) => r.json()),
    fetch("data/plans.json").then((r) => r.json()),
  ]);
  const data = {
    kjv: JSON.parse(kjvText.replace(/^﻿/, "")),
    bsb: JSON.parse(bsbText),
    topics, daily, voice, quiz, plans,
  };

  updateStreak();
  renderVod(data);
  renderTopicGrid(data);
  renderBibleBooks(data);
  renderTxToggle(data);
  renderMeHub(data);
  initVoices();
  show("daily");
  loadExtraTranslations(data); // WEB + ASV stream in without blocking startup

  // Re-render date-sensitive sections when the user returns to the app
  // (e.g. opened yesterday, reopened today — daily verse and streak should refresh).
  function refreshIfNewDay() {
    updateStreak();
    renderVod(data);
    if (document.getElementById("me")?.classList.contains("active")) renderMeHub(data);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshIfNewDay();
  });
  window.addEventListener("focus", refreshIfNewDay);

  // Bible browser handlers
  document.getElementById("back-to-chapters").addEventListener("click", () => {
    if (bibleState.book) renderBibleChapters(bibleState.book, data);
    else show("bible-books");
  });
  document.getElementById("reader-prev").addEventListener("click", () => navigateChapter(-1, data));
  document.getElementById("reader-next").addEventListener("click", () => navigateChapter(1, data));

  // Speak tab
  renderSpeakTab(data);

  // Quiz tab
  renderQuizStart(data);

  // Listen buttons (text-to-speech)
  const dailyListen = document.getElementById("daily-listen");
  const topicListen = document.getElementById("topic-listen");
  const readerListen = document.getElementById("reader-listen");
  if (!tts.supported) {
    [dailyListen, topicListen, readerListen].forEach((b) => b && (b.style.display = "none"));
  } else {
    readerListen.dataset.idleLabel = "▶ Listen to this chapter";
    dailyListen.addEventListener("click", () => tts.toggle(readable.daily, dailyListen));
    topicListen.addEventListener("click", () => tts.toggle(readable.topic, topicListen));
    readerListen.addEventListener("click", () => tts.toggle(readable.reader, readerListen));
  }

  // Tab nav
  document.querySelectorAll("nav button").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.tab === "me") renderMeHub(data);       // refresh stats on open
      if (b.dataset.tab === "speak") renderSpeakTab(data); // refresh countdown on open
      show(b.dataset.tab);
    });
  });
  document.querySelectorAll("[data-back]").forEach((b) => {
    b.addEventListener("click", () => show(b.dataset.back));
  });

  // Forms
  document.getElementById("lookup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    renderLookup(document.getElementById("lookup-input").value.trim(), data);
  });
  // Live as-you-type: book suggestions + results
  let lookupTimer;
  document.getElementById("lookup-input").addEventListener("input", (e) => {
    updateBookSuggestions(e.target.value);
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => renderLookup(e.target.value.trim(), data), 200);
  });
}

boot().catch((e) => {
  document.getElementById("loading").innerHTML =
    `<p class="muted">Failed to load: ${escapeHtml(e.message)}</p>`;
});
