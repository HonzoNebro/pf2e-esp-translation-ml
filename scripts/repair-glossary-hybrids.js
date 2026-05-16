import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["translation/es"];
const GLOSSARY_PATH = path.join(ROOT, "glossary", "manual-glossary.json");
const REPORT_PATH = path.join(ROOT, "sources", "reports", "glossary-hybrid-repair.json");

const ENGLISH_MARKERS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "become",
  "by",
  "can",
  "creature",
  "damage",
  "effect",
  "for",
  "from",
  "gain",
  "gains",
  "has",
  "if",
  "in",
  "is",
  "of",
  "once",
  "or",
  "saving",
  "spell",
  "success",
  "target",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "until",
  "when",
  "while",
  "with",
  "you",
  "your",
]);

const SPANISH_MARKERS = new Set([
  "a",
  "al",
  "como",
  "con",
  "contra",
  "cuando",
  "de",
  "del",
  "durante",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "hasta",
  "la",
  "las",
  "los",
  "o",
  "para",
  "por",
  "que",
  "si",
  "su",
  "sus",
  "te",
  "tu",
  "una",
  "un",
]);

const SHORT_ENGLISH_LABEL_MARKERS = new Set([
  "acid",
  "abyss",
  "abaddon",
  "amoeba",
  "anadi",
  "anaconda",
  "air",
  "animal",
  "animated",
  "architectural",
  "art",
  "armor",
  "assurance",
  "astronomy",
  "axis",
  "badger",
  "bardic",
  "bat",
  "battle",
  "beetle",
  "bloodseeker",
  "boon",
  "boneyard",
  "cat",
  "catch",
  "cave",
  "centipede",
  "check",
  "chameleon",
  "cloud",
  "cockroach",
  "confectionery",
  "cooking",
  "coppermouth",
  "crab",
  "crafting",
  "dark",
  "damage",
  "desert",
  "dimension",
  "dragon",
  "dragonfly",
  "dreamlands",
  "dungeon",
  "dwelling",
  "earth",
  "effect",
  "elemental",
  "elysium",
  "engineering",
  "fangtooth",
  "farming",
  "festival",
  "fire",
  "first",
  "flea",
  "fleshwarp",
  "flying",
  "forest",
  "forge",
  "frost",
  "frog",
  "games",
  "gem",
  "genealogy",
  "geology",
  "giant",
  "heaven",
  "hill",
  "household",
  "hunter",
  "instinct",
  "jellyfish",
  "jistka",
  "kobold",
  "labor",
  "lands",
  "leathers",
  "leech",
  "legal",
  "legend",
  "lightning",
  "lizard",
  "lore",
  "mantis",
  "manticore",
  "merfolk",
  "millinery",
  "minotaur",
  "moderate",
  "monastic",
  "monitor",
  "mosquito",
  "natural",
  "nirvana",
  "nymph",
  "ocean",
  "only",
  "opossum",
  "pangolin",
  "pathfinder",
  "performance",
  "planar",
  "plague",
  "pole",
  "porcupine",
  "rat",
  "saga",
  "sailing",
  "samsaran",
  "sarangay",
  "scorpion",
  "sea",
  "seahorse",
  "serpent",
  "seven",
  "skeletal",
  "signature",
  "skill",
  "skunk",
  "slug",
  "snare",
  "snared",
  "snapping",
  "spider",
  "specialty",
  "squid",
  "storm",
  "styx",
  "summon",
  "swamp",
  "tapir",
  "tardigrade",
  "tanuki",
  "tengu",
  "tick",
  "time",
  "toad",
  "tomb",
  "torture",
  "turtle",
  "undead",
  "variant",
  "venom",
  "viper",
  "vulture",
  "warfare",
  "wasp",
  "wayang",
  "weak",
  "wolverine",
  "wood",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term) {
  const escaped = escapeRegExp(term).replace(/\s+/g, "\\s+");
  const startsWithWord = /^\p{L}|\d/u.test(term);
  const endsWithWord = /\p{L}|\d$/u.test(term);
  return new RegExp(`${startsWithWord ? "(?<![\\p{L}\\d])" : ""}${escaped}${endsWithWord ? "(?![\\p{L}\\d])" : ""}`, "giu");
}

function loadReverseTerms() {
  const glossary = JSON.parse(fs.readFileSync(GLOSSARY_PATH, "utf8"));
  return glossary.terms
    .filter((term) => term.status === "approved")
    .filter((term) => term.term.length > 2)
    .filter((term) => term.translation.length > 1)
    .sort((a, b) => b.translation.length - a.translation.length || a.translation.localeCompare(b.translation))
    .map((term) => ({
      english: term.term,
      spanish: term.translation,
      pattern: termPattern(term.translation),
    }));
}

function expandTarget(target) {
  const absolutePath = path.join(ROOT, target);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...expandTarget(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }

  return files;
}

function words(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/@UUID\[[^\]]+\]\{[^}]+\}/g, " ")
    .match(/\p{L}+/gu) ?? [];
}

