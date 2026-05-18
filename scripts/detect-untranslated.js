import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["translation/es/compendium/pf2e.feats-srd.json"];

const ENGLISH_PATTERNS = [
  /\bYou\b/u,
  /\bYour\b/u,
  /\bYou're\b/u,
  /\bChoose\b/u,
  /\bYou gain\b/u,
  /\bYou can\b/u,
  /\btrained\b/u,
  /\bSpeed\b/u,
  /\bdamage\b/u,
  /\bsaving throw\b/u,
  /\bHit Points\b/u,
  /\bWhenever\b/u,
  /\bAccess\b/u,
  /\bPrerequisites\b/u,
  /\bFrequency\b/u,
  /\bTrigger\b/u,
  /\bRequirements\b/u,
  /\bEffect\b/u,
  /\bCritical Success\b/u,
  /\bSuccess\b/u,
  /\bFailure\b/u,
  /\bSaving Throw\b/u,
];

const TECHNICAL_PATH_PARTS = new Set([
  "_id",
  "flags",
  "img",
  "rules",
  "sort",
  "source",
  "system",
  "type",
  "uuid",
]);

function parseBalanced(value, start, open, close) {
  if (value[start] !== open) return null;

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(start + 1, index),
          end: index + 1,
        };
      }
    }
  }

  return null;
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function visibleText(value) {
  let output = "";
  let index = 0;

  while (index < value.length) {
    if (value.startsWith("[[", index)) {
      const close = value.indexOf("]]", index + 2);
      if (close === -1) {
        output += value[index];
        index += 1;
        continue;
      }

      index = close + 2;
      if (value[index] === "{") {
        const label = parseBalanced(value, index, "{", "}");
        if (label) {
          output += ` ${visibleText(label.content)} `;
          index = label.end;
        }
      } else {
        output += " ";
      }
      continue;
    }

    if (value[index] === "@") {
      const macro = /^@([A-Za-z]+)\[/u.exec(value.slice(index));
      if (!macro) {
        output += value[index];
        index += 1;
        continue;
      }

      const bracketStart = index + macro[0].length - 1;
      const args = parseBalanced(value, bracketStart, "[", "]");
      if (!args) {
        output += value[index];
        index += 1;
        continue;
      }

      index = args.end;
      if (value[index] === "{") {
        const label = parseBalanced(value, index, "{", "}");
        if (label) {
          output += ` ${visibleText(label.content)} `;
          index = label.end;
        }
      } else {
        output += " ";
      }
      continue;
    }

    output += value[index];
    index += 1;
  }

  return stripHtml(output).replace(/\s+/gu, " ").trim();
}

function compactSnippet(value, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(value.length, matchIndex + matchLength + 80);
  return value.slice(start, end).replace(/\s+/gu, " ").trim();
}

function pathToString(parts) {
  return parts
    .map((part) => {
      if (typeof part === "number") return `[${part}]`;
      if (/^[A-Za-z_$][\w$-]*$/u.test(part)) return `.${part}`;
      return `[${JSON.stringify(part)}]`;
    })
    .join("")
    .replace(/^\./u, "");
}

function shouldSkipPath(parts) {
  return parts.some((part) => typeof part === "string" && TECHNICAL_PATH_PARTS.has(part));
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

function expandTarget(target) {
  const absolutePath = path.join(ROOT, target);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...expandTarget(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

function detectFile(filePath) {
  const absolutePath = path.join(ROOT, filePath);
  const data = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const findings = [];

  walkStrings(data, (rawValue, jsonPath) => {
    if (shouldSkipPath(jsonPath)) return;

    const text = visibleText(rawValue);
    if (!text) return;

    for (const pattern of ENGLISH_PATTERNS) {
      const match = pattern.exec(text);
      if (!match) continue;

      findings.push({
        file: filePath,
        path: pathToString(jsonPath),
        matched: match[0],
        snippet: compactSnippet(text, match.index, match[0].length),
      });
      break;
    }
  });

  return findings;
}

function entryName(finding) {
  const dotted = /^entries\.([^.[\]]+)/u.exec(finding.path);
  if (dotted) return dotted[1];

  const bracketed = /^entries\[(.+?)\]/u.exec(finding.path);
  if (!bracketed) return finding.path;

  try {
    return JSON.parse(bracketed[1]);
  } catch {
    return bracketed[1];
  }
}

function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes("--all");
  const targets = args.filter((arg) => arg !== "--all");
  const files = (targets.length ? targets : DEFAULT_TARGETS)
    .flatMap((target) => expandTarget(target))
    .sort((a, b) => a.localeCompare(b));
  const findings = files.flatMap((file) => detectFile(file));
  const entries = new Set(findings.map(entryName));

  console.log(`Files checked: ${files.length}`);
  console.log(`Findings: ${findings.length}`);
  console.log(`Entries with findings: ${entries.size}`);

  const listedFindings = showAll ? findings : findings.slice(0, 120);
  for (const finding of listedFindings) {
    console.log(`- ${entryName(finding)} :: ${finding.path} :: ${finding.matched} :: ${finding.snippet}`);
  }

  if (!showAll && findings.length > listedFindings.length) {
    console.log(`... ${findings.length - listedFindings.length} more findings. Use --all to list everything.`);
  }
}

main();
