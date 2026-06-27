const { existsSync, readdirSync } = require("fs");
const { spawnSync } = require("child_process");
const { join } = require("path");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const content = require("fs").readFileSync(path, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      })
  );
}

function getConfiguredPath() {
  const envFile = readEnvFile(join(process.cwd(), ".env"));
  return (
    process.env.PDFA3_CONVERTER_PATH ||
    process.env.ZUGFERD_PDFA3_CONVERTER_PATH ||
    process.env.GHOSTSCRIPT_PATH ||
    process.env.GS_PATH ||
    envFile.PDFA3_CONVERTER_PATH ||
    envFile.ZUGFERD_PDFA3_CONVERTER_PATH ||
    envFile.GHOSTSCRIPT_PATH ||
    envFile.GS_PATH ||
    ""
  ).trim();
}

function getConfiguredIccProfile() {
  const envFile = readEnvFile(join(process.cwd(), ".env"));
  const configured = (
    process.env.PDFA3_ICC_PROFILE_PATH ||
    process.env.ZUGFERD_ICC_PROFILE_PATH ||
    envFile.PDFA3_ICC_PROFILE_PATH ||
    envFile.ZUGFERD_ICC_PROFILE_PATH ||
    ""
  ).trim();
  if (configured) return configured;

  const directCandidates = [
    "/usr/share/color/icc/ghostscript/srgb.icc",
    "/usr/share/color/icc/sRGB.icc",
    "/usr/share/color/icc/srgb.icc",
    "/usr/share/ghostscript/iccprofiles/srgb.icc",
  ];
  const directMatch = directCandidates.find((candidate) => existsSync(candidate));
  if (directMatch) return directMatch;

  const ghostscriptRoot = "/usr/share/ghostscript";
  if (existsSync(ghostscriptRoot)) {
    for (const entry of readdirSync(ghostscriptRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(ghostscriptRoot, entry.name, "iccprofiles", "srgb.icc");
      if (existsSync(candidate)) return candidate;
    }
  }

  return "";
}

function run(command, args) {
  if (process.platform === "win32" && /\.bat$/i.test(command)) {
    return spawnSync("cmd.exe", ["/c", command, ...args], { encoding: "utf8", windowsHide: true });
  }
  return spawnSync(command, args, { encoding: "utf8", windowsHide: true });
}

const executable = getConfiguredPath();
if (!executable) {
  console.error("PDF/A-3-Konverter fehlt. Bitte PDFA3_CONVERTER_PATH oder GHOSTSCRIPT_PATH setzen.");
  process.exit(1);
}

if (!existsSync(executable)) {
  console.error(`PDF/A-3-Konverter wurde nicht gefunden: ${executable}`);
  process.exit(1);
}

const result = run(executable, ["--version"]);
if (result.error || result.status !== 0) {
  console.error("PDF/A-3-Konverter konnte nicht gestartet werden.");
  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(1);
}

console.log(`PDF/A-3-Konverter ist verfuegbar: ${executable}`);
const iccProfile = getConfiguredIccProfile();
if (iccProfile) {
  console.log(`sRGB-ICC-Profil ist verfuegbar: ${iccProfile}`);
} else {
  console.warn("Hinweis: Kein sRGB-ICC-Profil gefunden. ZUGFeRD/PDF-A-3 kann an OutputIntent scheitern.");
}
