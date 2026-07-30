import { describe, expect, it } from "vitest";
import {
  buildOnlineRequestServiceOptions,
  getOnlineRequestOptionRecommendations,
  ONLINE_REQUEST_OTHER_SERVICE_ID,
  partitionOnlineRequestServiceOptions,
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
    expect(services.at(-1)).toMatchObject({
      id: ONLINE_REQUEST_OTHER_SERVICE_ID,
      configId: "other",
      label: "Sonstige / Andere Leistung",
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

  it("shows Grünpflege, Objektbetreuung and Hausmeisterservice first", () => {
    const services = buildOnlineRequestServiceOptions([
      { id: "trade-glass", name: "Glasreinigung" },
      { id: "trade-caretaker", name: "Hausmeisterservice" },
      { id: "trade-object", name: "Objektbetreuung" },
      { id: "trade-green", name: "Grünflächen- und Gartenpflege" },
    ]);
    const partitioned = partitionOnlineRequestServiceOptions(services);
    expect(partitioned.featured.map((service) => service.label)).toEqual([
      "Grünpflege",
      "Objektbetreuung",
      "Hausmeisterservice",
    ]);
    expect(partitioned.additional.map((service) => service.id)).toEqual([
      "trade-glass",
      ONLINE_REQUEST_OTHER_SERVICE_ID,
    ]);
  });
});
