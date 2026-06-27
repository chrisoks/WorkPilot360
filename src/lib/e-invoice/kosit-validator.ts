import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type KositValidationIssue = {
  severity: "error" | "warning" | "info";
  message: string;
};

export type KositValidationResult = {
  available: boolean;
  valid: boolean;
  status: "not-configured" | "accepted" | "rejected" | "failed";
  message: string;
  issues: KositValidationIssue[];
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}
function getKositSettings() {
  const validatorJar = cleanText(process.env.KOSIT_VALIDATOR_JAR);
  return {
    javaExecutable: cleanText(process.env.KOSIT_JAVA_PATH) || "java",
    validatorJar,
    validatorClasspath: validatorJar
      ? `${validatorJar}${path.delimiter}${path.join(path.dirname(validatorJar), "libs", "*")}`
      : "",
    repository: cleanText(process.env.KOSIT_VALIDATOR_REPOSITORY),
    scenariosFile: cleanText(process.env.KOSIT_VALIDATOR_SCENARIOS) || "scenarios.xml",
  };
}

function stripXmlTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReportIssues(reportXml: string): KositValidationIssue[] {
  const failedAssertions = [...reportXml.matchAll(/<[^>]*(?:failed-assert|error)[^>]*>([\s\S]*?)<\/[^>]+>/gi)];
  return failedAssertions
    .map((match) => stripXmlTags(match[1] || ""))
    .filter(Boolean)
    .slice(0, 30)
    .map((message) => ({ severity: "error", message }));
}

async function readReportXml(outputDirectory: string, inputBaseName: string) {
  const reportPath = path.join(outputDirectory, `${inputBaseName}-report.xml`);
  try {
    return await readFile(reportPath, "utf8");
  } catch {
    return "";
  }
}

function getReadableKositFailureMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  if (/timed out|timeout/i.test(rawMessage)) {
    return "KoSIT-Validierung hat zu lange gedauert.";
  }
  if (/ENOENT|not found|cannot find/i.test(rawMessage)) {
    return "KoSIT-Validierung konnte nicht gestartet werden. Bitte Java- und KoSIT-Pfade pruefen.";
  }
  return "KoSIT-Validierung konnte nicht erfolgreich abgeschlossen werden.";
}

export async function validateXRechnungWithKosit(xml: string): Promise<KositValidationResult> {
  const settings = getKositSettings();
  if (!settings.validatorJar || !settings.repository) {
    return {
      available: false,
      valid: false,
      status: "not-configured",
      message: "KoSIT Validator ist noch nicht konfiguriert.",
      issues: [],
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "workpilot-xrechnung-"));
  const inputBaseName = "xrechnung";
  const inputPath = path.join(tempDir, `${inputBaseName}.xml`);
  const outputDir = path.join(tempDir, "out");

  try {
    await writeFile(inputPath, xml, "utf8");
    const args = [
      "-cp",
      settings.validatorClasspath,
      "de.kosit.validationtool.cmd.CommandLineApplication",
      "-s",
      settings.scenariosFile,
      "-r",
      path.resolve(settings.repository),
      "-h",
      inputPath,
      "-o",
      outputDir,
    ];

    const result = await execFileAsync(settings.javaExecutable, args, {
      cwd: path.resolve(settings.repository),
      timeout: 60000,
      windowsHide: true,
    });
    const reportXml = await readReportXml(outputDir, inputBaseName);
    const issues = reportXml ? extractReportIssues(reportXml) : [];
    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}\n${reportXml}`;
    const accepted = /ACCEPTABLE|Validation successful|<[^>]*accept[^>]*>\s*true\s*<\/[^>]+>/i.test(combinedOutput);

    return {
      available: true,
      valid: accepted,
      status: accepted ? "accepted" : "rejected",
      message: accepted ? "KoSIT-Validierung bestanden." : "KoSIT-Validierung hat die XRechnung abgelehnt.",
      issues: accepted ? [] : issues,
    };
  } catch (error) {
    const reportXml = await readReportXml(outputDir, inputBaseName);
    const issues = reportXml ? extractReportIssues(reportXml) : [];
    if (issues.length > 0) {
      return {
        available: true,
        valid: false,
        status: "rejected",
        message: "KoSIT-Validierung hat die XRechnung abgelehnt.",
        issues,
      };
    }
    const message = getReadableKositFailureMessage(error);
    return {
      available: true,
      valid: false,
      status: "failed",
      message,
      issues: [{ severity: "error", message }],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
