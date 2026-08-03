import { describe, expect, it } from "vitest";

import { buildActivityReportEntryId } from "./report-identity";

const base = {
  organizationId: "org-1",
  projectId: "project-1",
  month: "2026-08",
  contextKey: "invoice-1",
};

describe("buildActivityReportEntryId", () => {
  it("is stable and UUID-shaped for retries", () => {
    const first = buildActivityReportEntryId(base);
    expect(buildActivityReportEntryId(base)).toBe(first);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("separates months and report contexts", () => {
    expect(buildActivityReportEntryId({ ...base, month: "2026-09" })).not.toBe(
      buildActivityReportEntryId(base)
    );
    expect(
      buildActivityReportEntryId({ ...base, contextKey: "invoice-2" })
    ).not.toBe(buildActivityReportEntryId(base));
  });
});
