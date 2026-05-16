import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["translation/es/compendium"];
const GLOSSARY_PATH = path.join(ROOT, "glossary", "manual-glossary.json");
const IGNORED_PHRASES_BY_TERM = new Map([
  ["Arcana", ["Cascada Arcana"]],
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

function isInsideDelimitedSyntax(value, index, open, close) {
  const lastOpen = value.lastIndexOf(open, index);
  const lastClose = value.lastIndexOf(close, index);
  return lastOpen > lastClose;
}

function shouldIgnoreMatch(value, index, term) {
  if (isInsideDelimitedSyntax(value, index, "<", ">")) return true;
  if (isInsideDelimitedSyntax(value, index, "[", "]")) return true;

  const previous = value.slice(Math.max(0, index - 2), index);
  if (previous === ":") return true;

  for (const phrase of IGNORED_PHRASES_BY_TERM.get(term) ?? []) {
    const start = Math.max(0, index - phrase.length);
    const end = Math.min(value.length, index + term.length + phrase.length);
    if (value.slice(start, end).includes(phrase)) return true;
  }

  return false;
}

function loadApprovedTerms() {
  const glossary = JSON.parse(fs.readFileSync(GLOSSARY_PATH, "utf8"));
  return glossary.terms
    .filter((term) => term.status === "approved")
    .filter((term) => term.term.length > 2)
    .sort((a, b) => b.term.length - a.term.length || a.term.localeCompare(b.term))
    .map((term) => ({
      term: term.term,
      translation: term.translation,
      pattern: termPattern(term.term),
    }));
}

function expandTarget(target) {
  const absolutePath = path.join(ROOT, target);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const files = [];
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...expandTarget(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

function replaceInString(value, terms, stats) {
  let result = value;

  for (const term of terms) {
    term.pattern.lastIndex = 0;
    result = result.replace(term.pattern, (match, offset) => {
      if (shouldIgnoreMatch(result, offset, term.term)) return match;
      stats.byTerm.set(term.term, (stats.byTerm.get(term.term) ?? 0) + 1);
      stats.total += 1;
      return term.translation;
    });
  }

  return result;
}

function walkAndReplace(value, terms, stats) {
  if (typeof value === "string") return replaceInString(value, terms, stats);

  if (Array.isArray(value)) {
    return value.map((item) => walkAndReplace(item, terms, stats));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walkAndReplace(item, terms, stats)]),
    );
  }

  return value;
}

function processFile(filePath, terms, write) {
  const absolutePath = path.join(ROOT, filePath);
  const original = fs.readFileSync(absolutePath, "utf8");
  const data = JSON.parse(original);
  const stats = { total: 0, byTerm: new Map() };
  const updated = walkAndReplace(data, terms, stats);

  if (stats.total && write) {
    fs.writeFileSync(absolutePath, `${JSON.stringify(updated, null, 2)}\n`);
  }

  return {
    file: filePath,
    replacements: stats.total,
    byTerm: Object.fromEntries([...stats.byTerm.entries()].sort((a, b) => b[1] - a[1])),
  };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  if (write) {
    console.error(
      "Refusing to apply glossary replacements automatically. The glossary is a terminology guide, not a replacement table. Use glossary:audit and translate phrases in context.",
    );
    process.exitCode = 1;
    return;
  }
  const targets = args.filter((arg) => arg !== "--write");
  const files = (targets.length ? targets : DEFAULT_TARGETS)
    .flatMap((target) => expandTarget(target))
    .sort((a, b) => a.localeCompare(b));
  const terms = loadApprovedTerms();
  const results = files.map((file) => processFile(file, terms, write));
  const changed = results.filter((result) => result.replacements);
  const total = changed.reduce((sum, result) => sum + result.replacements, 0);

  console.log(`Mode: ${write ? "write" : "dry-run"}`);
  console.log(`Files checked: ${files.length}`);
  console.log(`Files with replacements: ${changed.length}`);
  console.log(`Replacements: ${total}`);

  for (const result of changed.sort((a, b) => b.replacements - a.replacements).slice(0, 20)) {
    console.log(`- ${result.replacements}: ${result.file}`);
  }
}

main();
