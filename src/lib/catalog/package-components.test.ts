import { describe, expect, it, vi } from "vitest";
import {
  CatalogPackageValidationError,
  validateCatalogPackageComponents,
} from "./package-components";

function dbWith(items: Array<{ id: string; number: string; name: string; type: string; isActive: boolean }>) {
  return {
    catalogItem: {
      findMany: vi.fn().mockResolvedValue(items),
    },
  };
}

describe("catalog package component validation", () => {
  it("accepts active articles and services and normalizes their values", async () => {
    const db = dbWith([
      { id: "article-1", number: "A1001", name: "Material", type: "article", isActive: true },
      { id: "service-1", number: "L1001", name: "Montage", type: "service", isActive: true },
    ]);
    const result = await validateCatalogPackageComponents({
      organizationId: "org-1",
      components: [
        { componentItemId: "article-1", quantity: 2, priceOverride: 4.5 },
        { componentItemId: "service-1", quantity: 1, planningMinutesOverride: 30 },
      ],
      db: db as never,
    });

    expect(result).toEqual([
      expect.objectContaining({ componentItemId: "article-1", quantity: 2, position: 0, priceOverride: 4.5 }),
      expect.objectContaining({ componentItemId: "service-1", quantity: 1, position: 1, planningMinutesOverride: 30 }),
    ]);
  });

  it.each([
    [[], "mindestens einen gültigen Artikel"],
    [[{ componentItemId: "", quantity: 1 }], "Bitte wähle"],
    [[{ componentItemId: "article-1", quantity: 0 }], "größer als 0"],
    [[{ componentItemId: "article-1", quantity: -1 }], "größer als 0"],
    [[{ componentItemId: "article-1", quantity: 1 }, { componentItemId: "article-1", quantity: 1 }], "nur einmal"],
  ])("rejects malformed component lists", async (components, message) => {
    await expect(validateCatalogPackageComponents({
      organizationId: "org-1",
      components,
      db: dbWith([]) as never,
    })).rejects.toThrow(String(message));
  });

  it("rejects unknown, inactive and nested package components", async () => {
    await expect(validateCatalogPackageComponents({
      organizationId: "org-1",
      components: [{ componentItemId: "missing", quantity: 1 }],
      db: dbWith([]) as never,
    })).rejects.toThrow("aktuellen Organisation nicht gefunden");

    await expect(validateCatalogPackageComponents({
      organizationId: "org-1",
      components: [{ componentItemId: "inactive", quantity: 1 }],
      db: dbWith([{ id: "inactive", number: "A1002", name: "Alt", type: "article", isActive: false }]) as never,
    })).rejects.toThrow("ist deaktiviert");

    await expect(validateCatalogPackageComponents({
      organizationId: "org-1",
      components: [{ componentItemId: "package-1", quantity: 1 }],
      db: dbWith([{ id: "package-1", number: "P1001", name: "Paket", type: "package", isActive: true }]) as never,
    })).rejects.toThrow("nicht in andere Pakete verschachtelt");
  });

  it("uses a dedicated validation error type", async () => {
    await expect(validateCatalogPackageComponents({
      organizationId: "org-1",
      components: null,
      db: dbWith([]) as never,
    })).rejects.toBeInstanceOf(CatalogPackageValidationError);
  });
});
