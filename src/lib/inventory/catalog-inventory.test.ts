import { expect, test } from "vitest";
import { getInvoiceArticleQuantities } from "./catalog-inventory";

test("counts direct articles and article components from packages", () => {
  const result = getInvoiceArticleQuantities([
    {
      catalogItemId: "salt",
      catalogType: "article",
      quantity: 3,
      packageComponentsSnapshot: [],
    },
    {
      catalogItemId: "salt",
      catalogType: "article",
      quantity: 4,
      packageComponentsSnapshot: [],
    },
    {
      catalogItemId: "package",
      catalogType: "package",
      quantity: 2,
      packageComponentsSnapshot: [
        { componentItemId: "salt", componentType: "article", quantityPerPackage: 7.5 },
        { componentItemId: "labor", componentType: "service", quantityPerPackage: 1 },
      ],
    },
  ]);
  expect(result.get("salt")).toBe(22);
  expect(result.has("labor")).toBe(false);
});
