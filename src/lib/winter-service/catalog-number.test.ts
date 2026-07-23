import { describe, expect, it } from "vitest";
import { getNextWinterServiceCatalogNumber } from "./catalog-number";

describe("getNextWinterServiceCatalogNumber", () => {
  it("beginnt nach den vorhandenen Stammdaten mit OKI0461", () => {
    expect(getNextWinterServiceCatalogNumber(["OKI0455", "OKI0460", "OKI0501"])).toBe("OKI0461");
  });

  it("zählt innerhalb des Winterdienstblocks fortlaufend hoch", () => {
    expect(getNextWinterServiceCatalogNumber(["OKI0461", "OKI0462"])).toBe("OKI0463");
  });

  it("springt nach OKI0499 auf OKI1401", () => {
    expect(getNextWinterServiceCatalogNumber(["OKI0499", "OKI0904"])).toBe("OKI1401");
  });

  it("zählt ab OKI1401 fortlaufend weiter", () => {
    expect(getNextWinterServiceCatalogNumber(["OKI0499", "OKI1401"])).toBe("OKI1402");
  });
});
