import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  resolveJarvisEnterpriseInsightIntent,
  resolveJarvisEnterpriseFollowUpQuestion,
  resolveJarvisEnterpriseInsightRequest,
  type JarvisEnterpriseInsightSnapshot,
  type JarvisEnterpriseInsightSource,
} from "@/lib/jarvis/enterprise-insights";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const executive = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });
const salesUser = createJarvisAccessProfile({ id: "sales", role: Role.VERTRIEB });
const now = new Date("2026-08-04T10:00:00.000Z");

const snapshot: JarvisEnterpriseInsightSnapshot = {
  invoices: [
    {
      id: "invoice-august",
      invoiceNumber: "RE-100",
      projectId: "project-1",
      projectNumber: "OBJ-1",
      customerName: "Alpha GmbH",
      status: "Fakturiert",
      netTotal: 10_000,
      grossTotal: 11_900,
      serviceDate: "2026-08-01",
      plannedExecutionMonth: "2026-08",
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
      lines: [{ totalNet: 10_000, materialCostSnapshot: 2_000, laborCostSnapshot: 3_000 }],
    },
    {
      id: "invoice-july",
      invoiceNumber: "RE-99",
      projectId: "project-2",
      projectNumber: "GLR-2",
      customerName: "Beta AG",
      status: "Bezahlt",
      netTotal: 8_000,
      grossTotal: 9_520,
      serviceDate: "2026-07-15",
      plannedExecutionMonth: "2026-07",
      createdAt: new Date("2026-07-15T08:00:00.000Z"),
      lines: [{ totalNet: 8_000, materialCostSnapshot: 1_000, laborCostSnapshot: 3_000 }],
    },
    {
      id: "invoice-prior-year",
      invoiceNumber: "RE-50",
      projectId: "project-4",
      projectNumber: "OBJ-4",
      customerName: "Alpha GmbH",
      status: "Bezahlt",
      netTotal: 12_000,
      grossTotal: 14_280,
      serviceDate: "2025-08-02",
      plannedExecutionMonth: "2025-08",
      createdAt: new Date("2025-08-02T08:00:00.000Z"),
      lines: [{ totalNet: 12_000, materialCostSnapshot: 2_000, laborCostSnapshot: 4_000 }],
    },
    {
      id: "invoice-draft",
      invoiceNumber: "RE-ENTWURF",
      projectId: "project-3",
      projectNumber: "OBJ-3",
      customerName: "Alpha GmbH",
      status: "Entwurf",
      netTotal: 50_000,
      grossTotal: 59_500,
      serviceDate: "2026-08-03",
      plannedExecutionMonth: "2026-08",
      createdAt: new Date("2026-08-03T08:00:00.000Z"),
      lines: [],
    },
  ],
  offers: [
    {
      id: "offer-viewed",
      offerNumber: "AN-10",
      projectId: "project-1",
      projectNumber: "OBJ-1",
      projectTitle: "Objektbetreuung",
      customerName: "Alpha GmbH",
      status: "Versendet",
      netTotal: 20_000,
      createdAt: new Date("2026-07-01T08:00:00.000Z"),
      updatedAt: new Date("2026-07-20T08:00:00.000Z"),
      acceptanceRequests: [{ sentAt: new Date("2026-07-20T08:00:00.000Z"), firstViewedAt: new Date("2026-08-01T08:00:00.000Z"), acceptedAt: null, revokedAt: null }],
    },
    {
      id: "offer-draft",
      offerNumber: "AN-ENTWURF",
      projectId: "project-4",
      projectNumber: "OBJ-4",
      projectTitle: "Zusatzleistung",
      customerName: "Alpha GmbH",
      status: "Entwurf",
      netTotal: 40_000,
      createdAt: new Date("2026-08-02T08:00:00.000Z"),
      updatedAt: new Date("2026-08-02T08:00:00.000Z"),
      acceptanceRequests: [],
    },
    {
      id: "offer-won",
      offerNumber: "AN-9",
      projectId: "project-2",
      projectNumber: "GLR-2",
      projectTitle: "Glasreinigung",
      customerName: "Beta AG",
      status: "Gewonnen",
      netTotal: 12_000,
      createdAt: new Date("2026-06-01T08:00:00.000Z"),
      updatedAt: new Date("2026-06-15T08:00:00.000Z"),
      acceptanceRequests: [],
    },
    {
      id: "offer-lost",
      offerNumber: "AN-8",
      projectId: "project-3",
      projectNumber: "OBJ-3",
      projectTitle: "Hausmeisterservice",
      customerName: "Gamma KG",
      status: "Verloren",
      netTotal: 5_000,
      createdAt: new Date("2026-05-01T08:00:00.000Z"),
      updatedAt: new Date("2026-05-20T08:00:00.000Z"),
      acceptanceRequests: [],
    },
  ],
  opportunities: [
    {
      id: "opportunity-1",
      title: "Zusatzreinigung",
      customerName: "Alpha GmbH",
      contactId: "contact-1",
      projectId: "project-1",
      offerId: null,
      ownerName: "Vertrieb",
      stage: "qualified",
      estimatedValue: 10_000,
      probability: 50,
      nextAction: "Kunden anrufen",
      nextActionAt: new Date("2026-08-03T08:00:00.000Z"),
      updatedAt: new Date("2026-08-01T08:00:00.000Z"),
    },
  ],
  targets: [
    {
      id: "target-1",
      title: "Umsatzziel August",
      metricKey: "revenue",
      targetValue: 25_000,
      targetMonth: "2026-08",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      status: "open",
    },
  ],
};

