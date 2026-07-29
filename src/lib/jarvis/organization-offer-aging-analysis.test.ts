import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOrganizationOfferAgingIntent,
  resolveJarvisOrganizationOfferAgingRequest,
  type OrganizationOfferAgingSource,
} from "@/lib/jarvis/organization-offer-aging-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

function source(): OrganizationOfferAgingSource {
  return {
    load: vi.fn().mockResolvedValue({
      offers: [
        {
          id: "open-old",
          projectId: "project-1",
          projectNumber: "HAS-1",
          projectTitle: "Hausmeisterdienst",
          offerNumber: "A-100",
          status: "Versendet",
          customerName: "Kunde A",
          netTotal: 1000,
          plannedExecutionMonth: "2026-08",
          wonAt: null,
          lostAt: null,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        {
          id: "open-young",
          projectId: "project-2",
          projectNumber: "MKG-209",
          projectTitle: "Marketing",
          offerNumber: "A-101",
          status: "Final",
          customerName: "Kunde B",
          netTotal: 500,
          plannedExecutionMonth: "",
          wonAt: null,
          lostAt: null,
          createdAt: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          id: "draft",
          projectId: "project-1",
          projectNumber: "HAS-1",
          projectTitle: "Hausmeisterdienst",
          offerNumber: "A-102",
          status: "Entwurf",
          customerName: "Kunde A",
          netTotal: 900,
          plannedExecutionMonth: "",
          wonAt: null,
          lostAt: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          id: "lost",
          projectId: "project-1",
          projectNumber: "HAS-1",
          projectTitle: "Hausmeisterdienst",
          offerNumber: "A-103",
          status: "Verloren",
          customerName: "Kunde A",
          netTotal: 700,
          plannedExecutionMonth: "",
          wonAt: null,
          lostAt: new Date("2026-06-01T00:00:00.000Z"),
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          id: "invoiced",
          projectId: "project-1",
          projectNumber: "HAS-1",
          projectTitle: "Hausmeisterdienst",
          offerNumber: "A-104",
          status: "Final",
          customerName: "Kunde A",
          netTotal: 1200,
          plannedExecutionMonth: "",
          wonAt: null,
          lostAt: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      linkedInvoices: [
        {
          sourceOfferId: "invoiced",
          sourceOfferNumber: "A-104",
          status: "Fakturiert",
        },
        {
          sourceOfferId: "open-young",
          sourceOfferNumber: "A-101",
          status: "Entwurf",
        },
      ],
      sentDispatches: [
        {
          documentId: "open-old",
          documentNumber: "A-100",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
    }),
  };
}

function emptySource(): OrganizationOfferAgingSource {
  return {
    load: vi.fn().mockResolvedValue({
      offers: [],
      linkedInvoices: [],
      sentDispatches: [],
    }),
  };
}

const salesProfile = createJarvisAccessProfile({
  id: "sales",
  role: Role.VERTRIEB,
});

describe("organization-wide JARVIS offer aging analysis", () => {
  it.each([
    "Welche Kunden haben offene Angebote?",
    "Welche Angebote sind seit mehr als 30 Tagen offen?",
    "Zeig unsere offenen Angebote.",
    "Welche Angebote müssen wir nachfassen?",
  ])("recognizes the organization-wide intent: %s", (question) => {
    expect(resolveJarvisOrganizationOfferAgingIntent(question)).toBeDefined();
  });

  it("keeps project-specific offer questions in the project adapter", () => {
    expect(
      resolveJarvisOrganizationOfferAgingIntent(
        "Welche offenen Angebote hat HAS-1?"
      )
    ).toBeUndefined();
  });

  it("lists only genuinely open offers and uses the documented send date", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationOfferAgingRequest({
      question: "Welche Kunden haben offene Angebote?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      now: new Date("2026-07-29T10:00:00.000Z"),
      source: dataSource,
    });

    expect(dataSource.load).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(response).toMatchObject({
      type: "answer",
      topicId: "management.offer-aging",
    });
    expect(response?.records).toHaveLength(2);
    expect(response?.records?.[0].title).toContain("A-100");
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("58 Tage offen");
    expect(rendered).toContain("versendet am 01.06.2026");
    expect(rendered).toContain("1.500,00");
    expect(rendered).not.toContain("A-102");
    expect(rendered).not.toContain("A-103");
    expect(rendered).not.toContain("A-104");
  });

  it("applies an explicit age threshold and falls back transparently to creation", async () => {
    const response = await resolveJarvisOrganizationOfferAgingRequest({
      question: "Welche Angebote sind seit mehr als 30 Tagen offen?",
      organizationId: "org-1",
      accessProfile: salesProfile,
      now: new Date("2026-07-29T10:00:00.000Z"),
      source: source(),
    });

    expect(response?.records).toHaveLength(1);
    expect(response?.records?.[0].title).toContain("A-100");
    expect(JSON.stringify(response)).toContain("mindestens 30 Tage");
  });

  it.each([
    [
      "Welche Kunden haben offene Angebote?",
      "keine offenen Angebote gefunden",
    ],
    [
      "Welche Angebote sind seit mehr als 30 Tagen offen?",
      "keine seit mindestens 30 Tagen offenen Angebote gefunden",
    ],
  ])("uses correct grammar for an empty result: %s", async (question, expected) => {
    const response = await resolveJarvisOrganizationOfferAgingRequest({
      question,
      organizationId: "org-1",
      accessProfile: salesProfile,
      now: new Date("2026-07-29T10:00:00.000Z"),
      source: emptySource(),
    });

    expect(response?.message).toContain(expected);
  });

  it("refuses unauthorized employees before loading offer data", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationOfferAgingRequest({
      question: "Welche Kunden haben offene Angebote?",
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
