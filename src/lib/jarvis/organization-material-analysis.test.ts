import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  resolveJarvisOrganizationMaterialIntent,
  resolveJarvisOrganizationMaterialRequest,
  type OrganizationMaterialSource,
} from "@/lib/jarvis/organization-material-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import type { ProjectMaterialInvoice } from "@/lib/jarvis/project-material-analysis";

function invoice(id: string): ProjectMaterialInvoice {
  return {
    id,
    invoiceNumber: `R-${id}`,
    status: "Fakturiert",
    createdAt: "2026-07-01T00:00:00.000Z",
    lines: [{
      id: `line-${id}`,
      catalogItemId: "article-1",
      catalogType: "article",
      quantity: 5,
      unit: "kg",
      title: "Streusalz",
      unitPrice: 20,
      discountPercent: 0,
      materialCostSnapshot: 60,
      laborCostSnapshot: 0,
      costSnapshotAt: "2026-07-01T00:00:00.000Z",
      catalogCostSnapshotVersion: 1,
    }],
  };
}

function source(movementQuantity = -15): OrganizationMaterialSource {
  return {
    load: vi.fn().mockResolvedValue({
      invoices: [invoice("1"), invoice("2"), invoice("3")],
      inventoryMovements: [{
        catalogItemId: "article-1",
        movementType: "sale",
        quantityDelta: movementQuantity,
        invoiceId: "1",
      }],
      catalogItems: [{
        id: "article-1",
        number: "A-1",
        name: "Streusalz",
        unit: "kg",
        purchasePrice: 15,
        salesPrice: 30,
        isActive: true,
        reviewStatus: "approved",
      }],
    }),
  };
}

describe("organization-wide JARVIS material analysis", () => {
  it.each([
    "Analysiere unsere Materialien und Artikel.",
    "Welche Materialien sollten wir preislich prüfen?",
    "Welche Artikel verkaufen wir zu günstig?",
    "Wo stimmen Materialmenge und Lagerentnahme nicht überein?",
  ])("recognizes the organization-wide intent: %s", (question) => {
    expect(resolveJarvisOrganizationMaterialIntent(question)).toBe(true);
  });

  it("leaves explicit project material questions to the project adapter", () => {
    expect(
      resolveJarvisOrganizationMaterialIntent(
        "Welche Materialien wurden bei HAS-1 abgerechnet?"
      )
    ).toBe(false);
  });

  it("gives GF a position-based comparison including stored material costs", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Welche Materialien sollten wir preislich prüfen?",
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
      includeCosts: true,
    });
    expect(response).toEqual(
      expect.objectContaining({
        type: "answer",
        topicId: "management.materials",
      })
    );
    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Belastbar bewertbar", value: "1" }),
        expect.objectContaining({ label: "Lagerabweichungen", value: "0 von 1" }),
      ])
    );
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("20,00");
    expect(rendered).toContain("30,00");
    expect(rendered).toContain("12,00");
    expect(rendered).toContain("15,00");
    expect(rendered).toContain("14,63");
    expect(rendered).toContain("17,14");
    expect(rendered).toContain("vorläufige Teilkostenberechnung");
    expect(rendered).toContain("18 % / 30 %");
    expect(rendered).toContain("Rabatte");
    expect(rendered).not.toContain("neuen Preis von");
  });

  it("allows an authorized manager without exposing purchase prices or historical costs", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Analysiere unsere Materialien und Artikel.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager",
        role: Role.FUEHRUNGSKRAFT,
      }),
      now: new Date("2026-07-28T10:00:00.000Z"),
    }, dataSource);

    expect(dataSource.load).toHaveBeenCalledWith(
      expect.objectContaining({ includeCosts: false })
    );
    expect(response?.type).toBe("answer");
    const rendered = JSON.stringify(response);
    expect(rendered).not.toContain("Einkaufspreis");
    expect(rendered).not.toContain("historische Materialkosten");
    expect(rendered).not.toContain("12,00");
    expect(rendered).not.toContain("15,00");
    expect(rendered).not.toContain("vorläufiger Mindestpreis");
    expect(rendered).not.toContain("Preisrichtlinie");
  });

  it("does not derive a price recommendation from unreviewed catalog data", async () => {
    const dataSource = source();
    const originalLoad = dataSource.load;
    dataSource.load = vi.fn(async (input) => {
      const data = await originalLoad(input);
      return {
        ...data,
        catalogItems: data.catalogItems.map((item) => ({
          ...item,
          reviewStatus: "unreviewed",
        })),
      };
    });
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Welche Materialien sollten wir preislich prüfen?",
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
    expect(rendered).not.toContain("vorläufiger Mindestpreis");
  });

  it("reports invoice-to-inventory differences without calling them physical consumption", async () => {
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Wo stimmen Materialmenge und Lagerentnahme nicht überein?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "gf",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    }, source(-10));

    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Lagerabweichungen", value: "1 von 1" }),
      ])
    );
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("systemseitiger Lagerentnahme");
    expect(rendered).toContain("keinen tatsächlichen physischen Verbrauch");
  });

  it("explains clearly when finished invoices contain no material positions", async () => {
    const emptyMaterialSource: OrganizationMaterialSource = {
      load: vi.fn().mockResolvedValue({
        invoices: [
          {
            ...invoice("1"),
            lines: [{
              id: "service-line",
              catalogItemId: "service-1",
              catalogType: "service",
              quantity: 1,
              unit: "Std.",
              title: "Arbeitsstunde",
              unitPrice: 60,
            }],
          },
          {
            ...invoice("2"),
            lines: [],
          },
        ],
        inventoryMovements: [],
        catalogItems: [],
      }),
    };
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Analysiere unsere Materialien und Artikel.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "gf",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    }, emptyMaterialSource);

    expect(response?.structured?.summary).toBe(
      "2 fertige Rechnungen wurden geprüft. Darin wurde keine auswertbare Materialposition gefunden."
    );
  });

  it("refuses employees before loading organization data", async () => {
    const dataSource = source();
    const response = await resolveJarvisOrganizationMaterialRequest({
      question: "Analysiere unsere Materialien und Artikel.",
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
