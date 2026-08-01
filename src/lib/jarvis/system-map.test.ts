import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import {
  canAccessJarvisSystemArea,
  findJarvisAreaByContext,
  findJarvisSystemAreas,
  JARVIS_MAIN_NAVIGATION_AREA_IDS,
  JARVIS_REPORT_AREA_IDS,
  JARVIS_SYSTEM_AREAS,
} from "@/lib/jarvis/system-map";

describe("JARVIS system map", () => {
  const management = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
  const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });
  const bookkeeper = createJarvisAccessProfile({ id: "accounting", role: Role.BUCHHALTUNG });

  it("covers every active top-level navigation area", () => {
    expect(JARVIS_MAIN_NAVIGATION_AREA_IDS).toEqual([
      "overview",
      "reports",
      "onlineRequests",
      "contacts",
      "newsFeed",
      "salesHub",
      "projectsSolutions",
      "projectsImmocare",
      "articles",
      "calculators",
      "salesOpportunities",
      "dashboard",
      "planningBoard",
      "processAutomation",
      "accounting",
      "personalData",
      "employees",
      "settings",
    ]);
  });

  it("covers every currently selectable report", () => {
    expect(JARVIS_REPORT_AREA_IDS).toEqual([
      "reports.forecast",
      "reports.monthlyReport",
      "reports.employeeRevenue",
      "reports.sales",
      "reports.svs",
      "reports.projects",
      "reports.customers",
      "reports.kuzu",
      "reports.catalog",
      "reports.employees",
      "reports.executive",
      "reports.map",
    ]);
  });

  it("keeps every entry traceable and useful", () => {
    expect(JARVIS_SYSTEM_AREAS).toHaveLength(90);
    expect(new Set(JARVIS_SYSTEM_AREAS.map((item) => item.id)).size).toBe(JARVIS_SYSTEM_AREAS.length);
    JARVIS_SYSTEM_AREAS.forEach((item) => {
      expect(item.purpose.length).toBeGreaterThan(12);
      expect(item.workflows.length).toBeGreaterThan(0);
      expect(item.roles.length).toBeGreaterThan(0);
      expect(item.verification.sourceRefs.length).toBeGreaterThan(0);
      expect(item.verification.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("finds natural navigation terms", () => {
    const result = findJarvisSystemAreas("Wo finde ich die Zeiterfassung?", management);
    expect(result[0]?.area.id).toBe("employees.timeTracking");
  });

  it("maps the verified private object-storage service without pretending it is a public route", () => {
    const result = findJarvisSystemAreas("Wie funktioniert der HiDrive Objektspeicher?", management);
    expect(result[0]?.area).toMatchObject({
      id: "system.objectStorage",
      kind: "system_service",
      verification: { status: "verified", checkedAt: "2026-08-01" },
    });
    expect(result[0]?.area.target).toBeUndefined();
    expect(result[0]?.area.verification.sourceRefs).toContain("docs/STORAGE_ARCHITEKTUR.md");
  });

  it("maps the protected online-request inbox only for sales roles", () => {
    expect(
      findJarvisSystemAreas("Formularanfragen öffnen", management)[0]?.area.id
    ).toBe("onlineRequests");
    expect(
      findJarvisSystemAreas("Online-Anfragen öffnen", employee)
    ).toEqual([]);
  });

  it("resolves the current visible context", () => {
    const result = findJarvisAreaByContext("Projektakte", "Termine & Stempelungen", management);
    expect(result?.id).toBe("projectFile.appointments");
  });

  it("does not expose payroll areas to employees", () => {
    const payroll = JARVIS_SYSTEM_AREAS.find((item) => item.id === "employees.costRates");
    expect(payroll).toBeDefined();
    expect(canAccessJarvisSystemArea(payroll!, employee)).toBe(false);
    expect(findJarvisSystemAreas("Lohnkostensätze öffnen", employee)).toEqual([]);
  });

  it("uses the stricter scope while impersonating", () => {
    const impersonating = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER }
    );
    expect(findJarvisSystemAreas("Geschäftsführung öffnen", impersonating)).toEqual([]);
  });

  it("lets bookkeeping find its permitted finance reports", () => {
    expect(findJarvisSystemAreas("Monatsbericht öffnen", bookkeeper)[0]?.area.id).toBe(
      "reports.monthlyReport"
    );
    expect(findJarvisSystemAreas("Mitarbeiter-Auswertung öffnen", bookkeeper)).toEqual([]);
    expect(findJarvisSystemAreas("News-Feed öffnen", bookkeeper)).toEqual([]);
  });
});
