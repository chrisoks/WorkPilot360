import { describe, expect, it } from "vitest";
import { looksLikeContactManagementRequest } from "@/lib/jarvis/contact-management-intake";
import { looksLikeInvoiceDraftRequest } from "@/lib/jarvis/invoice-intake";
import { looksLikeOfferDraftRequest } from "@/lib/jarvis/offer-intake";
import { looksLikeProjectMasterDataChangeRequest } from "@/lib/jarvis/project-master-data-intake";
import { looksLikeTimeEntryManagementRequest } from "@/lib/jarvis/time-entry-management-intake";

describe("JARVIS current knowledge routing boundaries", () => {
  it.each([
    "Warum kann ich für einen Interessenten noch kein Projekt anlegen?",
    "Was gehört ins Sales-Journal?",
    "Warum muss ich einen Kundenhinweis vor der Projektanlage bestätigen?",
    "Was bewirkt halbjährlich als Fakturierungsintervall?",
  ])("does not mistake explanatory master-data questions for writes: %s", (question) => {
    expect(looksLikeContactManagementRequest(question)).toBe(false);
    expect(looksLikeProjectMasterDataChangeRequest(question)).toBe(false);
    expect(looksLikeOfferDraftRequest(question)).toBe(false);
  });

  it("does not mistake the manual-time explanation for a correction", () => {
    expect(
      looksLikeTimeEntryManagementRequest(
        "Was passiert mit einem manuellen Zeiteintrag beim Stunden-Dauerläufer?"
      )
    ).toBe(false);
  });

  it.each([
    "Wie berechnet sich der Forecast beim Stunden-Dauerläufer?",
    "Was ist der Kundentext je Leistungstag bei der Stundenabrechnung?",
  ])("does not mistake an hourly billing explanation for a new invoice: %s", (question) => {
    expect(looksLikeInvoiceDraftRequest(question)).toBe(false);
  });
});
