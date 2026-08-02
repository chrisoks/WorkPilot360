import { describe, expect, it } from "vitest";
import {
  getOnlineRequestConversionConfirmationText,
  matchesOnlineRequestConversionConfirmation,
} from "@/lib/online-requests/conversion-service";

describe("online request conversion service confirmation", () => {
  it("builds one exact reference-bound critical phrase", () => {
    expect(
      getOnlineRequestConversionConfirmationText("oki-20260802-a1b2c3")
    ).toBe("ONLINE-ANFRAGE UMWANDELN OKI-20260802-A1B2C3");
  });

  it("accepts only the exact phrase after outer whitespace trimming", () => {
    const reference = "OKI-20260802-A1B2C3";
    expect(
      matchesOnlineRequestConversionConfirmation(
        reference,
        " ONLINE-ANFRAGE UMWANDELN OKI-20260802-A1B2C3 "
      )
    ).toBe(true);
    expect(
      matchesOnlineRequestConversionConfirmation(
        reference,
        "Online-Anfrage umwandeln OKI-20260802-A1B2C3"
      )
    ).toBe(false);
    expect(
      matchesOnlineRequestConversionConfirmation(
        reference,
        "ONLINE-ANFRAGE UMWANDELN OKI-20260802-FFFFFF"
      )
    ).toBe(false);
  });
});