function languageScore(value) {
  let english = 0;
  let spanish = 0;

  for (const rawWord of words(value)) {
    const word = rawWord.toLocaleLowerCase("es");
    if (ENGLISH_MARKERS.has(word)) english += 1;
    if (SPANISH_MARKERS.has(word)) spanish += 1;
  }

  if (/<strong>(?:Frequency|Trigger|Effect|Critical Success|Critical Failure|Failure|Success|Requirements?|Activate|Duration|Area|Target|Saving Throw|Heightened|Prerequisites?)<\/strong>/i.test(value)) {
    english += 4;
  }

  if (/<strong>(?:Frecuencia|Desencadenante|Efecto|Éxito crítico|Fallo crítico|Fallo|Éxito|Requisitos?|Activar|Duración|Área|Objetivo|Tirada de salvación|Intensificado|Prerrequisitos?)<\/strong>/i.test(value)) {
    spanish += 4;
  }

  return { english, spanish };
}

function isLikelyEnglishString(value) {
  const { english, spanish } = languageScore(value);
  return english >= 3 && english >= spanish + 2;
}

function isLikelyHybridShortLabel(value, terms) {
  if (value.length > 140) return false;

  const valueWords = words(value).map((word) => word.toLocaleLowerCase("en"));
  if (!valueWords.some((word) => SHORT_ENGLISH_LABEL_MARKERS.has(word))) return false;
  if (valueWords.some((word) => SPANISH_MARKERS.has(word))) return false;

  return terms.some((term) => {
    term.pattern.lastIndex = 0;
    return term.pattern.test(value);
  });
}

function replaceHybridTerms(value, terms, replacements) {
  if (!isLikelyEnglishString(value) && !isLikelyHybridShortLabel(value, terms)) return value;

  let result = value;
  for (const term of terms) {
    term.pattern.lastIndex = 0;
    result = result.replace(term.pattern, (match) => {
      if (/^\p{Lu}/u.test(term.spanish) && !/^\p{Lu}/u.test(match)) return match;
      replacements.push({ from: match, to: term.english });
      return match[0] === match[0]?.toLocaleUpperCase("es")
        ? term.english.toLocaleUpperCase("en")
        : term.english;
    });
  }

  return result;
}

function reverseGlossaryTerms(value, terms, replacements) {
  let result = value;
  for (const term of terms) {
    term.pattern.lastIndex = 0;
    result = result.replace(term.pattern, (match) => {
      if (/^\p{Lu}/u.test(term.spanish) && !/^\p{Lu}/u.test(match)) return match;
      replacements.push({ from: match, to: term.english });
      return match[0] === match[0]?.toLocaleUpperCase("es")
        ? term.english.toLocaleUpperCase("en")
        : term.english;
    });
  }
  return result;
}

function repairFromEnglishSource(value, sourceValue, terms, replacements) {
  if (typeof sourceValue !== "string") return value;
  const restored = reverseGlossaryTerms(value, terms, replacements);
  if (restored === sourceValue && restored !== value) return restored;
  if (restored.toLocaleLowerCase("en") === sourceValue.toLocaleLowerCase("en") && restored !== value) {
    return sourceValue;
  }
  replacements.length = 0;
  return value;
}

