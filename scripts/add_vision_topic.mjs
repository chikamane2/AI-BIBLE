// One-shot: add the "vision" topic to lib/topics.json.
// Idempotent — re-running overwrites the vision entry with the same content.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(__dirname, "..", "lib/topics.json");

const VISION = {
  title: "When you need vision and direction",
  aliases: ["vision", "direction", "destiny", "assignment", "goals", "future"],
  intro: "Where there is no vision, the people perish.",
  message: "Where there is no vision, the people perish. That verse is not poetry — it is a warning. The Hebrew word for perish means to run wild, to cast off restraint, to drift with no anchor. A life without a God-given vision does not just stall; it scatters. But here is the good news: vision is not something you must invent. It is something God has already prepared. Before you were formed in the womb, He knew you and ordained your days. You were created in Christ Jesus for good works that He prepared beforehand. Your task is not to manufacture a purpose — it is to discover the one already written over your life. And when you find it, write it down, make it plain, and run. Though it tarries, wait for it; it will surely come. A vision from God will cost you something, and it will carry you through every hard season. It is the compass that keeps a soul from wandering. Do not chase it for wealth or applause — chase it because your life was meant to count for Him.",
  refs: [
    { ref: "Proverbs 29:18", note: "Where there is no vision, the people perish — but the one who keeps God's word is blessed." },
    { ref: "Habakkuk 2:2-3", note: "Write the vision and make it plain; though it tarries, wait for it — it will surely come." },
    { ref: "Jeremiah 1:5", note: "Before I formed you in the womb I knew you; before you were born I set you apart." },
    { ref: "Ephesians 2:10", note: "We are His workmanship, created for good works God prepared beforehand." },
    { ref: "Philippians 3:13-14", note: "Forgetting what is behind, I press toward the goal for the prize of God's upward call." },
  ],
  prayer: "Father, where there is no vision I drift. Show me what You made me for. Open my eyes to the assignment You wrote over my life before I was born. Make it plain to me. Give me courage to write it down and patience to pursue it. I do not want to run wild — I want to run with purpose, toward You.",
  declaration: "I am not without vision. God ordained a purpose for me before I was born. I am His workmanship, created for good works prepared in advance. I write the vision, I wait for it, and I press toward the goal.",
};

const topics = JSON.parse(readFileSync(PATH, "utf8"));
topics.vision = VISION;
writeFileSync(PATH, JSON.stringify(topics, null, 2), "utf8");
console.log(`✓ vision topic added — ${Object.keys(topics).length} topics total`);
