import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ZugferdPdfValidationIssue = {
  severity: "error" | "warning" | "info";
  message: string;
};

export type ZugferdPdfValidationResult = {
  available: boolean;
  valid: boolean;
  status: "not-configured" | "accepted" | "rejected" | "failed";
  message: string;
  issues: ZugferdPdfValidationIssue[];
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getVeraPdfExecutable() {
  return cleanText(process.env.VERAPDF_PATH || process.env.ZUGFERD_PDF_VALIDATOR_PATH);
}

function extractVeraPdfIssues(output: string) {
  const failedChecks = [...output.matchAll(/<rule[^>]*status="failed"[^>]*>([\s\S]*?)<\/rule>/gi)];
  const assertionChecks = [...output.matchAll(/<assertion[^>]*status="failed"[^>]*>([\s\S]*?)<\/assertion>/gi)];
  const checks = [...failedChecks, ...assertionChecks];

  return checks
    .map((match) =>
      (match[1] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 20)
    .map((message) => ({ severity: "error" as const, message }));
}

function isVeraPdfAccepted(output: string) {
  return /isCompliant="true"/i.test(output) || /<isCompliant>\s*true\s*<\/isCompliant>/i.test(output);
}

function getReadableVeraPdfFailureMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  if (/timed out|timeout/i.test(rawMessage)) {
    return "ZUGFeRD/PDF-A-3-Validierung hat zu lange gedauert.";
  }
  if (/ENOENT|not found|cannot find/i.test(rawMessage)) {
    return "ZUGFeRD/PDF-A-3-Validierung konnte nicht gestartet werden. Bitte VERAPDF_PATH setzen.";
  }
  return "ZUGFeRD/PDF-A-3-Validierung konnte nicht erfolgreich abgeschlossen werden.";
}

function getProcessOutput(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const maybeOutput = error as { stdout?: unknown; stderr?: unknown };
  return `${cleanText(maybeOutput.stdout)}\n${cleanText(maybeOutput.stderr)}`;
}

function getVeraPdfCommand(executable: string, args: string[]) {
  if (process.platform === "win32" && /\.bat$/i.test(executable)) {
    return {
      command: "cmd.exe",
      args: ["/c", executable, ...args],
    };
  }
  return {
    command: executable,
    args,
  };
}

export async function validateZugferdPdfA3(pdfBytes: Buffer): Promise<ZugferdPdfValidationResult> {
  const executable = getVeraPdfExecutable();
  if (!executable) {
    return {
      available: false,
      valid: false,
      status: "not-configured",
      message: "ZUGFeRD/PDF-A-3-Validator ist noch nicht konfiguriert.",
      issues: [],
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "workpilot-zugferd-"));
  const pdfPath = path.join(tempDir, "zugferd.pdf");

  try {
    await writeFile(pdfPath, pdfBytes);
    const command = getVeraPdfCommand(executable, ["--format", "xml", "--flavour", "3b", pdfPath]);
    const result = await execFileAsync(command.command, command.args, {
      timeout: 60000,
      windowsHide: true,
    });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const valid = isVeraPdfAccepted(output);
    const issues = valid ? [] : extractVeraPdfIssues(output);

    return {
      available: true,
      valid,
      status: valid ? "accepted" : "rejected",
      message: valid
        ? "ZUGFeRD/PDF-A-3-Validierung bestanden."
        : "ZUGFeRD/PDF-A-3-Validierung hat das PDF abgelehnt.",
      issues,
    };
  } catch (error) {
    const output = getProcessOutput(error);
    if (output && (isVeraPdfAccepted(output) || /isCompliant="false"|<isCompliant>\s*false\s*<\/isCompliant>/i.test(output))) {
      const valid = isVeraPdfAccepted(output);
      const issues = valid ? [] : extractVeraPdfIssues(output);
      return {
        available: true,
        valid,
        status: valid ? "accepted" : "rejected",
        message: valid
          ? "ZUGFeRD/PDF-A-3-Validierung bestanden."
          : "ZUGFeRD/PDF-A-3-Validierung hat das PDF abgelehnt.",
        issues,
      };
    }
    const message = getReadableVeraPdfFailureMessage(error);
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
