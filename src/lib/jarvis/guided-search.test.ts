import { describe, expect, it, vi } from "vitest";
import { searchJarvisGuidedOptions } from "@/lib/jarvis/guided-search";

describe("JARVIS guided full-text search", () => {
  it("groups only open organization projects by customer", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "p1", projectNumber: "GLR-1", title: "Glas", customer: "Klaus Testmann", status: "Aktiv", trade: "Glasreinigung", projectType: "Einmalprojekt", projectKind: "Einmalig", projectRuntimeFrom: null, projectRuntimeUntil: null },
      { id: "p2", projectNumber: "OBJ-2", title: "Objekt", customer: "Klaus Testmann", status: "Offen", trade: "Objektbetreuung", projectType: "Dauerprojekt", projectKind: "Dauer", projectRuntimeFrom: "2026-01", projectRuntimeUntil: "2026-12" },
      { id: "p3", projectNumber: "ALT-3", title: "Alt", customer: "Alt GmbH", status: "Archiviert", trade: null, projectType: null, projectKind: null, projectRuntimeFrom: null, projectRuntimeUntil: null },
    ]);
    const results = await searchJarvisGuidedOptions({
      organizationId: "org-1",
      kind: "customer",
      query: "Klaus Testmann",
      db: { workPilotProject: { findMany } } as never,
    });

    expect(results).toEqual([{ kind: "customer", id: "Klaus Testmann", label: "Klaus Testmann", detail: "2 offene Projekte", projectCount: 2 }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", AND: expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
        expect.objectContaining({ OR: expect.any(Array) }),
      ]) }),
      take: 100,
    }));
  });

  it("returns compact project choices with recurring defaults", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "p2", projectNumber: "OKI-2", title: "Monatspflege", customer: "Klaus Testmann", status: "Aktiv", trade: "Grünpflege", projectType: "OK immocare", projectKind: "Dauerläufer", projectRuntimeFrom: "2026-02-01", projectRuntimeUntil: "2026-11-30" },
    ]);
    const results = await searchJarvisGuidedOptions({
      organizationId: "org-1",
      kind: "project",
      customer: "Klaus Testmann",
      query: "Grün",
      db: { workPilotProject: { findMany } } as never,
    });

    expect(results[0]).toMatchObject({
      kind: "project",
      id: "p2",
      defaultCompany: "OK immocare",
      defaultExecutionMonth: "2026-02",
      defaultExecutionEndMonth: "2026-11",
    });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: "org-1",
      customer: "Klaus Testmann",
    });
  });

  it("searches active catalog fields and returns everything needed for a line", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "c1", number: "OKI0305", name: "Objektbetreuung", description: "Monatliche Betreuung", type: "Leistung", unit: "Monat", salesPrice: 450, vatRate: 19 },
    ]);
    const results = await searchJarvisGuidedOptions({
      organizationId: "org-1",
      kind: "catalog",
      query: "Objekt",
      db: { catalogItem: { findMany } } as never,
    });

    expect(results[0]).toMatchObject({ kind: "catalog", id: "c1", unit: "Monat", salesPrice: 450, vatRate: 19 });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ organizationId: "org-1", isActive: true });
  });
});
