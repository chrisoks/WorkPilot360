import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  PublicPhotoError,
  processPublicRequestPhotos,
} from "./photos";

function photoFile(input: Buffer, type = "image/png") {
  return {
    name: "original.png",
    type,
    size: input.byteLength,
    async arrayBuffer() {
      return input.buffer.slice(
        input.byteOffset,
        input.byteOffset + input.byteLength
      ) as ArrayBuffer;
    },
  };
}

describe("public request photo processing", () => {
  it("re-encodes, resizes and strips the original image container", async () => {
    const input = await sharp({
      create: {
        width: 2_400,
        height: 1_200,
        channels: 4,
        background: { r: 40, g: 120, b: 70, alpha: 0.5 },
      },
    })
      .png()
      .withMetadata({ orientation: 1 })
      .toBuffer();

    const [photo] = await processPublicRequestPhotos([photoFile(input)]);
    expect(photo.mimeType).toBe("image/jpeg");
    expect(photo.width).toBe(1_800);
    expect(photo.height).toBe(900);
    expect(photo.fileName).toBe("anfragebild-01.jpg");
    expect(photo.sha256).toMatch(/^[a-f0-9]{64}$/);

    const outputMetadata = await sharp(photo.data).metadata();
    expect(outputMetadata.format).toBe("jpeg");
    expect(outputMetadata.exif).toBeUndefined();
    expect(outputMetadata.icc).toBeUndefined();
  });

  it("rejects MIME disguises and more than six files", async () => {
    const fake = Buffer.from("not an image");
    await expect(
      processPublicRequestPhotos([photoFile(fake, "image/png")])
    ).rejects.toBeInstanceOf(PublicPhotoError);

    const pixel = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: "white",
      },
    })
      .jpeg()
      .toBuffer();
    await expect(
      processPublicRequestPhotos(
        Array.from({ length: 7 }, () => photoFile(pixel, "image/jpeg"))
      )
    ).rejects.toMatchObject({ status: 413 });
  });
});
