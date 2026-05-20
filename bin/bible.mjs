#!/usr/bin/env node
// Hope Finder CLI
//
// Usage:
//   node bin/bible.mjs <topic>            — find verses for a topic ("hope", "fear", ...)
//   node bin/bible.mjs ref <reference>    — look up a reference (KJV + BSB)
//   node bin/bible.mjs compare <ref>      — KJV + BSB + NKJV side by side
//   node bin/bible.mjs topics             — list all topics
//   node bin/bible.mjs help               — usage

import {
  parseRef, refToString, getRange, getNKJV,
  loadTopics, findTopic, searchTextSafe, verseOfTheDay,
} from "../lib/bible.mjs";
import { askLLM } from "../lib/ask.mjs";

// ---------- ANSI helpers (no deps) ----------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s);
const dim  = (s) => c("2", s);
const cyan = (s) => c("36", s);
const yellow = (s) => c("33", s);
const green = (s) => c("32", s);
const red  = (s) => c("31", s);
const wrap = (text, width = 92, indent = "    ") => {
  const out = [];
  let line = indent;
  for (const word of text.split(/\s+/)) {
    if (line.length + word.length + 1 > width && line.trim()) {
      out.push(line.trimEnd());
      line = indent;
    }
    line += (line === indent ? "" : " ") + word;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out.join("\n");
};

const LOCAL_TRANSLATIONS = ["kjv", "bsb", "web", "asv"];

function tryGetRange(tx, ref) {
  try { return getRange(tx, ref); } catch { return null; }
}

function printLocalRef(ref) {
  console.log(bold(refToString(ref)));
  for (const tx of LOCAL_TRANSLATIONS) {
    const verses = tryGetRange(tx, ref);
    if (!verses) continue;
    console.log(cyan(`  ${tx.toUpperCase()}`));
    for (const { verse, text } of verses) {
      console.log(wrap(`${dim(verse + ":")} ${text}`));
    }
  }
}

async function printCompareRef(ref) {
  printLocalRef(ref);
  if (!ref.verseStart) {
    console.log(dim("  (NKJV fetch needs a specific verse — skipped)"));
    return;
  }
  try {
    const nkjv = await getNKJV(ref);
    console.log(cyan("  NKJV"));
    for (const { verse, text } of nkjv) {
      console.log(wrap(`${dim(verse + ":")} ${text}`));
    }
  } catch (e) {
    console.log(red(`  NKJV fetch failed: ${e.message}`));
  }
}

async function cmdTopic(query) {
  const t = findTopic(query);
  if (!t) {
    console.log(red(`No topic match for "${query}"`));
    console.log(dim(`Try one of: ${Object.keys(loadTopics()).join(", ")}`));
    process.exit(1);
  }
  console.log(yellow(`\n${t.title}`));
  console.log(c("3", t.intro) + "\n"); // italic
  if (t.message) {
    console.log(wrap(t.message, 92, "  "));
    console.log("");
  }
  console.log(yellow("  ── What God says ──") + "\n");
  for (const r of t.refs) {
    const ref = parseRef(r.ref);
    console.log(green(`▸ ${refToString(ref)}`) + dim(` — ${r.note}`));
    const kjv = getRange("kjv", ref);
    const bsb = getRange("bsb", ref);
    for (let i = 0; i < kjv.length; i++) {
      console.log(wrap(`${cyan("KJV")} ${kjv[i].verse}: ${kjv[i].text}`));
      console.log(wrap(`${cyan("BSB")} ${bsb[i].verse}: ${bsb[i].text}`));
    }
    console.log("");
  }
  if (t.prayer) {
    console.log(yellow("  ── Pray ──") + "\n");
    console.log(wrap(t.prayer, 92, "  "));
    console.log("");
  }
  if (t.declaration) {
    console.log(yellow("  ── Declare ──") + "\n");
    console.log(wrap(t.declaration, 92, "  "));
    console.log("");
  }
}

function cmdTopics() {
  const topics = loadTopics();
  console.log(yellow("\nAvailable topics:\n"));
  const width = Math.max(...Object.keys(topics).map((k) => k.length));
  for (const [name, t] of Object.entries(topics)) {
    console.log(`  ${green(name.padEnd(width))}  ${dim("—")} ${t.title}`);
  }
  console.log("");
}

function cmdSearch(query) {
  const results = searchTextSafe(query, "bsb", 25);
  if (results.length === 0) {
    console.log(red(`No verses contain "${query}"`));
    return;
  }
  console.log(yellow(`\n${results.length} verse(s) containing "${query}" (BSB):\n`));
  for (const { ref, text } of results) {
    console.log(green(`  ${ref}`));
    console.log(wrap(text, 92, "    "));
  }
  console.log("");
}

async function cmdVod() {
  const entry = verseOfTheDay();
  const ref = parseRef(entry.ref);
  console.log(yellow(`\n✦ Daily — ${new Date().toDateString()}\n`));
  printLocalRef(ref);
  console.log("");
  if (entry.sermon) {
    console.log(yellow("  ── Sermon ──") + "\n");
    console.log(wrap(entry.sermon, 92, "  "));
    console.log("");
  }
  if (entry.prayer) {
    console.log(yellow("  ── Prayer ──") + "\n");
    console.log(wrap(entry.prayer, 92, "  "));
    console.log("");
  }
  if (entry.declaration) {
    console.log(yellow("  ── Declaration ──") + "\n");
    console.log(wrap(entry.declaration, 92, "  "));
    console.log("");
  }
}

async function cmdAsk(question) {
  if (!question.trim()) {
    console.log(red("Usage: bible ask \"<your question>\""));
    process.exit(1);
  }
  console.log(dim("Thinking...\n"));
  const answer = await askLLM(question);
  console.log(answer);
  console.log("");
}

function cmdHelp() {
  console.log(`
${bold("Hope Finder")} — Bible study CLI

${yellow("Usage:")}
  bible ${green("<topic>")}              find verses for a topic
  bible ${green("ref")} <reference>      KJV + BSB lookup (e.g. "John 3:16", "Psalms 23")
  bible ${green("compare")} <reference>  KJV + BSB + NKJV side by side
  bible ${green("search")} <text>        full-text search across BSB
  bible ${green("vod")}                  verse of the day
  bible ${green("ask")} "<question>"     ask a Bible question (uses Claude)
  bible ${green("topics")}               list all topics
  bible ${green("help")}                 this help

${yellow("Examples:")}
  bible hope
  bible compare "John 3:16"
  bible search "mountain"
  bible vod
  bible ask "what does the Bible say about anxiety?"
`);
}

// ---------- main ----------
const argv = process.argv.slice(2);
if (argv.length === 0) {
  cmdHelp();
  process.exit(0);
}

const cmd = argv[0].toLowerCase();
try {
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    cmdHelp();
  } else if (cmd === "topics") {
    cmdTopics();
  } else if (cmd === "ref") {
    const ref = parseRef(argv.slice(1).join(" "));
    printLocalRef(ref);
  } else if (cmd === "compare") {
    const ref = parseRef(argv.slice(1).join(" "));
    await printCompareRef(ref);
  } else if (cmd === "search") {
    cmdSearch(argv.slice(1).join(" "));
  } else if (cmd === "vod") {
    await cmdVod();
  } else if (cmd === "ask") {
    await cmdAsk(argv.slice(1).join(" "));
  } else {
    // Treat the whole argv as a topic query
    await cmdTopic(argv.join(" "));
  }
} catch (e) {
  console.error(red(`Error: ${e.message}`));
  process.exit(1);
}
