export type ProjectImageContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

function decodeBase64Prefix(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex < 0 || !dataUrl.slice(0, separatorIndex).toLowerCase().includes(";base64")) {
    return null;
  }

  try {
    const prefix = atob(dataUrl.slice(separatorIndex + 1, separatorIndex + 33));
    return Uint8Array.from(prefix, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function detectProjectImageContentType(dataUrl: string): ProjectImageContentType | null {
  const bytes = decodeBase64Prefix(dataUrl);
  if (!bytes) return null;

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a" ? "image/gif" : null;
}

export function getProjectImageExtension(contentType: ProjectImageContentType) {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
  }
}
