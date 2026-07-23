import { describe, expect, it } from "vitest";
import {
  buildWinterServiceFrequencyAnalytics,
  classifyWinterServiceDeployment,
  getWinterServiceSeason,
} from "./analytics";

describe("winter service frequency analytics", () => {
  it("assigns October through April to one winter season", () => {
    expect(getWinterServiceSeason("2025-10-01")).toBe("2025/2026");
    expect(getWinterServiceSeason("2026-04-30")).toBe("2025/2026");
    expect(getWinterServiceSeason("2026-05-01")).toBeNull();
  });

  it("classifies only explicit spreading and plowing evidence", () => {
    expect(classifyWinterServiceDeployment(["OKI0402 | Winterdienst - Streuservice"])).toBe("spreading");
    expect(classifyWinterServiceDeployment(["Winterdienst – Streuen und Schieben"])).toBe(
      "spreadingAndPlowing"
    );
    expect(classifyWinterServiceDeployment(["OKI0400 | Pauschalpreis pro Einsatz"])).toBe(
      "unclassified"
    );
  });

  it("deduplicates employee entries by project and service date", () => {
    const result = buildWinterServiceFrequencyAnalytics([
      {
        projectId: "p1",
        customerId: "c1",
        customerName: "Kunde 1",
        date: "2025-11-10",
        typeHints: ["Streuservice"],
      },
      {
        projectId: "p1",
        customerId: "c1",
        customerName: "Kunde 1",
        date: "2025-11-10",
        typeHints: ["Streuservice"],
      },
    ]);

    expect(result.overall.deploymentCount).toBe(1);
    expect(result.overall.averageDeploymentsPerCustomerSeason).toBe(1);
    expect(result.overall.spreading.count).toBe(1);
  });

  it("calculates the overall average over customer seasons and keeps unknown types separate", () => {
    const result = buildWinterServiceFrequencyAnalytics([
      {
        projectId: "p1",
        customerId: "c1",
        customerName: "Kunde 1",
        date: "2025-11-10",
        typeHints: ["Streuservice"],
      },
      {
        projectId: "p1",
        customerId: "c1",
        customerName: "Kunde 1",
        date: "2026-01-15",
        typeHints: ["Streuen und Schieben"],
      },
      {
        projectId: "p2",
        customerId: "c2",
        customerName: "Kunde 2",
        date: "2025-12-02",
        typeHints: ["Pauschalpreis"],
      },
    ]);

    expect(result.overall).toMatchObject({
      deploymentCount: 3,
      customerCount: 2,
      customerSeasonCount: 2,
      averageDeploymentsPerCustomerSeason: 1.5,
      typedDeploymentCount: 2,
      unclassifiedDeploymentCount: 1,
      spreading: { count: 1, sharePercent: 50 },
      spreadingAndPlowing: { count: 1, sharePercent: 50 },
    });
    expect(result.customers.find((customer) => customer.customerId === "c1")).toMatchObject({
      deploymentCount: 2,
      averageDeploymentsPerSeason: 2,
    });
  });
});
