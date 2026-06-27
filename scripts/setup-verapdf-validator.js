const { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } = require("fs");
const { writeFile } = require("fs/promises");
const { join, resolve } = require("path");
const { pipeline } = require("stream/promises");
const { spawnSync } = require("child_process");

const root = process.cwd();
const targetRoot = resolve(root, ".codex-tools", "verapdf");
const downloadsDir = join(targetRoot, "downloads");
const installerDir = join(targetRoot, "installer");
const installDir = join(targetRoot, "app");
const installerZipUrl = "https://software.verapdf.org/rel/verapdf-installer.zip";

async function downloadFile(url, outPath) {
  const response = await fetch(url, {
    headers: { "User-Agent": "WorkPilot360-veraPDF-Setup" },
  });
  if (!response.ok || !response.body) throw new Error(`Download fehlgeschlagen: ${url}`);
  await pipeline(response.body, createWriteStream(outPath));
}

function extractZip(zipPath, targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit", windowsHide: true }
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

function writeAutoInstallFile(autoInstallPath) {
  const xml = [
    '<AutomatedInstallation langpack="eng">',
    '  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>',
    '  <com.izforge.izpack.panels.target.TargetPanel id="install_dir">',
    `    <installpath>${installDir}</installpath>`,
    "  </com.izforge.izpack.panels.target.TargetPanel>",
    '  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">',
    '    <pack index="0" name="veraPDF GUI" selected="true"/>',
    '    <pack index="1" name="veraPDF CLI" selected="true"/>',
    "  </com.izforge.izpack.panels.packs.PacksPanel>",
    '  <com.izforge.izpack.panels.install.InstallPanel id="install"/>',
    '  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>',
    "</AutomatedInstallation>",
    "",
  ].join("\n");
  writeFileSync(autoInstallPath, xml, "utf8");
}

async function main() {
  mkdirSync(downloadsDir, { recursive: true });
  const zipPath = join(downloadsDir, "verapdf-installer.zip");
  console.log("Download veraPDF Installer");
  await downloadFile(installerZipUrl, zipPath);
  extractZip(zipPath, installerDir);

  const installerScript =
    process.platform === "win32"
      ? findFile(installerDir, (_fullPath, name) => name.toLowerCase() === "verapdf-install.bat")
      : findFile(installerDir, (_fullPath, name) => name === "verapdf-install");
  if (!installerScript) throw new Error("veraPDF Installationsscript wurde nicht gefunden.");

  const autoInstallPath = join(targetRoot, "auto-install.xml");
  writeAutoInstallFile(autoInstallPath);

  console.log("Installiere veraPDF lokal im Projekt");
  const installResult = spawnSync(installerScript, [autoInstallPath], {
    cwd: installerDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (installResult.status !== 0) throw new Error("veraPDF Installation fehlgeschlagen.");

  const executable =
    process.platform === "win32"
      ? findFile(installDir, (_fullPath, name) => name.toLowerCase() === "verapdf.bat")
      : findFile(installDir, (_fullPath, name) => name === "verapdf");
  if (!executable || !existsSync(executable)) throw new Error("veraPDF CLI wurde nach der Installation nicht gefunden.");

  const envText = [`VERAPDF_PATH="${executable}"`, ""].join("\n");
  await writeFile(join(targetRoot, ".env.verapdf.local.example"), envText, "utf8");

  console.log("");
  console.log("veraPDF wurde vorbereitet.");
  console.log(`CLI: ${executable}`);
  console.log(`Env-Beispiel: ${join(targetRoot, ".env.verapdf.local.example")}`);
  console.log("");
  console.log("Hinweis: VERAPDF_PATH muss in der Server-Umgebung gesetzt sein und der Server danach neu gestartet werden.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
