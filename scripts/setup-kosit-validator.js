const { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } = require("fs");
const { writeFile } = require("fs/promises");
const { basename, join, resolve } = require("path");
const { pipeline } = require("stream/promises");
const { spawnSync } = require("child_process");

const root = process.cwd();
const targetRoot = resolve(root, ".codex-tools", "kosit");
const downloadsDir = join(targetRoot, "downloads");
const validatorDir = join(targetRoot, "validator");
const repositoryDir = join(targetRoot, "validator-configuration-xrechnung");
const testDir = join(targetRoot, "test");
const testDocumentUrl =
  "https://projekte.kosit.org/xrechnung/xrechnung-testsuite/-/raw/master/src/test/business-cases/standard/01.01a-INVOICE_ubl.xml";

const releases = [
  {
    key: "validator",
    repo: "itplr-kosit/validator",
    targetDir: validatorDir,
    assetPattern: /\.zip$/i,
  },
  {
    key: "configuration",
    repo: "itplr-kosit/validator-configuration-xrechnung",
    targetDir: repositoryDir,
    assetPattern: /\.zip$/i,
  },
];

async function getLatestRelease(repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "WorkPilot360-KoSIT-Setup" },
  });
  if (!response.ok) throw new Error(`GitHub Release konnte nicht gelesen werden: ${repo}`);
  return response.json();
}

function selectAsset(release, pattern) {
  const asset = release.assets.find((item) => pattern.test(item.name));
  if (!asset) throw new Error(`Kein passendes ZIP-Asset in Release ${release.tag_name} gefunden.`);
  return asset;
}

async function downloadAsset(asset, outPath) {
  const response = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": "WorkPilot360-KoSIT-Setup" },
  });
  if (!response.ok || !response.body) throw new Error(`Download fehlgeschlagen: ${asset.name}`);
  await pipeline(response.body, createWriteStream(outPath));
}

function extractZip(zipPath, targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`],
      { stdio: "inherit" }
    );
    if (result.status !== 0) throw new Error(`ZIP konnte nicht entpackt werden: ${zipPath}`);
    return;
  }

  const result = spawnSync("unzip", ["-q", zipPath, "-d", targetDir], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ZIP konnte nicht entpackt werden: ${zipPath}`);
}

function findFile(startDir, predicate) {
  const entries = readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(startDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(fullPath, predicate);
      if (nested) return nested;
    } else if (predicate(fullPath, entry.name)) {
      return fullPath;
    }
  }
  return "";
}

async function main() {
  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });

  for (const item of releases) {
    const release = await getLatestRelease(item.repo);
    const asset = selectAsset(release, item.assetPattern);
    const zipPath = join(downloadsDir, asset.name);
    console.log(`Download ${item.repo} ${release.tag_name}: ${asset.name}`);
    await downloadAsset(asset, zipPath);
    extractZip(zipPath, item.targetDir);
  }

  const validatorJar = findFile(validatorDir, (_fullPath, name) => /^validator-.*\.jar$/i.test(name));
  const scenariosFile = findFile(repositoryDir, (_fullPath, name) => name === "scenarios.xml");
  if (!validatorJar) throw new Error("Standalone-JAR wurde nach dem Entpacken nicht gefunden.");
  if (!scenariosFile) throw new Error("scenarios.xml wurde nach dem Entpacken nicht gefunden.");

  const testDocumentPath = join(testDir, "ubl.xml");
  console.log("Download offizielles XRechnung-Testdokument");
  await downloadAsset({ name: "ubl.xml", browser_download_url: testDocumentUrl }, testDocumentPath);

  const envText = [
    `KOSIT_VALIDATOR_JAR="${validatorJar}"`,
    `KOSIT_VALIDATOR_REPOSITORY="${repositoryDir}"`,
    'KOSIT_VALIDATOR_SCENARIOS="scenarios.xml"',
    'KOSIT_JAVA_PATH="java"',
    "",
  ].join("\n");
  await writeFile(join(targetRoot, ".env.kosit.local.example"), envText, "utf8");

  console.log("");
  console.log("KoSIT-Artefakte wurden vorbereitet.");
  console.log(`Validator-JAR: ${validatorJar}`);
  console.log(`Repository: ${repositoryDir}`);
  console.log(`Testdokument: ${testDocumentPath}`);
  console.log(`Env-Beispiel: ${join(targetRoot, ".env.kosit.local.example")}`);
  console.log("");
  console.log("Hinweis: Java muss separat vorhanden sein. Der globale Rechnerzustand wurde nicht verändert.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
