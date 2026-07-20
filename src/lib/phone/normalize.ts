import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type PhoneNormalizationResult =
  | { kind: "empty"; input: string; normalized: null }
  | { kind: "valid"; input: string; normalized: string; country: CountryCode | null }
  | { kind: "invalid"; input: string; normalized: null; reason: string };

const INTERNATIONAL_PREFIX_PATTERN = /^(?:\+|00)/;

export function normalizePhoneNumber(
  value: unknown,
  options: { defaultCountry?: CountryCode } = { defaultCountry: "DE" }
): PhoneNormalizationResult {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input) return { kind: "empty", input, normalized: null };

  const compact = input.replace(/\s+/g, "");
  const international = INTERNATIONAL_PREFIX_PATTERN.test(compact);
  if (!international && !compact.startsWith("0")) {
    return {
      kind: "invalid",
      input,
      normalized: null,
      reason: "Die Rufnummer ist ohne internationale Vorwahl oder nationale 0 nicht eindeutig.",
    };
  }
  const prepared = compact.startsWith("00") ? `+${compact.slice(2)}` : input;

  try {
    const parsed = international
      ? parsePhoneNumberFromString(prepared)
      : parsePhoneNumberFromString(prepared, options.defaultCountry);

    if (!parsed || !parsed.isValid()) {
      return {
        kind: "invalid",
        input,
        normalized: null,
        reason: "Die Rufnummer ist nicht eindeutig als gueltige Telefonnummer erkennbar.",
      };
    }

    return {
      kind: "valid",
      input,
      normalized: parsed.number,
      country: parsed.country ?? null,
    };
  } catch {
    return {
      kind: "invalid",
      input,
      normalized: null,
      reason: "Die Rufnummer konnte nicht sicher normalisiert werden.",
    };
  }
}

export function normalizeOptionalPhoneOrThrow(value: unknown, label: string) {
  const result = normalizePhoneNumber(value);
  if (result.kind === "invalid") {
    throw new Error(`${label}: ${result.reason}`);
  }
  return result.normalized;
}
