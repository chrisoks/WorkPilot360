import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOrganizationOperationsIntent,
  resolveJarvisOrganizationOperationsRequest,
  type OrganizationOperationsSnapshot,
  type OrganizationOperationsSource,
} from "@/lib/jarvis/organization-operations-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const management = createJarvisAccessProfile({ id: "gf-1", role: Role.GESCHAEFTSFUEHRER });

function snapshot(): OrganizationOperationsSnapshot {
  return {
    users: [
      { id: "user-1", firstName: "Max", lastName: "Muster", planningBoard: "Immocare", planningGroup: "Team A", weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 }, leadershipManagerId: "lead-1", leadershipDeputyId: null },
      { id: "user-2", firstName: "Mia", lastName: "Beispiel", planningBoard: "Immocare", planningGroup: "Team A", weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 }, leadershipManagerId: "other-lead", leadershipDeputyId: "lead-1" },
    ],
    absences: [{ userId: "user-2", date: new Date("2026-08-04T00:00:00.000Z"), dayPart: "full", status: "genehmigt", deletedAt: null }],
    planningEntries: [
      { userId: "user-1", date: "2026-08-03", durationMinutes: 600, approvalStatus: "confirmed", deletedAt: null },
      { userId: "user-2", date: "2026-08-03", durationMinutes: 120, approvalStatus: "confirmed", deletedAt: null },
      { userId: "user-2", date: "2026-08-04", durationMinutes: 480, approvalStatus: "requested", deletedAt: null },
    ],
    projects: [
      { id: "project-1", projectNumber: "HAS-1", title: "Hausmeisterdienst", customer: "Kunde Alt", contactId: "contact-1", status: "Umsetzung", projectType: "Dauerläufer", projectKind: "hourly", recurringBillingMode: "Stundenabrechnung", timeBudgetEnabled: false, autoBillingEnabled: false, updatedAt: new Date("2026-06-01T00:00:00.000Z") },
      { id: "project-2", projectNumber: "GLR-2", title: "Glasreinigung", customer: "Kunde Neu", contactId: "contact-2", status: "Umsetzung", projectType: "Einmalprojekt", projectKind: "one_time", recurringBillingMode: null, timeBudgetEnabled: false, autoBillingEnabled: false, updatedAt: new Date("2026-08-01T00:00:00.000Z") },
      { id: "project-3", projectNumber: "ARC-3", title: "Archiv", customer: "Archivkunde", contactId: null, status: "Archiviert", projectType: null, projectKind: null, recurringBillingMode: null, timeBudgetEnabled: false, autoBillingEnabled: false, updatedAt: new Date("2026-05-01T00:00:00.000Z") },
    ],
    offers: [
      { id: "offer-1", projectId: "project-1", offerNumber: "ANG-1", status: "Versendet", customerName: "Kunde Alt", netTotal: 1000, updatedAt: new Date("2026-06-10T00:00:00.000Z") },
      { id: "offer-2", projectId: "project-3", offerNumber: "ANG-2", status: "Entwurf", customerName: "Archivkunde", netTotal: 500, updatedAt: new Date("2026-05-10T00:00:00.000Z") },
    ],
    invoices: [
      { id: "invoice-1", projectId: "project-1", invoiceNumber: "RE-1", status: "Entwurf", customerName: "Kunde Alt", netTotal: 250, serviceDate: "", plannedExecutionMonth: "", dueDate: "", isPaid: false, createdAt: new Date("2026-06-16T00:00:00.000Z"), updatedAt: new Date("2026-06-16T00:00:00.000Z") },
      { id: "invoice-2", projectId: "project-2", invoiceNumber: "RE-2", status: "Fakturiert", customerName: "Kunde Neu", netTotal: 800, serviceDate: "2026-08-02", plannedExecutionMonth: "2026-08", dueDate: "2026-08-31", isPaid: false, createdAt: new Date("2026-08-02T00:00:00.000Z"), updatedAt: new Date("2026-08-02T00:00:00.000Z") },
      { id: "invoice-3", projectId: "project-2", invoiceNumber: "RE-3", status: "Storniert", customerName: "Kunde Neu", netTotal: -100, serviceDate: "2026-08-02", plannedExecutionMonth: "2026-08", dueDate: "2026-08-31", isPaid: false, createdAt: new Date("2026-08-02T00:00:00.000Z"), updatedAt: new Date("2026-08-02T00:00:00.000Z") },
    ],
    timeEntries: [
      { id: "time-1", projectId: "project-1", durationMs: 7_200_000n, invoiceId: null, deletedAt: null, createdAt: new Date("2026-06-12T00:00:00.000Z") },
      { id: "time-2", projectId: "project-2", durationMs: 3_600_000n, invoiceId: "invoice-2", deletedAt: null, createdAt: new Date("2026-08-02T00:00:00.000Z") },
    ],
    contacts: [
      { id: "contact-1", customerNumber: "7001", companyName: "Kunde Alt", firstName: null, lastName: null, updatedAt: new Date("2026-06-01T00:00:00.000Z") },
      { id: "contact-2", customerNumber: "7002", companyName: "Kunde Neu", firstName: null, lastName: null, updatedAt: new Date("2026-08-01T00:00:00.000Z") },
    ],
    projectLogbookEntries: [{ projectId: "project-1", createdAt: new Date("2026-06-15T00:00:00.000Z") }],
    customerLogbookEntries: [],
    tasks: [],
    offerAcceptanceRequests: [
      { offerId: "offer-1", sentAt: new Date("2026-06-10T00:00:00.000Z"), firstViewedAt: new Date("2026-06-11T00:00:00.000Z"), acceptedAt: null, revokedAt: null },
      { offerId: "offer-x", sentAt: new Date("2026-07-01T00:00:00.000Z"), firstViewedAt: null, acceptedAt: new Date("2026-07-02T00:00:00.000Z"), revokedAt: null },
    ],
  };
}

