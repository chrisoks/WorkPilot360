import type { WinterServiceCalculationInput } from "@/lib/winter-service/calculation";

export type JarvisWinterCalculationIntake = Partial<WinterServiceCalculationInput>;

export type JarvisVehicleCalculationIntake = {
  distanceKm?: number;
  fuelPriceMode?: "live" | "manual";
  manualFuelPricePerLiter?: number;
};

function normalized(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[²]/g, "2")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFrom(raw: string | undefined) {
  if (!raw) return undefined;
  const compact = raw.replace(/\s/g, "");
  const decimal =
    compact.includes(",") && compact.includes(".")
      ? compact.lastIndexOf(",") > compact.lastIndexOf(".")
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "")
      : compact.includes(",")
        ? compact.replace(",", ".")
        : /^\d{1,3}(?:\.\d{3})+$/.test(compact)
          ? compact.replace(/\./g, "")
        : compact;
  const value = Number(decimal);
  return Number.isFinite(value) ? value : undefined;
}

function captureNumber(value: string, pattern: RegExp) {
  return numberFrom(pattern.exec(value)?.[1]);
}

export function extractJarvisWinterCalculationIntake(
  question: string
): JarvisWinterCalculationIntake {
  const value = normalized(question);
  const result: JarvisWinterCalculationIntake = {};
  const areaSqm = captureNumber(
    value,
    /(\d[\d.,]*)\s*(?:m2|qm|quadratmeter)\b/
  );
  const readinessPricePerSqmPerMonth =
    captureNumber(
      value,
      /(?:bereitschaft(?:spreis)?|grundpreis)[^\d]{0,25}(\d[\d.,]*)\s*(?:€|euro|eur)?\s*(?:\/|pro)\s*(?:m2|qm|quadratmeter)(?:\s*(?:\/|pro)\s*monat)?/
    ) ??
    captureNumber(
      value,
      /(\d[\d.,]*)\s*(?:€|euro|eur)\s*(?:\/|pro)\s*(?:m2|qm|quadratmeter)\s*(?:\/|pro)\s*monat/
    );
  const seasonMonths = captureNumber(
    value,
    /(\d[\d.,]*)\s*(?:saison)?monate?\b/
  );
  const expectedDeployments =
    captureNumber(
      value,
      /(?:erwartet(?:e|en)?\s*)?(\d[\d.,]*)\s*einsatz\w*\b/
    ) ??
    captureNumber(value, /einsatzh[aä]ufigkeit[^\d]{0,12}(\d[\d.,]*)/);
  const baseServiceMinutes =
    captureNumber(
      value,
      /(?:einsatzzeit|arbeitszeit|dauer)[^\d]{0,18}(\d[\d.,]*)\s*(?:min(?:uten?)?)\b/
    ) ??
    captureNumber(value, /(\d[\d.,]*)\s*min(?:uten?)?\s*(?:je|pro)\s*einsatz/);
  const laborSalesRatePerHour =
    captureNumber(
      value,
      /(?:stundenverrechnungssatz|stundensatz|lohn(?:-| )?vk)[^\d]{0,18}(\d[\d.,]*)/
    ) ??
    captureNumber(value, /(\d[\d.,]*)\s*(?:€|euro|eur)\s*(?:\/|pro)\s*(?:h|std|stunde)\b/);
  const saltGramsPerSqm =
    captureNumber(
      value,
      /(?:streugutmenge|salzmenge)[^\d]{0,18}(\d[\d.,]*)\s*(?:g|gramm)\s*(?:\/|pro)\s*(?:m2|qm)/
    ) ??
    captureNumber(
      value,
      /(\d[\d.,]*)\s*(?:g|gramm)\s*(?:\/|pro)\s*(?:m2|qm)/
    );
  const saltSalesPricePerKg =
    captureNumber(
      value,
      /(?:streugutpreis|salzpreis)[^\d]{0,18}(\d[\d.,]*)/
    ) ??
    captureNumber(
      value,
      /(\d[\d.,]*)\s*(?:€|euro|eur)\s*(?:\/|pro)\s*(?:kg|kilogramm)\b/
    );
  const plowTimeIncreasePercent = captureNumber(
    value,
    /(?:zeitaufschlag|zeit plus|mehrzeit)[^\d]{0,20}(\d[\d.,]*)\s*(?:%|prozent\b)/
  );
  const plowSaltIncreasePercent = captureNumber(
    value,
    /(?:streugutaufschlag|salzaufschlag|salz plus)[^\d]{0,20}(\d[\d.,]*)\s*(?:%|prozent\b)/
  );
  const mix = /(?:misch(?:ung|anteil)?|pauschal)[^\d]{0,20}(\d[\d.,]*)\s*(?:\/|zu|:)\s*(\d[\d.,]*)/.exec(
    value
  );

  if (areaSqm !== undefined) result.areaSqm = areaSqm;
  if (readinessPricePerSqmPerMonth !== undefined) {
    result.readinessPricePerSqmPerMonth = readinessPricePerSqmPerMonth;
  }
  if (seasonMonths !== undefined) result.seasonMonths = seasonMonths;
  if (expectedDeployments !== undefined) {
    result.expectedDeployments = expectedDeployments;
  }
  if (baseServiceMinutes !== undefined) {
    result.baseServiceMinutes = baseServiceMinutes;
  }
  if (laborSalesRatePerHour !== undefined) {
    result.laborSalesRatePerHour = laborSalesRatePerHour;
  }
  if (saltGramsPerSqm !== undefined) result.saltGramsPerSqm = saltGramsPerSqm;
  if (saltSalesPricePerKg !== undefined) {
    result.saltSalesPricePerKg = saltSalesPricePerKg;
  }
  if (plowTimeIncreasePercent !== undefined) {
    result.plowTimeIncreasePercent = plowTimeIncreasePercent;
  }
  if (plowSaltIncreasePercent !== undefined) {
    result.plowSaltIncreasePercent = plowSaltIncreasePercent;
  }
  if (mix) {
    const spreading = numberFrom(mix[1]);
    const plowing = numberFrom(mix[2]);
    if (spreading !== undefined && plowing !== undefined) {
      result.mixedSpreadingPercent = spreading;
      result.mixedPlowingPercent = plowing;
    }
  }
  return result;
}

