import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG = {
  pdfDirectory: path.join(ROOT, "pdfs"),
  extractedDirectory: path.join(ROOT, "sources", "extracted"),
  indexPageWindow: 18,
  output: path.join(ROOT, "glossary", "manual-glossary.json"),
};

const KIND_ALIASES = new Map([
  ["trait", "rasgo"],
  ["weapon trait", "rasgo de arma"],
  ["armor trait", "rasgo de armadura"],
  ["damage type", "tipo de daño"],
  ["condition", "estado"],
  ["skill", "habilidad"],
  ["skill action", "accion de habilidad"],
  ["basic action", "accion basica"],
  ["specialty basic action", "accion basica de especialidad"],
  ["activity", "actividad"],
  ["exploration activity", "actividad de exploracion"],
  ["class", "clase"],
  ["material", "material"],
]);

const MANUAL_SEEDS = [
  ["AC", "CA"],
  ["DC", "CD"],
  ["Armor Class", "Clase de armadura"],
  ["class DC", "CD de clase"],
  ["alchemist", "alquimista"],
  ["barbarian", "bárbaro"],
  ["bard", "bardo"],
  ["champion", "campeón"],
  ["cleric", "clérigo"],
  ["druid", "druida"],
  ["fighter", "guerrero"],
  ["monk", "monje"],
  ["ranger", "explorador"],
  ["rogue", "pícaro"],
  ["sorcerer", "hechicero"],
  ["wizard", "mago"],
  ["Acrobatics", "acrobacias"],
  ["Arcana", "Arcanos"],
  ["Athletics", "Atletismo"],
  ["Crafting", "Artesanía"],
  ["Deception", "Engaño"],
  ["Diplomacy", "Diplomacia"],
  ["Intimidation", "Intimidación"],
  ["Lore", "Saber"],
  ["Medicine", "Medicina"],
  ["Nature", "Naturaleza"],
  ["Occultism", "Ocultismo"],
  ["Performance", "Interpretación"],
  ["Religion", "Religión"],
  ["Society", "Sociedad"],
  ["Stealth", "Sigilo"],
  ["Survival", "Supervivencia"],
  ["Thievery", "Latrocinio"],
  ["Climb", "Trepar"],
  ["Coerce", "Coaccionar"],
  ["Command an Animal", "Comandar a un animal"],
  ["Cover Tracks", "Cubrir rastro"],
  ["Demoralize", "Desmoralizar"],
  ["Force Open", "Abrir por la fuerza"],
  ["Grab", "Presa"],
  ["Hide an Object", "Ocultar un objeto"],
  ["Interact", "Interactuar"],
  ["Pick a Lock", "Forzar una cerradura"],
];

function extractIndex(config) {
  fs.mkdirSync(path.dirname(config.extracted), { recursive: true });
  execFileSync("pdftotext", [
    "-f",
    String(config.firstPage),
    "-l",
    String(config.lastPage),
    "-layout",
    config.pdf,
    config.extracted,
  ]);
}

function pdfPageCount(pdf) {
  const output = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  const match = output.match(/^Pages:\s+(\d+)$/m);
  if (!match) throw new Error(`Could not determine page count for ${path.relative(ROOT, pdf)}`);
  return Number(match[1]);
}

function discoverManualPairs() {
  if (!fs.existsSync(CONFIG.pdfDirectory)) {
    throw new Error(`Missing PDF directory: ${path.relative(ROOT, CONFIG.pdfDirectory)}`);
  }

  const files = fs.readdirSync(CONFIG.pdfDirectory);
  const pairs = files
    .map((file) => file.match(/^(.+)-eng\.pdf$/)?.[1])
    .filter(Boolean)
    .map((base) => ({
      base,
      english: path.join(CONFIG.pdfDirectory, `${base}-eng.pdf`),
      spanish: path.join(CONFIG.pdfDirectory, `${base}-spa.pdf`),
    }))
    .filter((pair) => fs.existsSync(pair.spanish))
    .sort((a, b) => a.base.localeCompare(b.base, "en"));

  if (!pairs.length) {
    throw new Error("Missing PDF pairs. Expected local files named like manual-eng.pdf and manual-spa.pdf.");
  }

  return pairs;
}

