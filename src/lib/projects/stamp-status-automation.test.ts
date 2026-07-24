import { describe, expect, it } from "vitest";
import {
  shouldApplyStampInterruptionTransition,
  shouldOfferStampImplementationTransition,
} from "./stamp-status-automation";

describe("shouldOfferStampImplementationTransition", () => {
  it.each(["Lead / Klärung", "Angebot", "Warten auf Kunde", "Zur Planung bereit", "Geplant"])(
    "allows a confirmed transition from %s",
    (status) => {
      expect(shouldOfferStampImplementationTransition(status)).toBe(true);
    }
  );

  it.each([
    "Umsetzung",
    "In Umsetzung",
    "Arbeit unterbrochen",
    "Abrechnungsprüfung",
    "Endkontrolle",
    "Zur Abrechnung bereit",
    "Abgeschlossen",
    "Archiviert",
  ])("does not overwrite the protected status %s", (status) => {
    expect(shouldOfferStampImplementationTransition(status)).toBe(false);
  });
});

describe("shouldApplyStampInterruptionTransition", () => {
  it.each(["Umsetzung", "Geplant", "Zur Planung bereit", "Abrechnungsprüfung"])(
    "allows an interruption transition from %s",
    (status) => {
      expect(shouldApplyStampInterruptionTransition(status)).toBe(true);
    }
  );

  it.each(["Abgeschlossen", "Archiviert"])("protects the final status %s", (status) => {
    expect(shouldApplyStampInterruptionTransition(status)).toBe(false);
  });
});
