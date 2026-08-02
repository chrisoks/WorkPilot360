import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  looksLikeProjectStatusAutomationStatusQuestion,
  resolveJarvisProjectStatusAutomationStatus,
  type ProjectStatusAutomationStatusSource,
} from "@/lib/jarvis/automation-status-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const users = [{ id: "gf", role: Role.GESCHAEFTSFUEHRER, isActive: true }] as never;

function source(overrides: Partial<Awaited<ReturnType<ProjectStatusAutomationStatusSource["load"]>>> = {}): ProjectStatusAutomationStatusSource {
  return {
    load: vi.fn().mockResolvedValue({
      organizationEnabled: true,
      rules: [
        { status: "Umsetzung", enabled: true, responsibleAfterDays: 14, managementAfterDays: 28 },
        { status: "Endkontrolle", enabled: false, responsibleAfterDays: 3, managementAfterDays: 7 },
      ],
      schedulerEnabled: true,
      schedulerRunning: true,
      schedulerLastAttemptAt: "2026-08-02T06:30:00.000Z",
      schedulerLastStatus: "ok",
      schedulerLastHttpStatus: 200,
      deliveryEnabled: true,
      monitoredProjects: 12,
      responsibleNotices: 2,
      managementNotices: 3,
      missingResponsible: 1,
      openDeliveryEvents: 4,
      latestDeliveryEventAt: "2026-08-02T06:15:00.000Z",
      ...overrides,
    }),
  };
}

const managementProfile = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });

describe("JARVIS project-status automation status", () => {
  it.each([
    "Läuft die Projektstatus-Automation wirklich?",
    "Wie ist der Status der Projektstatus-Frühwarnung?",
    "Warum kommen aus der Projektstatus-Automation keine Meldungen?",
    "Wann lief der Projektstatus-Scheduler zuletzt?",
  ])("recognizes a read-only diagnostic: %s", (question) => {
    expect(looksLikeProjectStatusAutomationStatusQuestion(question)).toBe(true);
  });

  it.each([
    "Aktiviere die Projektstatus-Frühwarnung.",
    "Deaktiviere die Projektstatus-Automation.",
    "Ändere die Projektstatus-Regel Umsetzung auf 10 Tage.",
    "Wie ist der Status von Projekt GLR-449?",
  ])("does not steal write or project intents: %s", (question) => {
    expect(looksLikeProjectStatusAutomationStatusQuestion(question)).toBe(false);
  });

  it("explains all three switches, rules and dry-run without mutation", async () => {
    const dataSource = source();
    const response = await resolveJarvisProjectStatusAutomationStatus({
      question: "Läuft die Projektstatus-Automation wirklich?",
      organizationId: "org-1",
      users,
      accessProfile: managementProfile,
      source: dataSource,
    });
    expect(dataSource.load).toHaveBeenCalledWith({ organizationId: "org-1", users });
    expect(response).toMatchObject({
      type: "answer",
      topicId: "automation.project-status.status",
      deterministic: true,
      navigation: { tab: "statusAutomation" },
    });
    const rendered = JSON.stringify(response);
    expect(rendered).toContain("vollständig betriebsbereit");
    expect(rendered).toContain("Organisationsschalter");
    expect(rendered).toContain("Scheduler-Kill-Switch");
    expect(rendered).toContain("Zustell-Kill-Switch");
    expect(rendered).toContain("2 Treffer auf Stufe verantwortliche Person");
    expect(rendered).toContain("3 Treffer auf Stufe Geschäftsführung");
    expect(rendered).toContain("Umsetzung: aktiv");
    expect(rendered).toContain("startet keinen Scheduler");
  });

  it("identifies a non-operational chain without hiding the dry-run", async () => {
    const response = await resolveJarvisProjectStatusAutomationStatus({
      question: "Warum kommen aus der Projektstatus-Automation keine Meldungen?",
      organizationId: "org-1",
      users,
      accessProfile: managementProfile,
      source: source({ schedulerEnabled: false, schedulerRunning: false, deliveryEnabled: false }),
    });
    expect(response?.message).toContain("nicht vollständig betriebsbereit");
    expect(response?.message).toContain("12 überwachte Projekte");
    expect(JSON.stringify(response)).toContain("Kill-Switch aus");
  });

  it("refuses leadership before loading organization-wide automation data", async () => {
    const dataSource = source();
    const response = await resolveJarvisProjectStatusAutomationStatus({
      question: "Läuft die Projektstatus-Automation wirklich?",
      organizationId: "org-1",
      users,
      accessProfile: createJarvisAccessProfile({ id: "lead", role: Role.FUEHRUNGSKRAFT }),
      source: dataSource,
    });
    expect(response?.type).toBe("refusal");
    expect(dataSource.load).not.toHaveBeenCalled();
  });
});
