import { describe, expect, it } from "vitest";
import {
  buildOnlineRequestServiceOptions,
  getOnlineRequestOptionRecommendations,
} from "./form-config";

describe("online request WorkPilot trade mapping", () => {
  it("keeps WorkPilot IDs while applying the public presentation", () => {
    const services = buildOnlineRequestServiceOptions([
      { id: "trade-glass", name: "Glasreinigung" },
      { id: "trade-pv", name: "Photovoltaikanlagenreinigung" },
      { id: "trade-custom", name: "Sonderreinigung" },
    ]);
    expect(services[0]).toMatchObject({
      id: "trade-glass",
      configId: "glass-cleaning",
      label: "Glasreinigung",
    });
    expect(services[2]).toMatchObject({
      id: "trade-custom",
      configId: "generic",
      label: "Sonderreinigung",
    });
  });

  it("recommends only services actually released by the portal", () => {
    const services = buildOnlineRequestServiceOptions([
      { id: "trade-glass", name: "Glasreinigung" },
      { id: "trade-facade", name: "Fassadenreinigung" },
      { id: "trade-winter", name: "Winterdienst" },
    ]);
    expect(
      getOnlineRequestOptionRecommendations("trade-glass", services).map(
        (service) => service.id
      )
    ).toEqual(["trade-facade"]);
  });
});