export function extractJarvisVehicleCalculationIntake(
  question: string
): JarvisVehicleCalculationIntake {
  const value = normalized(question);
  const result: JarvisVehicleCalculationIntake = {};
  const distanceKm =
    captureNumber(value, /(?:strecke|distanz|entfernung)[^\d]{0,18}(\d[\d.,]*)\s*km\b/) ??
    captureNumber(value, /(\d[\d.,]*)\s*(?:km|kilometer)\b/);
  const manualFuelPricePerLiter =
    captureNumber(
      value,
      /(?:kraftstoff|diesel|benzin|e5|e10)(?:preis)?[^\d]{0,18}(\d[\d.,]*)\s*(?:€|eur)?(?:\s*(?:\/|pro)\s*l(?:iter)?)?/
    ) ??
    captureNumber(
      value,
      /(\d[\d.,]*)\s*(?:€|euro|eur)\s*(?:\/|pro)\s*l(?:iter)?\b/
    );
  if (distanceKm !== undefined) result.distanceKm = distanceKm;
  if (manualFuelPricePerLiter !== undefined) {
    result.fuelPriceMode = "manual";
    result.manualFuelPricePerLiter = manualFuelPricePerLiter;
  } else if (/\b(?:livepreis|aktueller kraftstoffpreis|tankerkonig)\b/.test(value)) {
    result.fuelPriceMode = "live";
  }
  return result;
}

export function matchJarvisVehicleOption<T extends { id: string; label: string }>(
  question: string,
  options: readonly T[]
) {
  const value = normalized(question);
  const matches = options.filter((option) => {
    const label = normalized(option.label);
    const tokens = label
      .split(" ")
      .filter((token) => token.length >= 3 && !/^\d+(?:[.,]\d+)?$/.test(token));
    return label.length >= 3 && value.includes(label)
      ? true
      : tokens.some((token) => value.includes(token));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function looksLikeGenericJarvisCalculatorStart(question: string) {
  const value = normalized(question);
  return (
    /\b(?:kalkulation|kalkulationsrechner|rechner)\b/.test(value) &&
    /\b(?:start|starte|offne|welche|auswahl|mit jarvis)\w*\b/.test(value) &&
    !/\b(?:winterdienst|fahrt|fahrzeug|kilometer|vermiet|mietfahrzeug)\w*\b/.test(
      value
    )
  );
}

export function looksLikeJarvisCalculatorRequest(question: string) {
  const value = normalized(question);
  const hasCalculationLanguage =
    /\b(?:kalkulier|berechn|rechn|kalkulation|rechner|kostet|kosten)\w*\b/.test(
      value
    );
  const hasReleasedCalculator =
    /\b(?:winterdienst|fahrt|fahrten|fahrtkosten|fahrzeugkosten|kilometerkosten)\w*\b/.test(
      value
    );
  const hasRentalCalculator =
    /\b(?:vermiet|mietfahrzeug|mietpreis|fahrzeugmiete)\w*\b/.test(value);
  return (
    looksLikeGenericJarvisCalculatorStart(question) ||
    (hasCalculationLanguage &&
      (hasReleasedCalculator || hasRentalCalculator))
  );
}
