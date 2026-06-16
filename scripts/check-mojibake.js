const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const baselinePath = path.join(root, "scripts", "mojibake-baseline.json");
const includeExtensions = new Set([".ts", ".tsx", ".css", ".prisma"]);
const skipDirectories = new Set([".git", ".next", ".codex-safety", "node_modules"]);
const badCharacterCodes = new Set([0x00c3, 0x00c2, 0x00e2, 0xfffd]);
const scanRoots = ["src", "prisma"].map((entry) => path.join(root, entry));
const updateBaseline = process.argv.includes("--update-baseline");

function hasMojibakeMarker(value) {
  return Array.from(value).some((character) => badCharacterCodes.has(character.charCodeAt(0)));
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      continue;
    }

    if (includeExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

function createFinding(type, file, line, text) {
  const normalizedText = normalizeText(text);

  return {
    type,
    file,
    line,
    text: normalizedText.slice(0, 160),
    key: `${type}:${file}:${hashValue(normalizedText)}`,
  };
}

function scan() {
  const findings = [];

  for (const scanRoot of scanRoots) {
    if (!fs.existsSync(scanRoot)) continue;

    for (const file of walk(scanRoot)) {
      const content = fs.readFileSync(file, "utf8");
      const relativeFile = path.relative(root, file);
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (hasMojibakeMarker(line)) {
          findings.push(createFinding("mojibake", relativeFile, index + 1, line));
        }
      });

      const iconButtonQuestionPattern =
        /<button\b[\s\S]{0,600}?className=\{styles\.iconButton\}[\s\S]{0,600}?>\s*\?\s*<\/button>/g;
      for (const match of content.matchAll(iconButtonQuestionPattern)) {
        const line = content.slice(0, match.index).split(/\r?\n/).length;
        findings.push(
          createFinding(
            "icon-question",
            relativeFile,
            line,
            "Icon-Button rendert nur ein Fragezeichen. Vermutlich fehlt ein echtes Icon oder Schließen-Zeichen."
          )
        );
      }
    }
  }

  return findings;
}

function summarize(findings) {
  const entries = {};

  for (const finding of findings) {
    if (!entries[finding.key]) {
      entries[finding.key] = {
        type: finding.type,
        file: finding.file,
        text: finding.text,
        count: 0,
      };
    }
    entries[finding.key].count += 1;
  }

  return entries;
}

function countEntries(entries) {
  return Object.values(entries).reduce((sum, entry) => sum + entry.count, 0);
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

function writeBaseline(findings) {
  const entries = summarize(findings);
  const sortedEntries = Object.fromEntries(Object.entries(entries).sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey)));
  const baseline = {
    version: 1,
    updatedAt: new Date().toISOString(),
    description:
      "Known Mojibake/icon-placeholder baseline. The check fails only when new occurrences appear above this baseline.",
    totalFindings: countEntries(sortedEntries),
    entries: sortedEntries,
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return baseline;
}

function diffAgainstBaseline(currentEntries, baselineEntries) {
  const newFindings = [];
  const resolvedCount = Object.entries(baselineEntries).reduce((sum, [key, baselineEntry]) => {
    const currentCount = currentEntries[key]?.count ?? 0;
    return sum + Math.max(0, baselineEntry.count - currentCount);
  }, 0);

  for (const [key, currentEntry] of Object.entries(currentEntries)) {
    const baselineCount = baselineEntries[key]?.count ?? 0;
    const additionalCount = currentEntry.count - baselineCount;
    if (additionalCount > 0) {
      newFindings.push({
        key,
        ...currentEntry,
        count: additionalCount,
      });
    }
  }

  return { newFindings, resolvedCount };
}

const findings = scan();
const currentEntries = summarize(findings);

if (updateBaseline) {
  const baseline = writeBaseline(findings);
  console.log(`Mojibake-Baseline aktualisiert: ${baseline.totalFindings} bekannte Treffer.`);
  process.exit(0);
}

const baseline = loadBaseline();

if (!baseline) {
  console.error("Keine Mojibake-Baseline gefunden.");
  console.error("Wenn der aktuelle Stand bewusst als Ausgangslage gelten soll: npm.cmd run check:mojibake -- --update-baseline");
  console.error(`Aktuelle Treffer: ${countEntries(currentEntries)}.`);
  process.exit(findings.length === 0 ? 0 : 1);
}

const { newFindings, resolvedCount } = diffAgainstBaseline(currentEntries, baseline.entries || {});
const currentTotal = countEntries(currentEntries);
const baselineTotal = countEntries(baseline.entries || {});

if (newFindings.length === 0) {
  console.log(
    `Mojibake-Check bestanden: keine neuen Treffer. Bekannte Altlasten: ${currentTotal} von ${baselineTotal}.`
  );
  if (resolvedCount > 0) {
    console.log(`${resolvedCount} Baseline-Treffer wurden inzwischen bereinigt. Baseline bei Gelegenheit aktualisieren.`);
  }
  process.exit(0);
}

console.error(`Mojibake-Check fehlgeschlagen: ${newFindings.length} neue Treffergruppen gefunden.`);
for (const finding of newFindings.slice(0, 80)) {
  console.error(`${finding.file} ${finding.type} +${finding.count}: ${finding.text}`);
}

if (newFindings.length > 80) {
  console.error(`... ${newFindings.length - 80} weitere neue Treffergruppen.`);
}

console.error(`Aktuelle Treffer gesamt: ${currentTotal}. Baseline: ${baselineTotal}.`);
process.exit(1);
