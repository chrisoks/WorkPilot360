const { createWriteStream, existsSync, mkdirSync, writeFileSync } = require("fs");
const { writeFile } = require("fs/promises");
const { join, resolve } = require("path");
const { pipeline } = require("stream/promises");
const { spawnSync } = require("child_process");

const root = process.cwd();
const targetRoot = resolve(root, ".codex-tools", "ghostscript");
const downloadsDir = join(targetRoot, "downloads");
const installDir = join(targetRoot, "app");

async function downloadFile(url, outPath) {
  const response = await fetch(url, {
    headers: { "User-Agent": "WorkPilot360-Ghostscript-Setup" },
  });
  if (!response.ok || !response.body) throw new Error(`Download fehlgeschlagen: ${url}`);
  await pipeline(response.body, createWriteStream(outPath));
}

async function findWindowsInstallerUrl() {
  const response = await fetch("https://api.github.com/repos/ArtifexSoftware/ghostpdl-downloads/releases/latest", {
    headers: { "User-Agent": "WorkPilot360-Ghostscript-Setup" },
  });
  if (!response.ok) throw new Error("Ghostscript-Release konnte nicht abgefragt werden.");
  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installer = assets.find((asset) => /^gs\d+w64\.exe$/i.test(String(asset.name || "")));
  if (!installer?.browser_download_url) throw new Error("Ghostscript-Windows-Installer wurde nicht gefunden.");
  return { url: installer.browser_download_url, name: installer.name };
}

function findGhostscriptExe() {
  const candidates = [
    join(installDir, "bin", "gswin64c.exe"),
    join(installDir, "gswin64c.exe"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

async function main() {
  if (process.platform !== "win32") {
    console.log("Automatisches Setup ist aktuell nur fuer Windows vorgesehen.");
    console.log("Server/Linux: Ghostscript per Paketmanager installieren, z. B. apt-get install ghostscript.");
    console.log("Danach GHOSTSCRIPT_PATH=/usr/bin/gs oder PDFA3_CONVERTER_PATH=/usr/bin/gs setzen.");
    return;
  }

  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(installDir, { recursive: true });

  const { url, name } = await findWindowsInstallerUrl();
  const installerPath = join(downloadsDir, name);
  console.log("Download Ghostscript Installer");
  await downloadFile(url, installerPath);

  console.log("Installiere Ghostscript lokal im Projekt");
  const result = spawnSync(installerPath, ["/S", `/D=${installDir}`], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error("Ghostscript-Installation fehlgeschlagen. Bitte Installer manuell ausfuehren oder GHOSTSCRIPT_PATH setzen.");
  }

  const executable = findGhostscriptExe();
  if (!executable) throw new Error("Ghostscript CLI wurde nach der Installation nicht gefunden.");

  const envText = [`GHOSTSCRIPT_PATH="${executable}"`, ""].join("\n");
  await writeFile(join(targetRoot, ".env.ghostscript.local.example"), envText, "utf8");

  console.log("");
  console.log("Ghostscript wurde vorbereitet.");
  console.log(`CLI: ${executable}`);
  console.log(`Env-Beispiel: ${join(targetRoot, ".env.ghostscript.local.example")}`);
  console.log("");
  console.log("Hinweis: GHOSTSCRIPT_PATH muss in der Server-Umgebung gesetzt sein und der Server danach neu gestartet werden.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