function source(data = snapshot()): OrganizationOperationsSource {
  return { load: vi.fn().mockResolvedValue(data) };
}

describe("organization-wide JARVIS operations analysis", () => {
  it.each([
    ["Wie viele Rechnungsentwürfe gibt es aktuell?", "invoice_drafts"],
    ["Welche Planungsgruppe ist nächste Woche überlastet?", "utilization"],
    ["Welche Kunden haben offene Angebote, aber seit 30 Tagen keine Aktivität?", "inactive_customers"],
    ["Welche Projekte haben Zeiten, aber noch keine Rechnung?", "unbilled_projects"],
    ["Welche Projekte laufen ohne gültiges Angebot?", "missing_offer_projects"],
    ["Analysiere alle kritischen Projekte und nenne mir die Ursache.", "critical_projects"],
    ["Wie hoch ist unsere Öffnungsquote und Annahmequote?", "offer_rates"],
    ["Wie hoch ist unser Umsatz?", "revenue"],
  ])("recognizes %s", (question, expected) => {
    expect(resolveJarvisOrganizationOperationsIntent(question)).toBe(expected);
  });

  it("keeps explicit project questions in the project adapter", () => {
    expect(resolveJarvisOrganizationOperationsIntent("Warum hat HAS-1 trotz Zeiten keine Rechnung?")).toBeUndefined();
  });

  it("returns active invoice drafts and current-month net revenue without inactive invoices", async () => {
    const dataSource = source();
    const drafts = await resolveJarvisOrganizationOperationsRequest({ question: "Wie viele Rechnungsentwürfe gibt es aktuell?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: dataSource });
    const revenue = await resolveJarvisOrganizationOperationsRequest({ question: "Wie hoch ist unser Umsatz?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: dataSource });
    expect(drafts).toMatchObject({ topicId: "management.operations.invoice-drafts", records: [{ title: "RE-1" }] });
    expect(drafts?.message).toContain("Ein aktiver Rechnungsentwurf ist");
    expect(revenue).toMatchObject({ topicId: "management.operations.revenue" });
    expect(revenue?.message).toContain("800,00");
    expect(revenue?.message).toContain("einer finanziell aktiven Rechnung");
  });

  it("finds unbilled time, missing offer foundations and explains critical causes", async () => {
    const dataSource = source();
    const unbilled = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Projekte haben Zeiten, aber noch keine Rechnung?", organizationId: "org-1", accessProfile: management, source: dataSource });
    const missingOffer = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Projekte laufen ohne gültiges Angebot?", organizationId: "org-1", accessProfile: management, source: dataSource });
    const critical = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Projekte sind aktuell kritisch?", organizationId: "org-1", accessProfile: management, source: dataSource });
    expect(unbilled?.records?.map((record) => record.title)).toEqual(["HAS-1 · Hausmeisterdienst"]);
    expect(unbilled?.records?.[0].summary).toContain("2.00 Std.");
    expect(missingOffer?.records?.map((record) => record.title)).toEqual(["GLR-2 · Glasreinigung"]);
    expect(critical?.records?.find((record) => record.title.startsWith("HAS-1"))?.summary).toContain("Zeiten ohne Rechnungszuordnung");
    expect(critical?.structured?.sections?.[0].items.join(" ")).toContain("Wirtschaftlichkeit");
  });

  it("marks only genuinely overdue unpaid invoices as a critical signal", async () => {
    const data = snapshot();
    data.projects = data.projects.map((project) => ({ ...project, timeBudgetEnabled: true }));
    data.timeEntries = [];
    data.invoices[0] = { ...data.invoices[0], status: "Fakturiert", dueDate: "2026-07-31", isPaid: false };
    const overdue = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Projekte sind aktuell kritisch?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: source(data) });
    expect(overdue?.records?.map((record) => record.title)).toEqual(["HAS-1 · Hausmeisterdienst"]);
    expect(overdue?.records?.[0].summary).toContain("überfällige offene Rechnung");

    data.invoices[0] = { ...data.invoices[0], isPaid: true };
    const paid = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Projekte sind aktuell kritisch?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: source(data) });
    expect(paid?.records).toEqual([]);
  });

  it("uses confirmed planning, personal capacity and approved absences for utilization", async () => {
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Mitarbeiter haben im August zu wenig Arbeit?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: source() });
    expect(response).toMatchObject({ topicId: "management.operations.utilization" });
    expect(response?.message).toContain("bestätigten, nicht gelöschten Planungen");
    const items = response?.structured?.sections?.flatMap((section) => section.items).join(" ") ?? "";
    expect(items).toContain("Mia Beispiel");
    expect(items).not.toContain("requested");
  });

  it("finds only open-offer customers beyond the transparent 30-day activity threshold", async () => {
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Kunden haben offene Angebote, aber seit 30 Tagen keine Aktivität?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: source() });
    expect(response).toMatchObject({ topicId: "management.operations.inactive-customers", records: [{ title: "Kunde Alt" }] });
    expect(response?.structured?.sections?.[0].items.join(" ")).toContain("externe Telefonate");
  });

  it("returns a plain-language answer instead of an empty card for no inactive customers", async () => {
    const data = snapshot();
    data.contacts[0] = { ...data.contacts[0], updatedAt: new Date("2026-08-02T00:00:00.000Z") };
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Kunden haben offene Angebote, aber seit 30 Tagen keine Aktivität?", organizationId: "org-1", accessProfile: management, now: new Date("2026-08-03T10:00:00.000Z"), source: source(data) });
    expect(response).toMatchObject({ type: "unknown", structured: undefined });
    expect(response?.message).toContain("keinen Kunden");
  });

  it("calculates offer link rates from the explicit eligible population", async () => {
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Wie hoch ist unsere Öffnungsquote und Annahmequote?", organizationId: "org-1", accessProfile: management, source: source() });
    expect(response?.structured?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Öffnungsquote", value: "100.0 %" }),
      expect.objectContaining({ label: "Annahmequote", value: "50.0 %" }),
    ]));
  });

  it("restricts employees to their own utilization even if a source returns foreign users", async () => {
    const employee = createJarvisAccessProfile({ id: "user-1", role: Role.MITARBEITER });
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Wie stark sind unsere Mitarbeiter aktuell ausgelastet?", organizationId: "org-1", accessProfile: employee, now: new Date("2026-08-03T10:00:00.000Z"), source: source() });
    const items = response?.structured?.sections?.flatMap((section) => section.items).join(" ") ?? "";
    expect(response?.message).toContain("deine eigene Auslastung");
    expect(items).toContain("Max Muster");
    expect(items).not.toContain("Mia Beispiel");
  });

  it("restricts leaders to direct and deputy assignments", async () => {
    const leader = createJarvisAccessProfile({ id: "lead-1", role: Role.FUEHRUNGSKRAFT });
    const data = snapshot();
    data.users.push({ id: "user-3", firstName: "Fremde", lastName: "Person", planningBoard: "Solutions", planningGroup: "Team B", weeklyCapacity: { monday: 8 }, leadershipManagerId: "other-lead", leadershipDeputyId: null });
    const response = await resolveJarvisOrganizationOperationsRequest({ question: "Welche Mitarbeiter haben im August zu wenig Arbeit?", organizationId: "org-1", accessProfile: leader, now: new Date("2026-08-03T10:00:00.000Z"), source: source(data) });
    const items = response?.structured?.sections?.flatMap((section) => section.items).join(" ") ?? "";
    expect(response?.message).toContain("Führungs- und Vertretungsbereich");
    expect(items).toContain("Max Muster");
    expect(items).toContain("Mia Beispiel");
    expect(items).not.toContain("Fremde Person");
  });
});
