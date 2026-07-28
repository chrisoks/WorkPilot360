import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOrganizationServiceRateIntent,
  resolveJarvisOrganizationServiceRateRequest,
  type OrganizationServiceRateSource,
} from "@/lib/jarvis/organization-service-rate-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import type { ProjectServiceRateInvoice } from "@/lib/jarvis/project-service-rate-analysis";

function invoice(id: string): ProjectServiceRateInvoice {
  return {
    id,
    invoiceNumber: `R-${id}`,
    status: "Fakturiert",
    createdAt: "2026-07-01T00:00:00.000Z",
    lines: [{
      id: `line-${id}`,
      catalogItemId: "service-1",
      catalogType: "service",
      quantity: 10,
      unit: "Std.",
      title: "Hausmeisterstunde",
      unitPrice: 60,
      discountPercent: 0,
      laborCostSnapshot: 300,
      costSnapshotAt: "2026-07-01T00:00:00.000Z",
      catalogCostSnapshotVersion: 1,
    }],
  };
}

function source(): OrganizationServiceRateSource {
  return {
    load: vi.fn().mockResolvedValue({
      invoices: [invoice("1"), invoice("2"), invoice("3")],
      timeEntries: [{
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "Hausmeisterstunde",
        durationMs: 30 * 3_600_000,
        laborCostSnapshot: 900,
        costSnapshotAt: new Date("2026-07-01T00:00:00.000Z"),
      }],
      catalogItems: [{
        id: "service-1",
        number: "L-1",
        name: "Hausmeisterstunde",
        unit: "Std.",
        salesPrice: 70,
        isActive: true,
        reviewStatus: "approved",
      }],
    }),
  };
}

describe("organization-wide JARVIS service-rate analysis", () => {
  it.each([
    "Analysiere unsere Stundenverrechnungssätze.",
    "Welche Stundenleistungen sollten wir preislich prüfen?",
    "Wo sollten wir unsere Stundensätze erhöhen?",
  ])("recognizes the organization-wide intent: %s", (question) => {
    expect(resolveJarvisOrganizationServiceRateIntent(question)).toBe(true);
  });

  it("leaves explicit project questions to the project adapter", () => {
    expect(
      resolveJarvisOrganizationServiceRateIntent(
        "Analysiere den Stundenverrechnungssatz bei HAS-1."
      )
    ).toBe(false);
  });

  it("gives GF a ranked, evidence-based comparison including stored labor costs", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationServiceRateRequest({
      question: "Analysiere unsere Stundenverrechnungssätze.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "gf",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      now: new Date("2026-07-28T10:00:00.000Z"),
    }, dataSource);

    expect(dataSource.load).toHaveBeenCalledWith({
      organizationId: "org-1",
      periodStart: new Date("2025-08-01T00:00:00.000Z"),
      periodStartKey: "2025-08-01",
    });
    expect(response).toEqual(
      expect.objectContaining({
        type: "answer",
        topicId: "management.service-rates",
      })
    );
    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Belastbar bewertbar", value: "1" }),
      ])
    );
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("60,00");
    expect(rendered).toContain("70,00");
    expect(rendered).toContain("gespeicherte Mitarbeiterkosten");
    expect(rendered).toContain("36,59");
    expect(rendered).toContain("42,86");
    expect(rendered).toContain("vorläufige Teilkostenberechnung");
    expect(rendered).toContain("18 % / 30 %");
    expect(rendered).toContain("nicht allein");
  });

  it("allows an authorized manager to compare rates without exposing payroll costs", async () => {
    const response = await resolveJarvisOrganizationServiceRateRequest({
      question: "Welche Stundenleistungen sollten wir preislich prüfen?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager",
        role: Role.FUEHRUNGSKRAFT,
      }),
      now: new Date("2026-07-28T10:00:00.000Z"),
    }, source());

    expect(response?.type).toBe("answer");
    const rendered = JSON.stringify(response);
    expect(rendered).not.toContain("Mitarbeiterkosten");
    expect(rendered).not.toContain("30,00");
    expect(rendered).not.toContain("900");
    expect(rendered).not.toContain("vorläufiger Mindeststundensatz");
    expect(rendered).not.toContain("Preisrichtlinie");
  });

  it("does not derive a rate recommendation from unreviewed service data", async () => {
    const dataSource = source();
    const originalLoad = dataSource.load;
    dataSource.load = vi.fn(async (input) => {
      const data = await originalLoad(input);
      return {
        ...data,
        catalogItems: data.catalogItems.map((item) => ({
          ...item,
          reviewStatus: "needs_review",
        })),
      };
    });
    const response = await resolveJarvisOrganizationServiceRateRequest({
      question: "Analysiere unsere Stundenverrechnungssätze.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "gf",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    }, dataSource);

    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Belastbar bewertbar", value: "0" }),
        expect.objectContaining({ label: "Fachlich freigegeben", value: "0" }),
      ])
    );
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("fachlich prüfen und freigeben");
    expect(rendered).not.toContain("vorläufiger Mindeststundensatz");
  });

  it("does not present an inflated revenue per stamped hour when time links are incomplete", async () => {
    const incompleteSource: OrganizationServiceRateSource = {
      load: vi.fn().mockResolvedValue({
        invoices: [invoice("1")],
        timeEntries: [{
          billingCatalogItemId: "service-1",
          billingCatalogItemLabel: "Hausmeisterstunde",
          durationMs: 0.24 * 3_600_000,
          laborCostSnapshot: 12,
          costSnapshotAt: new Date("2026-07-01T00:00:00.000Z"),
        }],
        catalogItems: [{
          id: "service-1",
          number: "L-1",
          name: "Hausmeisterstunde",
          unit: "Std.",
          salesPrice: 60,
          isActive: true,
          reviewStatus: "approved",
        }],
      }),
    };
    const response = await resolveJarvisOrganizationServiceRateRequest({
      question: "Analysiere unsere Stundenverrechnungssätze.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "gf",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    }, incompleteSource);

    const rendered = JSON.stringify(response);
    expect(rendered).toContain("1 fertige Rechnung");
    expect(rendered).toContain(
      "wegen unvollständiger Zeitzuordnung nicht belastbar"
    );
    expect(rendered).not.toContain("2.500");
  });

  it("refuses employees before loading financial organization data", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationServiceRateRequest({
      question: "Analysiere unsere Stundenverrechnungssätze.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      }),
    }, dataSource);

    expect(response?.type).toBe("refusal");
    expect(dataSource.load).not.toHaveBeenCalled();
  });
});
