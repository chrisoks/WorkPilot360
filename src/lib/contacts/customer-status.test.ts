import { describe, expect, it } from "vitest";
import {
  deriveCustomerStatus,
  getCustomerStatusAuditText,
  getEffectiveCustomerStatus,
  normalizeCustomerStatusOverride,
} from "./customer-status";

describe("customer status", () => {
  it("classifies by financially active invoice count", () => {
    expect(deriveCustomerStatus(0)).toBe("prospect");
    expect(deriveCustomerStatus(1)).toBe("new");
    expect(deriveCustomerStatus(2)).toBe("existing");
    expect(deriveCustomerStatus(12)).toBe("existing");
  });

  it("accepts only supported manual overrides", () => {
    expect(normalizeCustomerStatusOverride("new")).toBe("new");
    expect(normalizeCustomerStatusOverride("existing")).toBe("existing");
    expect(normalizeCustomerStatusOverride("unexpected")).toBe("automatic");
  });

  it("keeps the system status unless a manual override is active", () => {
    expect(getEffectiveCustomerStatus("new", "automatic")).toBe("new");
    expect(getEffectiveCustomerStatus("new", "existing")).toBe("existing");
  });

  it("does not create an audit entry when the manual decision is unchanged", () => {
    expect(
      getCustomerStatusAuditText({
        previousOverride: "new",
        previousReason: "Erstauftrag",
        nextOverride: "new",
        nextReason: "Erstauftrag",
      })
    ).toBe("");
  });

  it("describes manual classification and a return to automatic calculation", () => {
    expect(
      getCustomerStatusAuditText({
        previousOverride: "automatic",
        previousReason: "",
        nextOverride: "existing",
        nextReason: "Bestandskunde aus Altsystem",
      })
    ).toContain("manuell auf „Bestandskunde“ gesetzt");

    expect(
      getCustomerStatusAuditText({
        previousOverride: "existing",
        previousReason: "Bestandskunde aus Altsystem",
        nextOverride: "automatic",
        nextReason: "",
      })
    ).toContain("wieder automatisch");
  });
});
