import { describe, expect, it } from "vitest";
import {
  extractJarvisVehicleCalculationIntake,
  extractJarvisWinterCalculationIntake,
  looksLikeGenericJarvisCalculatorStart,
  looksLikeJarvisCalculatorRequest,
  matchJarvisVehicleOption,
} from "./calculator-intake";

describe("JARVIS calculator intake", () => {
  it("extracts explicit winter-service values without inventing defaults", () => {
    expect(
      extractJarvisWinterCalculationIntake(
        "Kalkuliere Winterdienst für 1.250 m²: Bereitschaft 0,45 €/m² pro Monat, 5 Saisonmonate, 18 Einsätze, Einsatzzeit 55 Minuten, Stundensatz 68 €/h, 22 g/m², Salzpreis 1,35 €/kg, Zeitaufschlag 25 %, Salzaufschlag 50 %, Mischung 65/35."
      )
    ).toEqual({
      areaSqm: 1250,
      readinessPricePerSqmPerMonth: 0.45,
      seasonMonths: 5,
      expectedDeployments: 18,
      baseServiceMinutes: 55,
      laborSalesRatePerHour: 68,
      saltGramsPerSqm: 22,
      saltSalesPricePerKg: 1.35,
      plowTimeIncreasePercent: 25,
      plowSaltIncreasePercent: 50,
      mixedSpreadingPercent: 65,
      mixedPlowingPercent: 35,
    });
  });

  it("keeps omitted winter values omitted", () => {
    expect(
      extractJarvisWinterCalculationIntake(
        "Kalkuliere Winterdienst für 800 qm mit 12 Einsätzen."
      )
    ).toEqual({ areaSqm: 800, expectedDeployments: 12 });
  });

  it("accepts written currency and percentage units", () => {
    expect(
      extractJarvisWinterCalculationIntake(
        "Kalkuliere Winterdienst mit Bereitschaft 0,45 Euro pro qm pro Monat, Stundensatz 68 Euro pro Stunde, Salzpreis 1,35 Euro pro kg, Zeitaufschlag 25 Prozent und Salzaufschlag 50 Prozent."
      )
    ).toEqual({
      readinessPricePerSqmPerMonth: 0.45,
      laborSalesRatePerHour: 68,
      saltSalesPricePerKg: 1.35,
      plowTimeIncreasePercent: 25,
      plowSaltIncreasePercent: 50,
    });
  });

  it("extracts trip distance and an explicit manual fuel price", () => {
    expect(
      extractJarvisVehicleCalculationIntake(
        "Berechne die Fahrt über 180 km mit Dieselpreis 1,729 €/l."
      )
    ).toEqual({
      distanceKm: 180,
      fuelPriceMode: "manual",
      manualFuelPricePerLiter: 1.729,
    });
  });

  it("selects exactly one named vehicle and rejects ambiguity", () => {
    const options = [
      { id: "1", label: "F-01 · Crafter · BI-OK 123" },
      { id: "2", label: "F-02 · Caddy · BI-OK 456" },
    ];
    expect(matchJarvisVehicleOption("mit dem Crafter", options)?.id).toBe("1");
    expect(matchJarvisVehicleOption("mit Fahrzeug", options)).toBeUndefined();
  });

  it("recognizes a generic calculator choice request", () => {
    expect(looksLikeGenericJarvisCalculatorStart("Starte eine Kalkulation")).toBe(
      true
    );
    expect(
      looksLikeGenericJarvisCalculatorStart(
        "Starte eine Winterdienst-Kalkulation"
      )
    ).toBe(false);
  });

  it("keeps detailed calculator requests on the secure system route", () => {
    expect(
      looksLikeJarvisCalculatorRequest(
        "Kalkuliere Winterdienst mit 1.250 qm und einem Stundensatz von 68 Euro."
      )
    ).toBe(true);
    expect(
      looksLikeJarvisCalculatorRequest(
        "Was kostet die Fahrt mit dem Crafter über 180 km?"
      )
    ).toBe(true);
    expect(
      looksLikeJarvisCalculatorRequest("Wie entwickelt sich unser Umsatz?")
    ).toBe(false);
  });
});
