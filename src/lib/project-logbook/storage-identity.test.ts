import { describe, expect, it } from "vitest";
import { buildProjectLogbookAttachmentSourceEntityId } from "./storage-identity";

describe("project logbook attachment storage identity", () => {
  it("keeps retries with the same entry id in separate object-storage namespaces", () => {
    const firstAttempt = buildProjectLogbookAttachmentSourceEntityId({
      entryId: "entry-1",
      attachmentIndex: 0,
      uploadBatchId: "batch-1",
    });
    const retry = buildProjectLogbookAttachmentSourceEntityId({
      entryId: "entry-1",
      attachmentIndex: 0,
      uploadBatchId: "batch-2",
    });

    expect(firstAttempt).toBe("entry-1:0:batch-1");
    expect(retry).toBe("entry-1:0:batch-2");
    expect(retry).not.toBe(firstAttempt);
  });

  it("keeps attachments from one upload batch distinct", () => {
    const first = buildProjectLogbookAttachmentSourceEntityId({
      entryId: "entry-1",
      attachmentIndex: 0,
      uploadBatchId: "batch-1",
    });
    const second = buildProjectLogbookAttachmentSourceEntityId({
      entryId: "entry-1",
      attachmentIndex: 1,
      uploadBatchId: "batch-1",
    });

    expect(second).not.toBe(first);
  });
});
