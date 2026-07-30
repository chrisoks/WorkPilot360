import { afterEach, describe, expect, it, vi } from "vitest";

describe("central vehicle fuel prices", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("fails closed to a transparent manual-price fallback when unconfigured", async () => {
    vi.stubEnv("TANKERKOENIG_API_KEY", "");
    const { loadVehicleFuelPrices } = await import(
      "@/lib/vehicle-fuel-prices"
    );
    const payload = await loadVehicleFuelPrices();
    expect(payload).toMatchObject({
      configured: false,
      status: "not_configured",
      prices: { diesel: null, e5: null, e10: null },
    });
    expect(payload.message).toContain("manuell");
  });

  it("loads only the configured HERM station and normalizes live prices", async () => {
    vi.stubEnv("TANKERKOENIG_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          stations: [
            {
              id: "other",
              name: "Andere",
              brand: "Andere",
              street: "Andere Straße",
              houseNumber: "1",
              postCode: "74722",
              place: "Buchen",
              diesel: 1,
              e5: 1,
              e10: 1,
              isOpen: true,
            },
            {
              id: "herm-1",
              name: "HERM",
              brand: "HERM",
              street: "In der vorderen Wanne",
              houseNumber: "11",
              postCode: 74722,
              place: "Buchen",
              diesel: 1.8,
              e5: 1.9,
              e10: 1.85,
              isOpen: true,
            },
          ],
        }),
      }))
    );
    const {
      loadVehicleFuelPrices,
      fuelPriceForVehicleType,
    } = await import("@/lib/vehicle-fuel-prices");
    const payload = await loadVehicleFuelPrices();

    expect(payload).toMatchObject({
      configured: true,
      status: "live",
      station: { id: "herm-1", name: "HERM" },
      prices: { diesel: 1.8, e5: 1.9, e10: 1.85 },
    });
    expect(fuelPriceForVehicleType("DIESEL", payload)).toBe(1.8);
    expect(fuelPriceForVehicleType("E5", payload)).toBe(1.9);
    expect(fuelPriceForVehicleType("E10", payload)).toBe(1.85);
    expect(fuelPriceForVehicleType("HYBRID", payload)).toBe(1.85);
    expect(fuelPriceForVehicleType("ELECTRIC", payload)).toBe(0);
    expect(fuelPriceForVehicleType("UNKNOWN", payload)).toBeNull();
  });
});