function buildExtractionConfig(pdf, pairIndex, language) {
  const pages = pdfPageCount(pdf);
  const firstPage = Math.max(1, pages - CONFIG.indexPageWindow + 1);
  return {
    pdf,
    firstPage,
    lastPage: pages,
    extracted: path.join(CONFIG.extractedDirectory, `manual-${pairIndex}-${language}-index.txt`),
  };
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(a, b) {
  const left = [...a];
  const right = [...b];
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 0; i < left.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < right.length; j++) {
      const cost = left[i] === right[j] ? 0 : 1;
      current[j + 1] = Math.min(previous[j + 1] + 1, current[j] + 1, previous[j] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function similarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  const longest = Math.max(left.length, right.length);
  if (!longest) return 0;
  return 1 - levenshtein(left, right) / longest;
}

function normalizeKind(kind, language) {
  const normalized = normalizeText(kind.replace(/;.*$/, ""));
  if (language === "en") return KIND_ALIASES.get(normalized) ?? normalized;
  return normalized;
}

function normalizePages(pages) {
  return pages.replace(/[–—]/g, "-").replace(/\s+/g, "");
}

function hasUsableLetters(value) {
  return /\p{Letter}/u.test(value);
}

function shouldSkipLine(line) {
  const trimmed = line.trim();
  if (!trimmed || !hasUsableLetters(trimmed)) return true;
  if (/paizo\.com|honzo\.nebro|430\d+|169\d+/i.test(trimmed)) return true;
  if (/^(Glossary and Index|Glosario e [ií]ndice)$/i.test(trimmed)) return true;
  if (/^(Introduction|Ancestries &|Backgrounds|Classes|Skills|Feats|Equipment|Spells|Appendix)$/i.test(trimmed)) return true;
  return false;
}

function splitPageRefs(line) {
  const match = line.match(/(?:^|\s)((?:\d{1,3}(?:[-–]\d{1,3})?)(?:,\s*\d{1,3}(?:[-–]\d{1,3})?)*)\.?$/);
  if (!match) return { body: line, pages: "" };
  return {
    body: line.slice(0, match.index).trim(),
    pages: normalizePages(match[1]),
  };
}

function cleanTerm(term) {
  return term
    .replace(/\[(?:one|two|three|free)-action\]|\[reaction\]|\[una acci[oó]n\]/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^See also\s+/i, "")
    .trim();
}

function parseEntry(line, language) {
  const { body, pages } = splitPageRefs(line.trim());
  const parenthetical = body.match(/^(.{1,72}?)\s*\(([^)]+)\)(?:\s|$)/);
  if (parenthetical) {
    const term = cleanTerm(parenthetical[1]);
    const kind = normalizeKind(parenthetical[2], language);
    if (term && kind && isUsableTerm(term)) return { term, kind, pages };
  }

  return null;
}

function isUsableTerm(term) {
  if (!hasUsableLetters(term)) return false;
  if (term.length > 64) return false;
  if (/[.;:]/.test(term)) return false;
  if (term.split(/\s+/).length > 7) return false;
  if (/^\(?the\b/i.test(term)) return false;
  return true;
}

function lineSegments(line) {
  return line
    .split(/\s{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseEntries(filePath, language) {
  const entries = [];
  const seen = new Set();
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (shouldSkipLine(line)) continue;
    for (const segment of lineSegments(line)) {
      if (shouldSkipLine(segment)) continue;
      const entry = parseEntry(segment, language);
      if (!entry) continue;
      const key = `${normalizeText(entry.term)}|${entry.kind}|${entry.pages}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  return entries;
}

function indexSpanishEntries(entries) {
  const byKindAndPages = new Map();
  const byPages = new Map();

  for (const entry of entries) {
    const exactKey = `${entry.kind}|${entry.pages}`;
    if (!byKindAndPages.has(exactKey)) byKindAndPages.set(exactKey, []);
    byKindAndPages.get(exactKey).push(entry);

    if (entry.pages) {
      if (!byPages.has(entry.pages)) byPages.set(entry.pages, []);
      byPages.get(entry.pages).push(entry);
    }
  }

  return { byKindAndPages, byPages };
}

function findSpanishMatch(entry, index) {
  if (entry.kind && entry.pages) {
    const matches = index.byKindAndPages.get(`${entry.kind}|${entry.pages}`) ?? [];
    if (matches.length === 1) return { match: matches[0], confidence: "kind-pages" };
  }

  return null;
}

function buildGlossary(englishEntries, spanishEntries) {
  const spanishIndex = indexSpanishEntries(spanishEntries);
  const terms = [];
  const seen = new Set();
  const englishByTerm = new Map(englishEntries.map((entry) => [normalizeText(entry.term), entry]));
  const spanishByTerm = new Map(spanishEntries.map((entry) => [normalizeText(entry.term), entry]));

  function addTerm(term, translation, status, notes) {
    const key = `${normalizeText(term)}|${normalizeText(translation)}`;
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({
      source: "official bilingual PDF glossary-index",
      term,
      translation,
      status,
      notes,
    });
  }

  for (const [term, translation] of MANUAL_SEEDS) {
    const englishEntry = englishByTerm.get(normalizeText(term));
    const spanishEntry = spanishByTerm.get(normalizeText(translation));
    const pageNote = englishEntry?.pages ? `; English index pages ${englishEntry.pages}` : "";
    const spanishNote = spanishEntry?.pages ? `; Spanish index pages ${spanishEntry.pages}` : "";
    addTerm(term, translation, "approved", `Curated seed from official PDF glossary/index${pageNote}${spanishNote}.`);
  }

  for (const entry of englishEntries) {
    const result = findSpanishMatch(entry, spanishIndex);
    if (!result) continue;
    if (similarity(entry.term, result.match.term) < 0.52) continue;
    addTerm(
      entry.term,
      result.match.term,
      "needs_review",
      `Auto-matched from official PDF glossary/index by ${result.confidence}; pages ${entry.pages}; kind ${entry.kind}.`,
    );
  }

  terms.sort((a, b) => a.term.localeCompare(b.term, "en"));
  return terms;
}

function main() {
  const pairs = discoverManualPairs();
  const englishEntries = [];
  const spanishEntries = [];

  pairs.forEach((pair, index) => {
    const pairIndex = index + 1;
    const englishConfig = buildExtractionConfig(pair.english, pairIndex, "eng");
    const spanishConfig = buildExtractionConfig(pair.spanish, pairIndex, "spa");

    extractIndex(englishConfig);
    extractIndex(spanishConfig);

    englishEntries.push(...parseEntries(englishConfig.extracted, "en"));
    spanishEntries.push(...parseEntries(spanishConfig.extracted, "es"));
  });

  const terms = buildGlossary(englishEntries, spanishEntries);

  const glossary = {
    $schema: "./schema/glossary.schema.json",
    description:
      "Terms extracted from official Spanish manuals used locally as reference. Manual terminology has highest priority.",
    terms,
  };

  fs.writeFileSync(CONFIG.output, `${JSON.stringify(glossary, null, 2)}\n`);

  console.log(`PDF pairs processed: ${pairs.length}`);
  console.log(`English index entries: ${englishEntries.length}`);
  console.log(`Spanish index entries: ${spanishEntries.length}`);
  console.log(`Glossary candidates: ${terms.length}`);
  console.log(`Wrote ${path.relative(ROOT, CONFIG.output)}`);
}

main();
