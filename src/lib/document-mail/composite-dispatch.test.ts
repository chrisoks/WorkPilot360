import { describe, expect, it } from "vitest";

import { planCompositeDocumentDispatch } from "./composite-dispatch";

const expectedPrimary = {
  organizationId: "org-1",
  documentKind: "invoice",
  documentId: "invoice-1",
  senderUserId: "user-1",
};
const expectedActivity = {
  organizationId: "org-1",
  documentKind: "activityReport",
  documentId: "invoice-1:activity-report",
  senderUserId: "user-1",
};

function record(
  identity: typeof expectedPrimary | typeof expectedActivity,
  status: string
) {
  return { ...identity, status };
}

describe("planCompositeDocumentDispatch", () => {
  it("claims a completely new primary dispatch", () => {
    expect(
      planCompositeDocumentDispatch({
        primary: null,
        activity: null,
        expectsActivity: true,
        expectedPrimary,
        expectedActivity,
      })
    ).toEqual({ action: "claim-primary" });
  });

  it("resumes only the missing activity-report mail after the primary mail was sent", () => {
    expect(
      planCompositeDocumentDispatch({
        primary: record(expectedPrimary, "sent"),
        activity: null,
        expectsActivity: true,
        expectedPrimary,
        expectedActivity,
      })
    ).toEqual({ action: "resume-activity" });
  });

  it("replays only when every requested mail was sent", () => {
    expect(
      planCompositeDocumentDispatch({
        primary: record(expectedPrimary, "sent"),
        activity: record(expectedActivity, "sent"),
        expectsActivity: true,
        expectedPrimary,
        expectedActivity,
      })
    ).toEqual({ action: "replay-complete" });
  });

  it("fails closed for an uncertain activity-report attempt", () => {
    expect(
      planCompositeDocumentDispatch({
        primary: record(expectedPrimary, "sent"),
        activity: record(expectedActivity, "sending"),
        expectsActivity: true,
        expectedPrimary,
        expectedActivity,
      })
    ).toEqual({ action: "blocked", target: "activity", status: "sending" });
  });

  it("rejects a reused key with a different activity identity", () => {
    expect(
      planCompositeDocumentDispatch({
        primary: record(expectedPrimary, "sent"),
        activity: record(
          { ...expectedActivity, documentId: "invoice-2:activity-report" },
          "sent"
        ),
        expectsActivity: true,
        expectedPrimary,
        expectedActivity,
      })
    ).toEqual({ action: "conflict", target: "activity" });
  });
});
