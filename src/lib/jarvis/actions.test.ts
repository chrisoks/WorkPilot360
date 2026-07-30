import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  getJarvisActionCatalog,
  getJarvisActionDecision,
  JARVIS_ACTIONS,
} from "@/lib/jarvis/actions";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

describe("JARVIS action registry", () => {
  it("uses unique action identifiers", () => {
    expect(new Set(JARVIS_ACTIONS.map((action) => action.id)).size).toBe(JARVIS_ACTIONS.length);
  });

  it("marks critical actions as requiring critical confirmation", () => {
    const criticalActions = JARVIS_ACTIONS.filter((action) => action.risk === "critical");
    expect(criticalActions.length).toBeGreaterThan(0);
    expect(criticalActions.every((action) => action.confirmation === "critical")).toBe(true);
  });

  it("does not make planned actions executable", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("invoice.finalize", profile);

    expect(decision.permitted).toBe(true);
    expect(decision.executable).toBe(false);
    expect(decision.reason).toBe("not_implemented");
    expect(decision.requiresConfirmation).toBe(true);
  });

  it("makes only the safe navigation action executable", () => {
    const profile = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
    });
    const navigation = getJarvisActionDecision("navigation.open", profile);
    const availableActions = getJarvisActionCatalog(profile).filter((entry) => entry.executable);

    expect(navigation.permitted).toBe(true);
    expect(navigation.executable).toBe(true);
    expect(navigation.reason).toBe("allowed");
    expect(navigation.requiresConfirmation).toBe(false);
    expect(availableActions.map((entry) => entry.action?.id)).toEqual([
      "navigation.open",
      "project.read",
      "task.read",
    ]);
  });

  it("prevents privilege escalation through impersonation", () => {
    const profile = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER }
    );
    const decision = getJarvisActionDecision("invoice.finalize", profile);

    expect(decision.permitted).toBe(false);
    expect(decision.executable).toBe(false);
  });

  it("limits the organization-wide service-rate analysis to financial roles", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.BUCHHALTUNG,
    ]) {
      const decision = getJarvisActionDecision(
        "management.service-rate-analysis.read",
        createJarvisAccessProfile({ id: role, role })
      );
      expect(decision.executable).toBe(true);
    }

    const employeeDecision = getJarvisActionDecision(
      "management.service-rate-analysis.read",
      createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      })
    );
    expect(employeeDecision.executable).toBe(false);
  });

  it("limits the organization-wide material analysis to financial roles", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.BUCHHALTUNG,
    ]) {
      const decision = getJarvisActionDecision(
        "management.material-analysis.read",
        createJarvisAccessProfile({ id: role, role })
      );
      expect(decision.executable).toBe(true);
    }

    const employeeDecision = getJarvisActionDecision(
      "management.material-analysis.read",
      createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      })
    );
    expect(employeeDecision.executable).toBe(false);
  });

  it("limits online request reads to existing sales-pipeline roles", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.VERTRIEB,
    ]) {
      expect(
        getJarvisActionDecision(
          "online-request.read",
          createJarvisAccessProfile({ id: role, role })
        ).executable
      ).toBe(true);
    }

    for (const role of [Role.MITARBEITER, Role.BUCHHALTUNG, Role.GAST]) {
      expect(
        getJarvisActionDecision(
          "online-request.read",
          createJarvisAccessProfile({ id: role, role })
        ).executable
      ).toBe(false);
    }
  });

  it("gives employees only their permitted foundation catalog", () => {
    const profile = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
    });
    const catalog = getJarvisActionCatalog(profile);

    expect(catalog.find((entry) => entry.action?.id === "task.prepare")?.permitted).toBe(true);
    expect(catalog.find((entry) => entry.action?.id === "invoice.finalize")?.permitted).toBe(false);
    expect(catalog.find((entry) => entry.action?.id === "payroll.manage")?.permitted).toBe(false);
  });
});
