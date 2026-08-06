import { describe, expect, it } from "vitest";
import {
  detectProjectImageContentType,
  getProjectImageExtension,
} from "./image-content-type";

function dataUrl(contentType: string, bytes: number[]) {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

describe("project image content type", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xdb], "image/jpeg", ".jpg"],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", ".png"],
    ["image/webp", [...Buffer.from("RIFF1234WEBP")], "image/webp", ".webp"],
    ["image/gif", [...Buffer.from("GIF89a")], "image/gif", ".gif"],
  ])("detects %s from the file bytes", (declaredType, bytes, expectedType, extension) => {
    const detectedType = detectProjectImageContentType(dataUrl(declaredType, bytes as number[]));

    expect(detectedType).toBe(expectedType);
    expect(getProjectImageExtension(detectedType!)).toBe(extension);
  });

  it("uses the real bytes instead of a misleading declared MIME type", () => {
    expect(
      detectProjectImageContentType(
        dataUrl("image/jpeg", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");
  });

  it.each(["", "data:image/jpeg,not-base64", "data:image/jpeg;base64,invalid***"])(
    "rejects an invalid or unknown data URL",
    (value) => {
      expect(detectProjectImageContentType(value)).toBeNull();
    }
  );
});
