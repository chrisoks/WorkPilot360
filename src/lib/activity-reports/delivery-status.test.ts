import { describe, expect, it } from "vitest";
import { getActivityReportDeliveryStatus } from "@/lib/activity-reports/delivery-status";

describe("activity report delivery status", () => {
  const baseDispatch = {
    documentKind: "activityReport",
    documentNumber: "TB_Klaus_Testmann_GPFL-450_07.08.2026",
    projectId: "project-1",
    status: "sent",
  };

  it("recognizes a report sent with an invoice", () => {
    expect(getActivityReportDeliveryStatus(
      "TB_Klaus_Testmann_GPFL-450_07.08.2026.pdf",
      "project-1",
      [{
        ...baseDispatch,
        body: "Als Anhang mit Rechnung RE-10123 versendet.",
        createdAt: "2026-08-07T12:38:00.000Z",
      }]
    )).toEqual({
      createdAt: "2026-08-07T12:38:00.000Z",
      mode: "invoice",
      invoiceNumber: "RE-10123",
    });
  });

  it("recognizes a separately sent report and uses the latest dispatch", () => {
    expect(getActivityReportDeliveryStatus(
      "TB_Klaus_Testmann_GPFL-450_07.08.2026.pdf",
      "project-1",
      [
        { ...baseDispatch, body: "Mailtext", createdAt: "2026-08-07T10:00:00.000Z" },
        { ...baseDispatch, body: "Separat als Tätigkeitsbericht-Mail versendet.", createdAt: "2026-08-07T13:00:00.000Z" },
      ]
    )).toEqual({
      createdAt: "2026-08-07T13:00:00.000Z",
      mode: "separate",
      invoiceNumber: "",
    });
  });

  it("ignores failed, foreign-project and differently named dispatches", () => {
    expect(getActivityReportDeliveryStatus(
      "TB_Klaus_Testmann_GPFL-450_07.08.2026.pdf",
      "project-1",
      [
        { ...baseDispatch, status: "failed", body: "", createdAt: "2026-08-07T13:00:00.000Z" },
        { ...baseDispatch, projectId: "project-2", body: "", createdAt: "2026-08-07T13:00:00.000Z" },
        { ...baseDispatch, documentNumber: "Anderer Bericht", body: "", createdAt: "2026-08-07T13:00:00.000Z" },
      ]
    )).toBeNull();
  });
});