const source: JarvisEnterpriseInsightSource = {
  async load() {
    return snapshot;
  },
};

async function ask(question: string) {
  return resolveJarvisEnterpriseInsightRequest({
    question,
    organizationId: "org-1",
    accessProfile: executive,
    now,
    source,
  });
}

describe("JARVIS enterprise insights", () => {
  it.each([
    ["Und nur die letzten 6 Monate?", "enterprise.revenue-trend", "Zeige den Umsatztrend"],
    ["Und gegenüber dem Vorjahr?", "enterprise.margin-trend", "Zeige den Margentrend"],
    ["Dann mit 60 Prozent", "enterprise.offer-conversion-scenario", "Simuliere die Annahmequote"],
  ])("carries a safe enterprise topic into the follow-up %s", (question, topicId, expected) => {
    expect(resolveJarvisEnterpriseFollowUpQuestion(question, { topicId })).toContain(expected);
  });

  it("does not carry an enterprise topic into an unrelated new question", () => {
    expect(resolveJarvisEnterpriseFollowUpQuestion("Zeige meine Aufgaben", { topicId: "enterprise.revenue-trend" })).toBe("Zeige meine Aufgaben");
  });

  it.each([
    ["Analysiere unser Unternehmen vollständig", "overview"],
    ["Wie läufts bei uns?", "overview"],
    ["Gib mir eine BWA-ähnliche Übersicht der wichtigsten Zahlen", "overview"],
    ["Wie entwickelt sich unser Umsatz im Vorjahr und aktuell?", "revenue_trend"],
    ["Wie hat sich unser Umsatz entwickelt?", "revenue_trend"],
    ["Wie siehts mitm Umsatz aus?", "revenue_trend"],
    ["Zeige mir den Margentrend", "margin_trend"],
    ["Wie hat sich unsere Marge entwickelt?", "margin_trend"],
    ["Wie schauts bei der Marge aus?", "margin_trend"],
    ["Wie hoch ist unsere Kundenkonzentration?", "customer_concentration"],
    ["Analysiere unsere Vertriebspipeline", "sales_pipeline"],
    ["Wie siehts bei den Angeboten aus?", "sales_pipeline"],
    ["Gib mir proaktive Vertriebsimpulse", "proactive_sales"],
    ["Welche Kunden soll ich heute angehen?", "proactive_sales"],
    ["Was wäre, wenn 50 Prozent der offenen Angebote angenommen werden?", "offer_conversion_scenario"],
    ["Simuliere eine Preiserhöhung um 5 Prozent", "price_increase_scenario"],
    ["Wie groß ist die Lücke bis zum Umsatzziel?", "target_gap"],
  ] as const)("recognizes %s", (question, intent) => {
    expect(resolveJarvisEnterpriseInsightIntent(question)).toBe(intent);
  });

  it("calculates the revenue trend from finalized invoices only", async () => {
    const result = await ask("Zeige den Umsatztrend der letzten 12 Monate");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.revenue-trend" });
    expect(result?.message).toContain("18.000,00");
    expect(result?.message).toContain("25 %");
    expect(result?.message).toContain("12.000,00");
    expect(result?.message).toContain("50 %");
    expect(result?.message).not.toContain("68.000");
    expect(result?.records?.[0]?.target.kind).toBe("invoice");
  });

  it("shows cost coverage instead of inventing a full margin", async () => {
    const result = await ask("Zeige mir den Margentrend der letzten 12 Monate");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.margin-trend" });
    expect(result?.message).toContain("9.000,00");
    expect(result?.message).toContain("100 %");
  });

  it("measures customer concentration on finalized revenue", async () => {
    const result = await ask("Wie hoch ist unsere Umsatzkonzentration auf Top-Kunden?");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.customer-concentration" });
    expect(result?.message).toContain("55,6 %");
    expect(result?.structured?.sections?.[0]?.items[0]).toContain("Alpha GmbH");
  });

  it("combines open offers and opportunities in the sales pipeline", async () => {
    const result = await ask("Analysiere unsere Vertriebspipeline");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.sales-pipeline" });
    expect(result?.message).toContain("5.000,00");
    expect(result?.message).toContain("20.000,00");
    expect(result?.message).toContain("50 %");
  });

  it("returns prioritized proactive impulses without executing anything", async () => {
    const result = await ask("Gib mir proaktive Vertriebsimpulse");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.proactive-sales" });
    expect(result?.message).toContain("Dry-Run");
    expect(result?.message).toContain("keine Aufgabe");
    expect(result?.records?.[0]?.title).toContain("AN-10");
  });

  it("asks for a rate before running an offer-conversion scenario", async () => {
    const result = await ask("Simuliere die Annahme unserer offenen Angebote");
    expect(result).toMatchObject({ type: "clarification", topicId: "enterprise.offer-conversion-scenario.percentage-required" });
    expect(result?.choices).toHaveLength(3);
  });

  it("calculates an offer-conversion scenario without changing offers", async () => {
    const result = await ask("Was wäre, wenn 50 Prozent der offenen Angebote angenommen werden?");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.offer-conversion-scenario" });
    expect(result?.message).toContain("10.000,00");
    expect(result?.message).toContain("kein Forecast");
    expect(result?.structured?.facts).toContainEqual(expect.objectContaining({ label: "Offene Angebote", value: "1" }));
  });

  it("calculates a price scenario and labels all assumptions", async () => {
    const result = await ask("Simuliere eine Preiserhöhung um 5 Prozent");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.price-increase-scenario" });
    expect(result?.message).toContain("900,00");
    expect(result?.message).toContain("keine Preise verändert");
    expect(result?.structured?.sections?.[0]?.items).toContain("Menge und Leistungsmix unverändert");
  });

  it("calculates the configured revenue-target gap", async () => {
    const result = await ask("Wie groß ist die Lücke bis zum Umsatzziel?");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.target-gap" });
    expect(result?.message).toContain("15.000,00");
    expect(result?.message).toContain("40 %");
  });

  it("provides a bounded overview with transparent data quality", async () => {
    const result = await ask("Analysiere unser Unternehmen vollständig");
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.overview" });
    expect(result?.message).toContain("18.000,00");
    expect(result?.message).toContain("20.000,00");
    expect(result?.structured?.facts?.some((fact) => fact.label === "Kostenabdeckung")).toBe(true);
    expect(result?.choices?.map((choice) => choice.label)).toEqual([
      "Umsatztrend vertiefen",
      "Marge vertiefen",
      "Vertriebsimpulse öffnen",
    ]);
  });

  it("refuses enterprise financial analysis for normal employees", async () => {
    const result = await resolveJarvisEnterpriseInsightRequest({
      question: "Analysiere unser Unternehmen vollständig",
      organizationId: "org-1",
      accessProfile: employee,
      now,
      source,
    });
    expect(result).toMatchObject({ type: "refusal", topicId: "enterprise.overview.refused" });
  });

  it("allows sales users to request proactive sales signals", async () => {
    const result = await resolveJarvisEnterpriseInsightRequest({
      question: "Welche Kunden soll ich heute angehen?",
      organizationId: "org-1",
      accessProfile: salesUser,
      now,
      source,
    });
    expect(result).toMatchObject({ type: "answer", topicId: "enterprise.proactive-sales" });
  });
});
