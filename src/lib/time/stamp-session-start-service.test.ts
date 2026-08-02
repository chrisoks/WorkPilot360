import { describe, expect, it, vi } from "vitest";
import {
  evaluateStampSessionStart,
  executeStampSessionStart,
  getStampSessionStartConfirmationText,
  matchesStampSessionStartConfirmation,
} from "@/lib/time/stamp-session-start-service";

const NOW = new Date("2026-08-02T10:00:00.000Z");

function createdSession() {
  return {
    id: "stamp-new", organizationId: "org-1", userId: "user-1",
    employee: "Erika Muster", mode: "unproductive", projectId: "__unproductive__",
    projectLabel: "Büroorganisation", trade: null, planningEntryId: null,
    planningBillingGroupId: null, billingCatalogItemId: null,
    billingCatalogItemLabel: null, marketingContentItemId: null,
    marketingContentTitle: null, marketingContentType: null,
    comment: "Ablage bearbeiten", startedAt: NOW, accumulatedMs: BigInt(0),
    pauseStartedAt: null, pauseMs: BigInt(0), createdAt: NOW, updatedAt: NOW,
  };
}

describe("stamp-session-start-service", () => {
  it("evaluates a switch target as if the exactly bound current session were replaced", async () => {
    const current = { ...createdSession(), id: "stamp-current" };
    const db = {
      activeStampSession: { findUnique: vi.fn().mockResolvedValue(current) },
      workPilotProject: { findFirst: vi.fn() }, planningEntry: { findMany: vi.fn() }, catalogItem: { findFirst: vi.fn() },
    } as never;
    const replacement = await evaluateStampSessionStart({
      db, organizationId: "org-1", userId: "user-1", now: NOW,
      replaceActiveSessionId: "stamp-current",
      start: { mode: "unproductive", unproductiveLabel: "Besprechung intern", comment: "Teamrunde" },
    });
    expect(replacement.blockingIssues).toEqual([]);
    expect(replacement.existingSession).toBeNull();
    const wrongSession = await evaluateStampSessionStart({
      db, organizationId: "org-1", userId: "user-1", now: NOW,
      replaceActiveSessionId: "stamp-other",
      start: { mode: "unproductive", unproductiveLabel: "Besprechung intern", comment: "Teamrunde" },
    });
    expect(wrongSession.blockingIssues).toContain("Es läuft bereits eine persönliche Stempelung. Bitte zuerst pausieren, fortsetzen, wechseln oder stoppen.");
  });

  it("prepares a personal unproductive start and requires its exact phrase", async () => {
    const db = {
      activeStampSession: { findUnique: vi.fn().mockResolvedValue(null) },
      workPilotProject: { findFirst: vi.fn() },
      planningEntry: { findMany: vi.fn() },
      catalogItem: { findFirst: vi.fn() },
    } as never;
    const evaluation = await evaluateStampSessionStart({
      db, organizationId: "org-1", userId: "user-1", now: NOW,
      start: { mode: "unproductive", unproductiveLabel: "Büroorganisation", comment: "Ablage bearbeiten" },
    });
    expect(evaluation.blockingIssues).toEqual([]);
    expect(evaluation.effective).toMatchObject({ projectId: "__unproductive__", projectLabel: "Büroorganisation" });
    expect(getStampSessionStartConfirmationText(evaluation)).toBe("STEMPELUNG STARTEN UNPRODUKTIV");
    expect(matchesStampSessionStartConfirmation(evaluation, "STEMPELUNG STARTEN UNPRODUKTIV")).toBe(true);
    expect(matchesStampSessionStartConfirmation(evaluation, "Stempelung starten unproduktiv")).toBe(false);
  });

  it("blocks an hourly recurring project without billing context", async () => {
    const db = {
      activeStampSession: { findUnique: vi.fn().mockResolvedValue(null) },
      workPilotProject: { findFirst: vi.fn().mockResolvedValue({
        id: "project-1", organizationId: "org-1", projectNumber: "HAS-1",
        title: "Hausmeister", customer: "Kunde", status: "Umsetzung",
        projectKind: "Dauerläufer", recurringBillingMode: "hourly", trade: "Hausmeisterservice",
        updatedAt: NOW,
      }) },
      planningEntry: { findMany: vi.fn().mockResolvedValue([]) },
      catalogItem: { findFirst: vi.fn() },
    } as never;
    const evaluation = await evaluateStampSessionStart({
      db, organizationId: "org-1", userId: "user-1", now: NOW,
      start: { mode: "project", projectId: "project-1", comment: "Kontrolle" },
    });
    expect(evaluation.isHourlyRecurring).toBe(true);
    expect(evaluation.blockingIssues).toContain("Für diesen Stunden-Dauerläufer fehlt die Abrechnungsleistung.");
    expect(getStampSessionStartConfirmationText(evaluation)).toBe("STEMPELUNG STARTEN HAS-1");
  });

  it("starts exactly one unproductive session inside the supplied transaction", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      activeStampSession: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdSession()),
      },
      workPilotProject: { findFirst: vi.fn() },
      planningEntry: { findMany: vi.fn() },
      catalogItem: { findFirst: vi.fn() },
    } as never;
    const result = await executeStampSessionStart({
      db: tx, organizationId: "org-1", userId: "user-1", actorName: "Erika Muster",
      requestId: "draft-1", source: "jarvis", now: NOW,
      start: {
        mode: "unproductive",
        unproductiveLabel: "Büroorganisation",
        comment: "Ablage bearbeiten",
        marketingContentItemId: "content-1",
        marketingContentTitle: "Frühjahrsaktion",
        marketingContentType: "campaign",
      },
    });
    expect(result.session.id).toBe("stamp-new");
    expect(result.session.startedAt).toBe(NOW.toISOString());
    expect((tx as { activeStampSession: { create: ReturnType<typeof vi.fn> } }).activeStampSession.create).toHaveBeenCalledTimes(1);
    expect((tx as { activeStampSession: { create: ReturnType<typeof vi.fn> } }).activeStampSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        marketingContentItemId: "content-1",
        marketingContentTitle: "Frühjahrsaktion",
        marketingContentType: "campaign",
      }),
    }));
  });

  it("rejects a stale start before inserting", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      activeStampSession: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      workPilotProject: { findFirst: vi.fn() }, planningEntry: { findMany: vi.fn() },
      catalogItem: { findFirst: vi.fn() },
    } as never;
    await expect(executeStampSessionStart({
      db: tx, organizationId: "org-1", userId: "user-1", actorName: "Erika Muster",
      requestId: "draft-1", source: "jarvis", now: NOW, expectedFingerprint: "stale",
      start: { mode: "unproductive", unproductiveLabel: "Büroorganisation", comment: "Ablage bearbeiten" },
    })).rejects.toMatchObject({ code: "stale_context", status: 409 });
    expect((tx as { activeStampSession: { create: ReturnType<typeof vi.fn> } }).activeStampSession.create).not.toHaveBeenCalled();
  });
});
