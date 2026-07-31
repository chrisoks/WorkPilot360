import { describe, expect, it, vi } from "vitest";
import {
  createConfirmedOfferDraft,
  evaluateOfferDraft,
} from "@/lib/offers/offer-draft-service";

function createDb() {
  const project = {
    id: "project-1",
    projectNumber: "GLR-449",
    title: "Glasreinigung",
    customer: "Musterkunde",
    status: "Umsetzung",
    projectType: "OK solutions",
    projectKind: "einmaliges Projekt",
    projectRuntimeFrom: null,
    projectRuntimeUntil: null,
    address: "Musterstraße 1, 76133 Karlsruhe",
    contactId: "customer-1",
    contactPersonId: "person-1",
    updatedAt: new Date("2026-07-31T07:00:00.000Z"),
  };
  const catalog = {
    id: "catalog-1",
    type: "service",
    name: "Glasreinigung",
    unit: "Std",
    description: "Reinigung der Glasflächen",
    salesPrice: 50,
    vatRate: 19,
    updatedAt: new Date("2026-07-31T07:05:00.000Z"),
  };
  return {
    workPilotProject: {
      findFirst: vi.fn(async ({ where }) =>
        where.id === project.id && where.organizationId === "org-1"
          ? project
          : null
      ),
    },
    contact: {
      findFirst: vi.fn(async ({ where }) =>
        where.organizationId !== "org-1"
          ? null
          : where.id === "customer-1"
            ? {
                companyName: "Muster GmbH",
                firstName: null,
                lastName: null,
                addressLine1: "Musterstraße 1",
                street: null,
                postalCode: "76133",
                city: "Karlsruhe",
              }
            : {
                companyName: null,
                firstName: "Erika",
                lastName: "Muster",
              }
      ),
    },
    catalogItem: {
      findMany: vi.fn(async ({ where }) =>
        where.organizationId === "org-1" &&
        where.id?.in?.includes("catalog-1")
          ? [catalog]
          : []
      ),
    },
    offer: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: "offer-1",
        offerNumber: "ANG-10123",
      })),
    },
    offerHistory: {
      create: vi.fn(async ({ data }) => data),
    },
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ locked: 1 }])
      .mockResolvedValueOnce([{ nextNumber: 10123 }]),
  };
}

describe("shared offer draft service", () => {
  it("uses current catalog values, exposes overrides and calculates totals", async () => {
    const db = createDb();
    const result = await evaluateOfferDraft({
      organizationId: "org-1",
      db: db as never,
      restrictToCatalog: true,
      draft: {
        projectId: "project-1",
        plannedExecutionMonth: "2026-11",
        discountPercent: 10,
        lines: [
          {
            catalogItemId: "catalog-1",
            quantity: 2,
            unitPrice: 55,
            discountPercent: 5,
          },
        ],
      },
    });

    expect(result.missingFields).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.project?.customerName).toBe("Muster GmbH");
    expect(result.input.lines[0]).toMatchObject({
      title: "Glasreinigung",
      unit: "Std",
      totalNet: 104.5,
    });
    expect(result.totals).toMatchObject({
      lineNetBeforeOfferDiscount: 104.5,
      offerDiscountAmount: 10.45,
      netTotal: 94.05,
      vatAmount: 17.87,
      grossTotal: 111.92,
    });
  });

  it("creates only a draft with a locked global number and history entry", async () => {
    const tx = createDb();
    const result = await createConfirmedOfferDraft({
      tx: tx as never,
      organizationId: "org-1",
      actorName: "Christian Eid",
      source: "jarvis",
      draft: {
        projectId: "project-1",
        plannedExecutionMonth: "2026-11",
        lines: [{ catalogItemId: "catalog-1", quantity: 2 }],
      },
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          offerNumber: "ANG-10123",
          status: "Entwurf",
          netTotal: 100,
          grossTotal: 119,
        }),
      })
    );
    expect(tx.offerHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "created",
          actorName: "Christian Eid",
        }),
      })
    );
    expect(result).toEqual({
      id: "offer-1",
      offerNumber: "ANG-10123",
      projectId: "project-1",
      netTotal: 100,
      grossTotal: 119,
    });
  });
});
