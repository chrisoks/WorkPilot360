import { describe, expect, it } from "vitest";

import { findProjectAttachmentIndex } from "./attachment-identity";

const attachments = [
  { name: "bild.jpg", storageFileId: "file-1" },
  { name: "bild.jpg", storageFileId: "file-2" },
  { name: "bericht.pdf", storageFileId: "file-3" },
];

describe("findProjectAttachmentIndex", () => {
  it("uses the immutable storage id before name and position", () => {
    expect(
      findProjectAttachmentIndex({
        attachments,
        requestedStorageFileId: "file-2",
        requestedIndex: 0,
        requestedName: "bild.jpg",
      })
    ).toBe(1);
  });

  it("accepts a matching index and name for legacy attachments", () => {
    expect(
      findProjectAttachmentIndex({
        attachments,
        requestedIndex: 2,
        requestedName: "bericht.pdf",
      })
    ).toBe(2);
  });

  it("fails closed for ambiguous legacy names", () => {
    expect(
      findProjectAttachmentIndex({
        attachments,
        requestedIndex: 99,
        requestedName: "bild.jpg",
      })
    ).toBe(-1);
  });
});