function repairInlineHybridLabels(value, terms, replacements) {
  let result = value.replace(/(@UUID\[[^\]]+\]\s*\{)([^}]+)(\})/g, (match, prefix, label, suffix) => {
    if (!isLikelyHybridShortLabel(label, terms)) return match;
    const updated = reverseGlossaryTerms(label, terms, replacements);
    return updated === label ? match : `${prefix}${updated}${suffix}`;
  });

  result = result.replace(/(^|[^\]])\{([^{}]+)\}/g, (match, before, label) => {
    if (!isLikelyHybridShortLabel(label, terms)) return match;
    const updated = reverseGlossaryTerms(label, terms, replacements);
    return updated === label ? match : `${before}{${updated}}`;
  });

  result = result.replace(/\b([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*){0,3})\s+Saber\b/g, (match, prefix) => {
    const label = `${prefix} Saber`;
    if (!isLikelyHybridShortLabel(label, terms)) return match;
    replacements.push({ from: "Saber", to: "Lore" });
    return `${prefix} Lore`;
  });

  return result;
}

function walk(value, terms, changes, currentPath = [], sourceValue = undefined) {
  if (typeof value === "string") {
    const replacements = [];
    let updated = repairFromEnglishSource(value, sourceValue, terms, replacements);
    if (updated === value) updated = repairInlineHybridLabels(value, terms, replacements);
    if (updated === value) updated = replaceHybridTerms(value, terms, replacements);
    if (updated !== value) {
      changes.push({
        path: pathToString(currentPath),
        replacements,
      });
    }
    return updated;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => walk(item, terms, changes, currentPath.concat(index), sourceValue?.[index]));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walk(item, terms, changes, currentPath.concat(key), sourceValue?.[key])]),
    );
  }

  return value;
}

function pathToString(parts) {
  return parts
    .map((part) => {
      if (typeof part === "number") return `[${part}]`;
      if (/^[A-Za-z_$][\w$-]*$/.test(part)) return `.${part}`;
      return `[${JSON.stringify(part)}]`;
    })
    .join("")
    .replace(/^\./, "");
}

function processFile(filePath, terms, write) {
  const absolutePath = path.join(ROOT, filePath);
  const original = fs.readFileSync(absolutePath, "utf8");
  const data = JSON.parse(original);
  const sourcePath = filePath
    .replace(/^translation\/es\//, "translation/en/")
    .replace(/\/pf2e\./, "/");
  const absoluteSourcePath = path.join(ROOT, sourcePath);
  const sourceData = fs.existsSync(absoluteSourcePath)
    ? JSON.parse(fs.readFileSync(absoluteSourcePath, "utf8"))
    : undefined;
  const changes = [];
  const updated = walk(data, terms, changes, [], sourceData);

  if (write && changes.length) {
    fs.writeFileSync(absolutePath, `${JSON.stringify(updated, null, 2)}\n`);
  }

  return {
    file: filePath,
    changes,
    replacementCount: changes.reduce((sum, change) => sum + change.replacements.length, 0),
  };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const targets = args.filter((arg) => arg !== "--write");
  const files = (targets.length ? targets : DEFAULT_TARGETS)
    .flatMap((target) => expandTarget(target))
    .sort((a, b) => a.localeCompare(b));
  const terms = loadReverseTerms();
  const results = files.map((file) => processFile(file, terms, write));
  const changed = results.filter((result) => result.changes.length);
  const total = changed.reduce((sum, result) => sum + result.replacementCount, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: write ? "write" : "dry-run",
    filesChecked: files.length,
    filesChanged: changed.length,
    replacements: total,
    results: changed,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Mode: ${report.mode}`);
  console.log(`Files checked: ${report.filesChecked}`);
  console.log(`Files with hybrid glossary repairs: ${report.filesChanged}`);
  console.log(`Replacements: ${report.replacements}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  for (const result of changed.sort((a, b) => b.replacementCount - a.replacementCount).slice(0, 20)) {
    console.log(`- ${result.replacementCount}: ${result.file}`);
  }
}

main();
