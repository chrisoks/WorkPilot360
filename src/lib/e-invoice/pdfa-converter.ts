import { execFile } from "child_process";
import { existsSync, readdirSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type PdfA3ConversionResult =
  | {
      available: true;
      converted: true;
      pdfBytes: Buffer;
      message: string;
    }
  | {
      available: false;
      converted: false;
      pdfBytes: null;
      message: string;
    }
  | {
      available: true;
      converted: false;
      pdfBytes: null;
      message: string;
    };

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getPdfA3ConverterExecutable() {
  return cleanText(
    process.env.PDFA3_CONVERTER_PATH ||
      process.env.ZUGFERD_PDFA3_CONVERTER_PATH ||
      process.env.GHOSTSCRIPT_PATH ||
      process.env.GS_PATH
  );
}

function getGhostscriptCommand(executable: string, args: string[]) {
  if (process.platform === "win32" && /\.bat$/i.test(executable)) {
    return { command: "cmd.exe", args: ["/c", executable, ...args] };
  }
  return { command: executable, args };
}

function findGhostscriptIccProfile() {
  const configured = cleanText(process.env.PDFA3_ICC_PROFILE_PATH || process.env.ZUGFERD_ICC_PROFILE_PATH);
  if (configured) return configured;

  const directCandidates = [
    "/usr/share/color/icc/ghostscript/srgb.icc",
    "/usr/share/color/icc/sRGB.icc",
    "/usr/share/color/icc/srgb.icc",
    "/usr/share/ghostscript/iccprofiles/srgb.icc",
    "C:\\Program Files\\gs\\iccprofiles\\srgb.icc",
  ];
  const directMatch = directCandidates.find((candidate) => existsSync(candidate));
  if (directMatch) return directMatch;

  const ghostscriptRoot = "/usr/share/ghostscript";
  if (existsSync(ghostscriptRoot)) {
    for (const entry of readdirSync(ghostscriptRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(ghostscriptRoot, entry.name, "iccprofiles", "srgb.icc");
      if (existsSync(candidate)) return candidate;
    }
  }

  return "";
}

function getReadableConversionFailureMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  if (/timed out|timeout/i.test(rawMessage)) {
    return "PDF/A-3-Konvertierung hat zu lange gedauert.";
  }
  if (/ENOENT|not found|cannot find/i.test(rawMessage)) {
    return "PDF/A-3-Konverter konnte nicht gestartet werden. Bitte PDFA3_CONVERTER_PATH oder GHOSTSCRIPT_PATH setzen.";
  }
  return "PDF/A-3-Konvertierung konnte nicht erfolgreich abgeschlossen werden.";
}

export async function convertPdfToPdfA3(pdfBytes: Buffer): Promise<PdfA3ConversionResult> {
  const executable = getPdfA3ConverterExecutable();
  if (!executable) {
    return {
      available: false,
      converted: false,
      pdfBytes: null,
      message: "PDF/A-3-Konverter ist noch nicht konfiguriert.",
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "workpilot-pdfa3-"));
  const inputPath = path.join(tempDir, "input.pdf");
  const outputPath = path.join(tempDir, "output.pdf");
  const iccProfilePath = findGhostscriptIccProfile();

  try {
    await writeFile(inputPath, pdfBytes);
    const args = [
      "-dPDFA=3",
      "-dBATCH",
      "-dNOPAUSE",
      "-dNOOUTERSAVE",
      "-sDEVICE=pdfwrite",
      "-dPDFACompatibilityPolicy=1",
      "-dEmbedAllFonts=true",
      "-dSubsetFonts=true",
      "-sColorConversionStrategy=RGB",
      "-sProcessColorModel=DeviceRGB",
      ...(iccProfilePath ? [`-sOutputICCProfile=${iccProfilePath}`] : []),
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];
    const command = getGhostscriptCommand(executable, args);

    await execFileAsync(command.command, command.args, {
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      available: true,
      converted: true,
      pdfBytes: await readFile(outputPath),
      message: "PDF/A-3-Konvertierung abgeschlossen.",
    };
  } catch (error) {
    return {
      available: true,
      converted: false,
      pdfBytes: null,
      message: getReadableConversionFailureMessage(error),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
