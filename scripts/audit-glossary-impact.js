import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["translation/es/compendium/pf2e.actionspf2e.json"];
const REPORT_PATH = path.join(ROOT, "sources", "reports", "glossary-impact.json");
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

function compactSnippet(value, index, length) {
  const start = Math.max(0, index - 80);
  const end = Math.min(value.length, index + length + 80);
  return value
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
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
    .map((term) => ({
      term: term.term,
      translation: term.translation,
      pattern: termPattern(term.term),
    }));
}

function walkStrings(value, visitor, currentPath = []) {
  if (typeof value === "string") {
    visitor(value, currentPath);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visitor, currentPath.concat(index)));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walkStrings(item, visitor, currentPath.concat(key));
    }
  }
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

function auditFile(filePath, terms) {
  const absolutePath = path.join(ROOT, filePath);
  const data = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const findings = [];

  walkStrings(data, (value, jsonPath) => {
    for (const term of terms) {
      term.pattern.lastIndex = 0;
      const matches = [...value.matchAll(term.pattern)];
      for (const match of matches) {
        if (shouldIgnoreMatch(value, match.index ?? 0, term.term)) continue;
        findings.push({
          file: filePath,
          path: pathToString(jsonPath),
          term: term.term,
          suggested: term.translation,
          matched: match[0],
          snippet: compactSnippet(value, match.index ?? 0, match[0].length),
        });
      }
    }
  });

  return findings;
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

function summarize(findings) {
  const byTerm = new Map();
  const byFile = new Map();

  for (const finding of findings) {
    byTerm.set(finding.term, (byTerm.get(finding.term) ?? 0) + 1);
    byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
  }

  return {
    totalFindings: findings.length,
    byFile: Object.fromEntries([...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byTerm: Object.fromEntries([...byTerm.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  };
}

function main() {
  const targets = process.argv.slice(2);
  const files = (targets.length ? targets : DEFAULT_TARGETS)
    .flatMap((target) => expandTarget(target))
    .sort((a, b) => a.localeCompare(b));
  const terms = loadApprovedTerms();
  const findings = files.flatMap((file) => auditFile(file, terms));
  const report = {
    generatedAt: new Date().toISOString(),
    glossary: path.relative(ROOT, GLOSSARY_PATH),
    termsChecked: terms.length,
    files,
    summary: summarize(findings),
    findings,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Terms checked: ${terms.length}`);
  console.log(`Files checked: ${files.length}`);
  console.log(`Findings: ${findings.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  const topTerms = Object.entries(report.summary.byTerm).slice(0, 10);
  if (topTerms.length) {
    console.log("Top terms:");
    for (const [term, count] of topTerms) console.log(`- ${term}: ${count}`);
  }
}

main();
