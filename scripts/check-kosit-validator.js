const { existsSync, mkdirSync, readFileSync } = require("fs");
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

const generatedEnv = readEnvFile(join(process.cwd(), ".codex-tools", "kosit", ".env.kosit.local.example"));
const localEnv = readEnvFile(join(process.cwd(), ".env"));
const settings = {
  java: process.env.KOSIT_JAVA_PATH || localEnv.KOSIT_JAVA_PATH || generatedEnv.KOSIT_JAVA_PATH || "java",
  jar: process.env.KOSIT_VALIDATOR_JAR || localEnv.KOSIT_VALIDATOR_JAR || generatedEnv.KOSIT_VALIDATOR_JAR || "",
  repository:
    process.env.KOSIT_VALIDATOR_REPOSITORY ||
    localEnv.KOSIT_VALIDATOR_REPOSITORY ||
    generatedEnv.KOSIT_VALIDATOR_REPOSITORY ||
    "",
  scenarios:
    process.env.KOSIT_VALIDATOR_SCENARIOS ||
    localEnv.KOSIT_VALIDATOR_SCENARIOS ||
    generatedEnv.KOSIT_VALIDATOR_SCENARIOS ||
    "scenarios.xml",
};

const missing = [];
if (!settings.jar || !existsSync(settings.jar)) missing.push("Validator-JAR fehlt.");
if (!settings.repository || !existsSync(settings.repository)) missing.push("XRechnung-Konfiguration fehlt.");
if (missing.length > 0) {
  console.error(missing.join("\n"));
  process.exit(1);
}

const javaResult = spawnSync(settings.java, ["-version"], { encoding: "utf8" });
if (javaResult.status !== 0) {
  console.error("Java ist nicht ausführbar. Bitte Java installieren oder KOSIT_JAVA_PATH setzen.");
  process.exit(1);
}

const validatorDir = join(process.cwd(), ".codex-tools", "kosit", "validator");
const validatorClasspath = `${settings.jar}${require("path").delimiter}${join(validatorDir, "libs", "*")}`;
const testDocument = join(process.cwd(), ".codex-tools", "kosit", "test", "ubl.xml");
const outputDir = join(process.cwd(), ".codex-tools", "kosit", "test", "check-output");
if (!existsSync(testDocument)) {
  console.error("KoSIT-Testdokument fehlt. Bitte zuerst npm run setup:kosit ausführen.");
  process.exit(1);
}
mkdirSync(outputDir, { recursive: true });

const validationResult = spawnSync(
  settings.java,
  [
    "-cp",
    validatorClasspath,
    "de.kosit.validationtool.cmd.CommandLineApplication",
    "-s",
    settings.scenarios,
    "-r",
    settings.repository,
    "-h",
    "-o",
    outputDir,
    testDocument,
  ],
  {
    cwd: settings.repository,
    encoding: "utf8",
    windowsHide: true,
  }
);
const validationOutput = `${validationResult.stdout || ""}\n${validationResult.stderr || ""}`;
if (validationResult.status !== 0 || !/Validation successful|Acceptable:\s+1\s+Rejected:\s+0/i.test(validationOutput)) {
  console.error("KoSIT-Smoke-Test fehlgeschlagen.");
  console.error(validationOutput);
  process.exit(1);
}

console.log("KoSIT-Dateien gefunden.");
console.log(`Java: ${settings.java}`);
console.log(`Validator-JAR: ${settings.jar}`);
console.log(`Repository: ${settings.repository}`);
console.log(`Szenario-Datei: ${settings.scenarios}`);
console.log("KoSIT-Smoke-Test bestanden.");
