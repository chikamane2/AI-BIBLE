// LLM-powered "ask the Bible" — uses Claude API.
// Pulls relevant topic verses as context, asks Claude to answer faithfully
// from Scripture. Graceful fallback if ANTHROPIC_API_KEY is missing.

import {
  loadTopics, findTopic, parseRef, refToString, getRange,
} from "./bible.mjs";

const MODEL = "claude-opus-4-7";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a faithful Bible study assistant for an evangelism app.
Your job: answer questions from Scripture, with hope and honesty.

Rules:
- Quote verses verbatim from the context provided. Don't paraphrase Scripture as if it were a verse.
- Always cite the reference (e.g., "Romans 8:28") when quoting.
- If a question is sensitive (mental health, suicide, abuse, addiction), affirm hope from Scripture AND name the limit: "please also reach out to a pastor or professional."
- Don't invent doctrine. If Scripture is silent or unclear, say so.
- Don't push prosperity-gospel readings. Be honest about wealth, suffering, and hardship.
- Keep answers warm but grounded. Aim for 200-400 words.
- Use the verses given as primary source. You may add brief explanation, but the verses do the heavy lifting.`;

function gatherContext(question) {
  // Find the most relevant topic for this question (simple keyword overlap)
  const topics = loadTopics();
  const q = question.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [name, t] of Object.entries(topics)) {
    let score = 0;
    if (q.includes(name)) score += 5;
    for (const a of (t.aliases || [])) {
      if (q.includes(a.toLowerCase())) score += 3;
    }
    // also score on title words
    for (const w of t.title.toLowerCase().split(/\s+/)) {
      if (w.length > 4 && q.includes(w)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = { name, ...t }; }
  }

  if (!best || bestScore === 0) {
    // No good topic match — give the model a small generic set
    best = { name: "general", title: "General", refs: [
      { ref: "John 3:16" }, { ref: "Romans 8:28" }, { ref: "Philippians 4:13" },
      { ref: "Psalms 23:1-6" }, { ref: "Matthew 6:33" },
    ]};
  }

  const passages = [];
  for (const r of best.refs) {
    try {
      const ref = parseRef(r.ref);
      const kjv = getRange("kjv", ref);
      const bsb = getRange("bsb", ref);
      passages.push({
        ref: refToString(ref),
        note: r.note || "",
        kjv: kjv.map((v) => `${v.verse} ${v.text}`).join(" "),
        bsb: bsb.map((v) => `${v.verse} ${v.text}`).join(" "),
      });
    } catch { /* skip bad refs */ }
  }
  return { topic: best.name, topicTitle: best.title, passages };
}

function buildUserMessage(question, ctx) {
  const lines = [];
  lines.push(`Question: ${question}`);
  lines.push("");
  lines.push(`Most relevant topic from our app: ${ctx.topicTitle}`);
  lines.push("");
  lines.push("Relevant passages (use these as your source):");
  lines.push("");
  for (const p of ctx.passages) {
    lines.push(`${p.ref}${p.note ? ` — ${p.note}` : ""}`);
    lines.push(`  KJV: ${p.kjv}`);
    lines.push(`  BSB: ${p.bsb}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function askLLM(question) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return [
      "ANTHROPIC_API_KEY is not set in .env, so I can't call Claude.",
      "",
      "To enable `bible ask`:",
      "  1. Get an API key at console.anthropic.com",
      "  2. Add it to .env:  ANTHROPIC_API_KEY=sk-ant-...",
      "",
      "In the meantime, try `bible " + (findTopic(question)?.name || "topics") + "` for curated verses.",
    ].join("\n");
  }

  const ctx = gatherContext(question);
  const userMessage = buildUserMessage(question, ctx);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = (json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return text + "\n\n— answered from Scripture in the topic '" + ctx.topic + "'.";
}
