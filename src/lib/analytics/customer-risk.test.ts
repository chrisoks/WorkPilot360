import { describe, expect, it } from "vitest";
import { getCustomerRiskAssessment } from "./customer-risk";

describe("getCustomerRiskAssessment", () => {
  it("kennzeichnet Kunden ohne Signale als unauffällig", () => {
    expect(getCustomerRiskAssessment({
      overdueInvoiceCount: 0,
      highestReminderLevel: 0,
      hotAlertCount: 0,
      openRevenue: 0,
      revenue: 100,
    })).toMatchObject({
      label: "Unauffällig",
      reason: "Keine akuten Risikosignale",
      score: 0,
      state: "good",
    });
  });

  it("wertet einen hohen offenen Anteil allein nicht als akutes Risiko", () => {
    expect(getCustomerRiskAssessment({
      overdueInvoiceCount: 0,
      highestReminderLevel: 0,
      hotAlertCount: 0,
      openRevenue: 100,
      revenue: 100,
    })).toMatchObject({
      label: "Unauffällig",
      reason: "Keine akuten Risikosignale",
      reasons: [],
      score: 1,
      state: "good",
    });
  });

  it("erklärt einen Prüfstatus mit den konkreten Auslösern", () => {
    expect(getCustomerRiskAssessment({
      overdueInvoiceCount: 1,
      highestReminderLevel: 0,
      hotAlertCount: 0,
      openRevenue: 605,
      revenue: 605,
    })).toMatchObject({
      label: "Prüfen",
      reason: "1 überfällige Rechnung · Mehr als 50 % des Umsatzes offen",
      score: 4,
      state: "ok",
    });
  });

  it("fasst mehrere starke Signale als kritisch zusammen", () => {
    expect(getCustomerRiskAssessment({
      overdueInvoiceCount: 1,
      highestReminderLevel: 2,
      hotAlertCount: 1,
      openRevenue: 200,
      revenue: 500,
    })).toMatchObject({
      label: "Kritisch",
      reason: "1 überfällige Rechnung · Mahnstufe 2 · 1 KuZu-Hot-Alert",
      score: 9,
      state: "low",
    });
  });
});
