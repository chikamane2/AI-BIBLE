// Maps canonical book names to OSIS codes used by API.Bible verse IDs.
// e.g. "John" -> "JHN", so John 3:16 becomes "JHN.3.16".

export const BOOKS_66 = [
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

export const OSIS = {
  "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
  "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH",
  "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
  "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER",
  "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS",
  "Joel": "JOL", "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC",
  "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG",
  "Zechariah": "ZEC", "Malachi": "MAL", "Matthew": "MAT", "Mark": "MRK",
  "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Romans": "ROM",
  "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL",
  "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI",
  "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB",
  "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN",
  "2 John": "2JN", "3 John": "3JN", "Jude": "JUD", "Revelation": "REV",
};

// Common abbreviations users might type
const ALIASES = {
  "gen": "Genesis", "ex": "Exodus", "exod": "Exodus", "lev": "Leviticus",
  "num": "Numbers", "deut": "Deuteronomy", "deu": "Deuteronomy", "josh": "Joshua",
  "jos": "Joshua", "judg": "Judges", "jdg": "Judges", "ru": "Ruth",
  "1sam": "1 Samuel", "1 sam": "1 Samuel", "2sam": "2 Samuel", "2 sam": "2 Samuel",
  "1kgs": "1 Kings", "1 kgs": "1 Kings", "2kgs": "2 Kings", "2 kgs": "2 Kings",
  "1chr": "1 Chronicles", "1 chr": "1 Chronicles", "2chr": "2 Chronicles", "2 chr": "2 Chronicles",
  "neh": "Nehemiah", "est": "Esther", "ps": "Psalms", "psa": "Psalms",
  "psalm": "Psalms", "prov": "Proverbs", "pro": "Proverbs", "eccl": "Ecclesiastes",
  "ecc": "Ecclesiastes", "song": "Song of Solomon", "sos": "Song of Solomon",
  "ss": "Song of Solomon", "isa": "Isaiah", "jer": "Jeremiah",
  "lam": "Lamentations", "ezek": "Ezekiel", "ezk": "Ezekiel", "dan": "Daniel",
  "hos": "Hosea", "obad": "Obadiah", "oba": "Obadiah", "jon": "Jonah",
  "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk", "zeph": "Zephaniah",
  "zep": "Zephaniah", "hag": "Haggai", "zech": "Zechariah", "zec": "Zechariah",
  "mal": "Malachi", "matt": "Matthew", "mt": "Matthew", "mk": "Mark",
  "lk": "Luke", "jn": "John", "rom": "Romans",
  "1cor": "1 Corinthians", "1 cor": "1 Corinthians", "2cor": "2 Corinthians", "2 cor": "2 Corinthians",
  "gal": "Galatians", "eph": "Ephesians", "phil": "Philippians", "php": "Philippians",
  "col": "Colossians", "1thess": "1 Thessalonians", "1 thess": "1 Thessalonians",
  "2thess": "2 Thessalonians", "2 thess": "2 Thessalonians",
  "1tim": "1 Timothy", "1 tim": "1 Timothy", "2tim": "2 Timothy", "2 tim": "2 Timothy",
  "tit": "Titus", "phlm": "Philemon", "phm": "Philemon", "heb": "Hebrews",
  "jas": "James", "jam": "James",
  "1pet": "1 Peter", "1 pet": "1 Peter", "2pet": "2 Peter", "2 pet": "2 Peter",
  "1jn": "1 John", "1 jn": "1 John", "2jn": "2 John", "2 jn": "2 John",
  "3jn": "3 John", "3 jn": "3 John", "rev": "Revelation",
};

// Levenshtein edit distance (iterative, two-row).
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

export function normalizeBook(name) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  // 1. exact match
  if (BOOKS_66.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  // 2. known alias
  if (ALIASES[lower]) return ALIASES[lower];
  // 3. case-insensitive exact
  const ci = BOOKS_66.find((b) => b.toLowerCase() === lower);
  if (ci) return ci;
  // 4. prefix match (partial typing) — only if unambiguous
  const compact = lower.replace(/\s+/g, "");
  const prefixHits = BOOKS_66.filter((b) =>
    b.toLowerCase().replace(/\s+/g, "").startsWith(compact),
  );
  if (prefixHits.length === 1) return prefixHits[0];
  // 5. fuzzy match (misspellings) — pick closest within a length-based threshold
  let best = null, bestDist = Infinity;
  for (const b of BOOKS_66) {
    const d = editDistance(lower, b.toLowerCase());
    if (d < bestDist) { bestDist = d; best = b; }
  }
  const threshold = Math.max(2, Math.ceil(lower.length / 3));
  if (best && bestDist <= threshold) return best;
  return null;
}
