const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
        return [key, value];
      })
  );
}

const generatedEnv = readEnvFile(join(process.cwd(), ".codex-tools", "verapdf", ".env.verapdf.local.example"));
const localEnv = readEnvFile(join(process.cwd(), ".env"));
const executable =
  process.env.VERAPDF_PATH ||
  process.env.ZUGFERD_PDF_VALIDATOR_PATH ||
  localEnv.VERAPDF_PATH ||
  localEnv.ZUGFERD_PDF_VALIDATOR_PATH ||
  generatedEnv.VERAPDF_PATH ||
  "";

function runVeraPdf(args) {
  if (process.platform === "win32" && /\.bat$/i.test(executable)) {
    return spawnSync("cmd.exe", ["/c", executable, ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  return spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
  });
}

if (!executable || !existsSync(executable)) {
  console.error("veraPDF CLI fehlt. Bitte VERAPDF_PATH setzen oder npm run setup:verapdf ausfuehren.");
  process.exit(1);
}

const versionResult = runVeraPdf(["--version"]);
if (versionResult.status !== 0) {
  console.error("veraPDF CLI ist nicht ausfuehrbar.");
  console.error(versionResult.stderr || versionResult.stdout || "");
  process.exit(1);
}

const helpResult = runVeraPdf(["--help"]);
const helpOutput = `${helpResult.stdout || ""}\n${helpResult.stderr || ""}`;
if (helpResult.status !== 0 || !/Possible Values:.*3b/is.test(helpOutput)) {
  console.error("veraPDF CLI unterstuetzt die erwartete PDF/A-3b-Pruefung nicht.");
  process.exit(1);
}

console.log("veraPDF CLI gefunden.");
console.log(`Pfad: ${executable}`);
console.log((versionResult.stdout || "").split(/\r?\n/)[0] || "Version unbekannt");
console.log("PDF/A-3b-Pruefung ist verfuegbar.");
