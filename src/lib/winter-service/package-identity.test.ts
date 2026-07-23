import { describe, expect, it } from "vitest";
import { isWinterServicePackageForSelection } from "./package-identity";

const base = {
  packageDescription: "",
  packageMatchcode: "",
  projectNumber: "OBJ-156",
  customerId: "customer-ah-lademann",
  customerDisplayName: "AH Lademann",
};

describe("Winterdienst-Paketidentität", () => {
  it("verwechselt Firmen mit gemeinsamem Namensbestandteil nicht", () => {
    expect(
      isWinterServicePackageForSelection({
        ...base,
        packageName: "Winterdienst-Einsatz WEG Lademann Osterburken",
      })
    ).toBe(false);
  });

  it("erkennt den vollständigen Firmennamen", () => {
    expect(
      isWinterServicePackageForSelection({
        ...base,
        packageName: "Winterdienst - Streuen | AH Lademann",
      })
    ).toBe(true);
  });

  it("erkennt Privatkunden nur über den vollständigen Namen", () => {
    expect(
      isWinterServicePackageForSelection({
        ...base,
        customerDisplayName: "Eva Hilbert",
        packageName: "Winterdienst - Streuen | Eva Hilbert",
      })
    ).toBe(true);
    expect(
      isWinterServicePackageForSelection({
        ...base,
        customerDisplayName: "Eva Hilbert",
        packageName: "Winterdienst - Streuen | Eva Müller",
      })
    ).toBe(false);
  });

  it("bevorzugt die eindeutige interne Kunden-ID", () => {
    expect(
      isWinterServicePackageForSelection({
        ...base,
        packageName: "Individuell benanntes Paket",
        packageMatchcode: "WINTER:customer-ah-lademann:OKI0402",
      })
    ).toBe(true);
  });
});
