const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = process.cwd();
const manifestPath = path.join(root, "docs", "JARVIS_KNOWLEDGE_COVERAGE.json");
const resolverPath = path.join(root, "src", "lib", "jarvis", "current-product-guidance.ts");

function fail(messages) {
  console.error("JARVIS-Wissensabdeckung fehlgeschlagen:");
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const failures = [];
if (!fs.existsSync(manifestPath)) fail(["Coverage-Manifest fehlt."]);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const resolver = fs.existsSync(resolverPath) ? fs.readFileSync(resolverPath, "utf8") : "";

if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.reviewedAt || "")) {
  failures.push("reviewedAt muss ein ISO-Datum enthalten.");
}
if (!/^[0-9a-f]{40}$/.test(manifest.reviewedProductCommit || "")) {
  failures.push("reviewedProductCommit muss ein vollständiger Git-SHA sein.");
}

const ids = new Set();
const topics = new Set();
for (const capability of manifest.capabilities || []) {
  if (!capability.id || ids.has(capability.id)) failures.push(`Ungültige oder doppelte Capability-ID: ${capability.id || "<leer>"}.`);
  ids.add(capability.id);
  if (capability.status !== "covered") failures.push(`${capability.id}: Status muss covered sein.`);
  if (!Array.isArray(capability.topicIds) || capability.topicIds.length === 0) failures.push(`${capability.id}: topicIds fehlen.`);
  for (const topicId of capability.topicIds || []) {
    if (topics.has(topicId)) failures.push(`Topic-ID doppelt im Manifest: ${topicId}.`);
    topics.add(topicId);
    if (!resolver.includes(`topicId: "${topicId}"`)) failures.push(`${capability.id}: Topic ${topicId} fehlt im produktiven Resolver.`);
  }
  for (const relativePath of [...(capability.sourceRefs || []), ...(capability.testRefs || [])]) {
    if (!fs.existsSync(path.join(root, relativePath))) failures.push(`${capability.id}: Quell- oder Testreferenz fehlt: ${relativePath}.`);
  }
  if (!capability.sourceRefs?.length || !capability.testRefs?.length) failures.push(`${capability.id}: Quellen und Tests müssen beide dokumentiert sein.`);
}

try {
  git("merge-base", "--is-ancestor", manifest.reviewedProductCommit, "HEAD");
  const laterCommits = git("rev-list", "--reverse", `${manifest.reviewedProductCommit}..HEAD`)
    .split(/\r?\n/)
    .filter(Boolean);
  const knowledgeOnly = [
    /^src\/lib\/jarvis\//,
    /^src\/app\/api\/jarvis\//,
    /^docs\/JARVIS_/,
    /^scripts\/check-jarvis-knowledge-coverage\.js$/,
    /^scripts\/check-regressions\.js$/,
    /^scripts\/qa-jarvis-live-corpus\.mjs$/,
    /^scripts\/plan-jarvis-evaluation\.mjs$/,
    /^package\.json$/,
    /^AGENTS\.md$/,
  ];
  for (const commit of laterCommits) {
    const changed = git("diff-tree", "--no-commit-id", "--name-only", "-r", commit)
      .split(/\r?\n/)
      .filter(Boolean);
    const productPaths = changed.filter((file) => !knowledgeOnly.some((pattern) => pattern.test(file)));
    if (productPaths.length > 0) {
      failures.push(
        `Produktcommit ${commit.slice(0, 12)} liegt nach dem geprüften Stand und benötigt eine JARVIS-Prüfung: ${productPaths.slice(0, 5).join(", ")}${productPaths.length > 5 ? " …" : ""}`
      );
    }
  }
} catch (error) {
  failures.push(`Git-Abdeckungsprüfung nicht möglich: ${error.message}`);
}

if (failures.length) fail(failures);
console.log(`JARVIS-Wissensabdeckung bestanden: ${ids.size} aktuelle Fachverträge auf ${manifest.reviewedProductCommit.slice(0, 12)} geprüft.`);
