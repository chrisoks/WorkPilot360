import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOrganizationReceivablesIntent,
  resolveJarvisOrganizationReceivablesRequest,
  type OrganizationReceivablesSource,
} from "@/lib/jarvis/organization-receivables-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

function source(): OrganizationReceivablesSource {
  return {
    load: vi.fn().mockResolvedValue([
      {
        id: "overdue",
        projectId: "project-1",
        projectNumber: "HAS-1",
        projectTitle: "Hausmeisterdienst",
        invoiceNumber: "R-100",
        customerName: "Kunde A",
        status: "Fakturiert",
        netTotal: 1000,
        dueDate: "2026-07-20",
        reminderLevel: 0,
        isPaid: false,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "today",
        projectId: "project-2",
        projectNumber: "MKG-209",
        projectTitle: "Abrechnungsprüfung",
        invoiceNumber: "R-101",
        customerName: "Kunde B",
        status: "Versendet",
        netTotal: 500,
        dueDate: "2026-07-29",
        reminderLevel: 1,
        isPaid: false,
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
      },
      {
        id: "missing-date",
        projectId: "",
        projectNumber: "",
        projectTitle: "",
        invoiceNumber: "R-102",
        customerName: "Kunde C",
        status: "Fakturiert",
        netTotal: 250,
        dueDate: "",
        reminderLevel: 0,
        isPaid: false,
        createdAt: new Date("2026-07-03T00:00:00.000Z"),
      },
      {
        id: "paid",
        projectId: "project-1",
        projectNumber: "HAS-1",
        projectTitle: "Hausmeisterdienst",
        invoiceNumber: "R-103",
        customerName: "Kunde A",
        status: "Bezahlt",
        netTotal: 800,
        dueDate: "2026-07-01",
        reminderLevel: 0,
        isPaid: false,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        id: "draft",
        projectId: "project-1",
        projectNumber: "HAS-1",
        projectTitle: "Hausmeisterdienst",
        invoiceNumber: "R-104",
        customerName: "Kunde A",
        status: "Entwurf",
        netTotal: 900,
        dueDate: "2026-07-01",
        reminderLevel: 0,
        isPaid: false,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
      },
      {
        id: "cancelled",
        projectId: "project-1",
        projectNumber: "HAS-1",
        projectTitle: "Hausmeisterdienst",
        invoiceNumber: "R-105",
        customerName: "Kunde A",
        status: "Storniert",
        netTotal: 700,
        dueDate: "2026-07-01",
        reminderLevel: 0,
        isPaid: false,
        createdAt: new Date("2026-06-03T00:00:00.000Z"),
      },
    ]),
  };
}

const accountingProfile = createJarvisAccessProfile({
  id: "accounting",
  role: Role.BUCHHALTUNG,
});

describe("organization-wide JARVIS receivables analysis", () => {
  it.each([
    "Wie hoch sind unsere offenen Posten?",
    "Wie hoch sint unser offnen Posten?",
    "Welche offenen Forderungen sind überfällig?",
    "Zeig mir die überfälligen Forderungen.",
    "Zeig mir offene Rechnungen bei uns.",
    "Wie viele Rechnungen sind überfällig?",
  ])("recognizes the organization-wide intent: %s", (question) => {
    expect(resolveJarvisOrganizationReceivablesIntent(question)).toBeDefined();
  });

  it("leaves project-specific invoice questions to the project adapter", () => {
    expect(
      resolveJarvisOrganizationReceivablesIntent(
        "Welche offenen Posten hat HAS-1?"
      )
    ).toBeUndefined();
  });

  it("returns a truthful net stichtag view and excludes inactive invoices", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationReceivablesRequest({
      question: "Wie hoch sind unsere offenen Posten?",
      organizationId: "org-1",
      accessProfile: accountingProfile,
      now: new Date("2026-07-29T10:00:00.000Z"),
      source: dataSource,
    });

    expect(dataSource.load).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(response).toMatchObject({
      type: "answer",
      topicId: "management.receivables",
    });
    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Insgesamt offen",
          value: "1.750,00 €",
        }),
        expect.objectContaining({
          label: "Überfällig",
          value: "1.000,00 €",
        }),
        expect.objectContaining({
          label: "Offene Rechnungen",
          value: "3",
        }),
      ])
    );
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("aus einer Rechnung überfällig");
    expect(rendered).not.toContain("1 Rechnungen");
    expect(rendered).toContain("kein belastbares Fälligkeitsdatum");
    expect(rendered).toContain("noch keine Mahnstufe");
    expect(rendered).not.toContain("R-103");
    expect(rendered).not.toContain("R-104");
    expect(rendered).not.toContain("R-105");
  });

  it("lists only overdue invoices when explicitly requested", async () => {
    const response = await resolveJarvisOrganizationReceivablesRequest({
      question: "Welche offenen Forderungen sind überfällig?",
      organizationId: "org-1",
      accessProfile: accountingProfile,
      now: new Date("2026-07-29T10:00:00.000Z"),
      source: source(),
    });

    expect(response?.records).toHaveLength(1);
    expect(response?.records?.[0]).toMatchObject({
      title: "R-100",
      target: {
        kind: "invoice",
        id: "overdue",
        projectId: "project-1",
      },
    });
  });

  it("refuses employees before loading financial organization data", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationReceivablesRequest({
      question: "Wie hoch sind unsere offenen Posten?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      }),
      source: dataSource,
    });

    expect(response?.type).toBe("refusal");
    expect(dataSource.load).not.toHaveBeenCalled();
  });
});
