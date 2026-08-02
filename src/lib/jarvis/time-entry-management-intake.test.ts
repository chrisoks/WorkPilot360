import { describe, expect, it } from "vitest";
import {
  extractTimeEntryManagement,
  looksLikeTimeEntryManagementRequest,
} from "@/lib/jarvis/time-entry-management-intake";

describe("time-entry management intake", () => {
  it("recognizes changes and deletion without confusing help or stamping", () => {
    expect(looksLikeTimeEntryManagementRequest("Korrigiere den Zeiteintrag abcdef12 wegen falscher Uhrzeit. Beginn: 08:15 Ende: 10:00")).toBe(true);
    expect(looksLikeTimeEntryManagementRequest("Lösche Zeiteintrag abcdef12. Grund: doppelt erfasst")).toBe(true);
    expect(looksLikeTimeEntryManagementRequest("Wie korrigiere ich einen Zeiteintrag?")).toBe(false);
    expect(looksLikeTimeEntryManagementRequest("Beende meine Stempelung")).toBe(false);
  });

  it("extracts the bound id, reason and canonical changes", () => {
    expect(extractTimeEntryManagement("Korrigiere Zeiteintrags-ID abcdef12. Grund: Uhrzeit falsch Datum: 02.08.2026 Beginn: 08:15 Ende: 10:00 Pause: 15 Minuten Kommentar: Objekt geprüft")).toEqual({
      action: "update",
      entryId: "abcdef12",
      reason: "Uhrzeit falsch",
      changes: {
        date: "2026-08-02",
        startTime: "08:15",
        endTime: "10:00",
        pauseMs: 900_000,
        comment: "Objekt geprüft",
      },
    });
  });

  it("extracts deletion without accepting field changes", () => {
    expect(extractTimeEntryManagement("Lösche Zeiteintrag abcdef12 wegen doppelt erfasst")).toEqual({
      action: "delete",
      entryId: "abcdef12",
      reason: "doppelt erfasst",
    });
  });
});
