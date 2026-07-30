import { describe, expect, it } from "vitest";
import { parsePublicOnlineRequestInput } from "./validation";

const validInput = {
  sessionToken: "x".repeat(30),
  proof: "123",
  website: "",
  clientSubmissionId: "45f90179-83d8-47ef-a157-d9ab8ca045ea",
  requestType: "offer",
  tradeId: "trade-glass",
  recommendationTradeIds: ["trade-facade"],
  street: "Musterstraße 12",
  postalCode: "74722",
  city: "Buchen",
  description: "Bitte erstellen Sie uns ein Angebot für die Reinigung.",
  customerKind: "private",
  firstName: "Max",
  lastName: "Mustermann",
  email: "max@example.de",
  preferredContact: "email",
  consent: true,
};

describe("public online request validation", () => {
  it("accepts a complete request and trims text", () => {
    const result = parsePublicOnlineRequestInput({
      ...validInput,
      city: "  Buchen  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.city).toBe("Buchen");
  });

  it("requires a reachable contact and business company", () => {
    const result = parsePublicOnlineRequestInput({
      ...validInput,
      customerKind: "business",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate, excessive and self-referencing recommendations", () => {
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        recommendationTradeIds: ["trade-glass"],
      }).success
    ).toBe(false);
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        recommendationTradeIds: ["1", "2", "3", "4"],
      }).success
    ).toBe(false);
  });

  it("rejects unknown fields and missing consent", () => {
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        admin: true,
      }).success
    ).toBe(false);
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        consent: false,
      }).success
    ).toBe(false);
  });

  it("accepts only valid dates and request-type-specific detail fields", () => {
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        requestType: "execution",
        desiredDate: "2026-02-31",
        desiredTimeWindow: "morning",
      }).success
    ).toBe(false);
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        desiredDate: "2026-08-14",
      }).success
    ).toBe(false);
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        requestType: "callback",
        callbackTimeWindow: "afternoon",
      }).success
    ).toBe(true);
    expect(
      parsePublicOnlineRequestInput({
        ...validInput,
        requestType: "issue",
        urgency: "emergency",
      }).success
    ).toBe(false);
  });
});
