import { describe, expect, it } from "vitest";
import { shouldAttemptHourlyDraftAttachment } from "./hourly-stamp-automation";

describe("shouldAttemptHourlyDraftAttachment", () => {
  it.each(["finished", "interrupted", ""])(
    "keeps project time billable for completion status %s",
    (completionStatus) => {
      expect(
        shouldAttemptHourlyDraftAttachment({
          mode: "project",
          completionStatus,
        })
      ).toBe(true);
    }
  );

  it("does not invoice unproductive time", () => {
    expect(
      shouldAttemptHourlyDraftAttachment({
        mode: "unproductive",
        completionStatus: "",
      })
    ).toBe(false);
  });
});
