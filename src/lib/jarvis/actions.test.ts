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

  it("releases invoice cancellation only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("invoice.cancel", profile);

    expect(decision.permitted).toBe(true);
    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
      action: {
        risk: "critical",
        confirmation: "critical",
      },
    });
  });

  it("releases invoice credits only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "accounting",
      role: Role.BUCHHALTUNG,
    });
    const decision = getJarvisActionDecision("invoice.credit", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("releases invoice finalization only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("invoice.finalize", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("releases offer finalization only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("offer.finalize", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("releases offer decisions only as a critically confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("offer.manage", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
      action: {
        risk: "critical",
        confirmation: "critical",
      },
    });
  });

  it("releases offer deletion and restoration only as a critically confirmed action", () => {
    const profile = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
    const decision = getJarvisActionDecision("offer.delete", profile);
    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
      action: { risk: "critical", confirmation: "critical" },
    });
  });

  it("releases task archiving and restoration only to delete-authorized leadership", () => {
    const leadership = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
    const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });
    expect(getJarvisActionDecision("task.delete", leadership)).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
      action: { risk: "critical", confirmation: "critical" },
    });
    expect(getJarvisActionDecision("task.delete", employee)).toMatchObject({
      permitted: false,
      executable: false,
      reason: "role",
    });
  });

  it("releases project status changes only as a critical, role-bound action", () => {
    const leadership = createJarvisAccessProfile({ id: "leader", role: Role.FUEHRUNGSKRAFT });
    const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });

    expect(getJarvisActionDecision("project.status.change", leadership)).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
      action: { risk: "critical", confirmation: "critical", implementation: "available" },
    });
    expect(getJarvisActionDecision("project.status.change", employee)).toMatchObject({
      permitted: false,
      executable: false,
      reason: "data_class",
    });
  });

  it("releases invoice delivery only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const decision = getJarvisActionDecision("document.send", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("releases the paid status only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "accounting",
      role: Role.BUCHHALTUNG,
    });
    const decision = getJarvisActionDecision("invoice.mark-paid", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("releases reminder creation only as a critical confirmed action", () => {
    const profile = createJarvisAccessProfile({
      id: "accounting",
      role: Role.BUCHHALTUNG,
    });
    const decision = getJarvisActionDecision("invoice.remind", profile);

    expect(decision).toMatchObject({
      permitted: true,
      executable: true,
      reason: "allowed",
      requiresConfirmation: true,
    });
  });

  it("exposes the released, service-guarded action-center slices to employees", () => {
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
      "winter-calculation.prepare",
      "vehicle-trip-calculation.prepare",
      "task.prepare",
      "task.create",
      "task-comment.prepare",
      "task-comment.create",
      "planning.prepare",
      "planning.create",
      "project-logbook.prepare",
      "project-logbook.create",
      "time.prepare",
      "time.create",
    ]);
  });

  it("separates own manual time creation from managing another employee", () => {
    const employeeProfile = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
    });
    const leaderProfile = createJarvisAccessProfile({
      id: "leader",
      role: Role.FUEHRUNGSKRAFT,
    });

    expect(getJarvisActionDecision("time.prepare", employeeProfile)).toMatchObject({
      executable: true,
      reason: "allowed",
    });
    expect(getJarvisActionDecision("time.create", employeeProfile)).toMatchObject({
      executable: true,
      requiresConfirmation: true,
    });
    expect(getJarvisActionDecision("time.manage", employeeProfile)).toMatchObject({
      executable: false,
      reason: "role",
    });
    expect(getJarvisActionDecision("time.manage", leaderProfile)).toMatchObject({
      executable: true,
      requiresConfirmation: true,
    });
  });

  it("lets internal employees calculate winter service but keeps project persistence role-bound", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.BUCHHALTUNG,
      Role.VERTRIEB,
      Role.MITARBEITER,
    ]) {
      expect(
        getJarvisActionDecision(
          "winter-calculation.prepare",
          createJarvisAccessProfile({ id: role, role })
        ).executable
      ).toBe(true);
    }

    expect(
      getJarvisActionDecision(
        "winter-calculation.prepare",
        createJarvisAccessProfile({ id: "guest", role: Role.GAST })
      ).executable
    ).toBe(false);
    expect(
      getJarvisActionDecision(
        "winter-calculation.save",
        createJarvisAccessProfile({
          id: "employee",
          role: Role.MITARBEITER,
        })
      ).executable
    ).toBe(false);
    expect(
      getJarvisActionDecision(
        "winter-calculation.save",
        createJarvisAccessProfile({
          id: "executive",
          role: Role.GESCHAEFTSFUEHRER,
        })
      ).executable
    ).toBe(true);
  });

  it("lets internal employees calculate vehicle trips but keeps persistence role-bound", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.BUCHHALTUNG,
      Role.VERTRIEB,
      Role.MITARBEITER,
    ]) {
      expect(
        getJarvisActionDecision(
          "vehicle-trip-calculation.prepare",
          createJarvisAccessProfile({ id: role, role })
        ).executable
      ).toBe(true);
    }
    expect(
      getJarvisActionDecision(
        "vehicle-trip-calculation.prepare",
        createJarvisAccessProfile({ id: "guest", role: Role.GAST })
      ).executable
    ).toBe(false);
    expect(
      getJarvisActionDecision(
        "vehicle-trip-calculation.save",
        createJarvisAccessProfile({
          id: "employee",
          role: Role.MITARBEITER,
        })
      ).executable
    ).toBe(false);
    expect(
      getJarvisActionDecision(
        "vehicle-trip-calculation.save",
        createJarvisAccessProfile({
          id: "executive",
          role: Role.GESCHAEFTSFUEHRER,
        })
      ).executable
    ).toBe(true);
  });

  it("keeps offer preparation and draft creation on the existing offer roles", () => {
    for (const role of [
      Role.ADMIN,
      Role.GESCHAEFTSFUEHRER,
      Role.FUEHRUNGSKRAFT,
      Role.VERTRIEB,
    ]) {
      const profile = createJarvisAccessProfile({ id: role, role });
      expect(getJarvisActionDecision("offer.prepare", profile)).toMatchObject({
        executable: true,
        reason: "allowed",
      });
      expect(
        getJarvisActionDecision("offer.draft.create", profile)
      ).toMatchObject({
        executable: true,
        requiresConfirmation: true,
      });
    }
    for (const role of [Role.MITARBEITER, Role.BUCHHALTUNG, Role.GAST]) {
      expect(
        getJarvisActionDecision(
          "offer.draft.create",
          createJarvisAccessProfile({ id: role, role })
        )
      ).toMatchObject({ permitted: false, executable: false });
    }
    expect(
      getJarvisActionDecision(
        "offer.draft.create",
        createJarvisAccessProfile(
          { id: "gf", role: Role.GESCHAEFTSFUEHRER },
          { id: "employee", role: Role.MITARBEITER }
        )
      )
    ).toMatchObject({ permitted: false, executable: false });
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
