import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const fake = vi.hoisted(() => {
  const drafts = new Map<string, Record<string, any>>();
  const audits: Array<Record<string, any>> = [];
  const users = [
    {
      id: "user-1",
      organizationId: "org-1",
      isActive: true,
      role: "GESCHAEFTSFUEHRER",
      firstName: "Jarvis",
      lastName: "Tester",
      email: "jarvis@example.test",
    },
    {
      id: "user-2",
      organizationId: "org-1",
      isActive: true,
      role: "MITARBEITER",
      firstName: "Zweite",
      lastName: "Person",
      email: "zweite@example.test",
    },
  ];
  let projectUpdatedAt = new Date("2026-07-29T18:00:00.000Z");

  const matches = (
    row: Record<string, any>,
    where: Record<string, any> | undefined
  ) =>
    Object.entries(where ?? {}).every(([key, expected]) => row[key] === expected);

  const draftClient = {
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = {
        ...data,
        confirmedAt: data.confirmedAt ?? null,
        cancelledAt: data.cancelledAt ?? null,
        executedAt: data.executedAt ?? null,
        resultEntityType: data.resultEntityType ?? null,
        resultEntityId: data.resultEntityId ?? null,
        lastErrorCode: data.lastErrorCode ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      drafts.set(row.id, row);
      return row;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      drafts.get(where.id) ?? null
    ),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = drafts.get(where.id);
      if (!row) throw new Error("not found");
      return row;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: Record<string, any>;
      }) => {
        const row = drafts.get(where.id);
        if (!row || !matches(row, where)) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      }
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, any>;
      }) => {
        const row = drafts.get(where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }
    ),
  };

  const auditClient = {
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { draftId: string };
      }) => {
        const rows = audits.filter((entry) => entry.draftId === where.draftId);
        const last = rows.at(-1);
        return last ? { sequence: last.sequence } : null;
      }
    ),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      audits.push(data);
      return data;
    }),
  };

  const prisma = {
    jarvisActionDraft: draftClient,
    jarvisActionDraftAuditEvent: auditClient,
    user: {
      findMany: vi.fn(async ({ where }: { where: Record<string, any> }) =>
        users.filter(
          (user) =>
            user.organizationId === where.organizationId &&
            user.isActive === where.isActive &&
            (!where.id || user.id === where.id)
        )
      ),
    },
    workPilotProject: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, any> }) =>
          where.id === "project-1" && where.organizationId === "org-1"
            ? {
                id: "project-1",
                projectNumber: "MKG-209",
                title: "Marketing",
                updatedAt: projectUpdatedAt,
              }
            : null
      ),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) =>
      callback(prisma)
    ),
  };

  return {
    drafts,
    audits,
    users,
    prisma,
    createJarvisConfirmedTask: vi.fn(),
    reset() {
      drafts.clear();
      audits.length = 0;
      projectUpdatedAt = new Date("2026-07-29T18:00:00.000Z");
    },
    changeProject() {
      projectUpdatedAt = new Date("2026-07-29T19:00:00.000Z");
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: fake.prisma }));
vi.mock("@/lib/services/task-service", () => ({
  createJarvisConfirmedTask: fake.createJarvisConfirmedTask,
}));

import {
  cancelJarvisTaskDraft,
  completeJarvisTaskDraft,
  confirmJarvisTaskDraft,
  createPersistedJarvisTaskDraft,
  getJarvisTaskDraft,
  JarvisActionDraftError,
} from "@/lib/jarvis/action-draft-store";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

const baseNow = new Date("2026-07-29T20:00:00.000Z");
const dueAt = "2026-07-31T08:00:00.000Z";

function profile(
  role: Role = Role.GESCHAEFTSFUEHRER,
  effectiveId = "user-1"
): JarvisAccessProfile {
  return {
    sessionActor: { id: "user-1", role },
    effectiveActor: { id: effectiveId, role },
    isImpersonating: effectiveId !== "user-1",
  };
}

function binding(overrides: Partial<Record<"organizationId" | "sessionId", string>> = {}) {
  return {
    organizationId: overrides.organizationId ?? "org-1",
    sessionId: overrides.sessionId ?? "session-1",
    profile: profile(),
  };
}

async function createDraft(now = baseNow) {
  return createPersistedJarvisTaskDraft({
    ...binding(),
    now,
    preview: {
      version: 1,
      previewId: "preview-1",
      actionId: "task.prepare",
      actionTitle: "Aufgabe vorbereiten",
      state: "awaiting_confirmation",
      organizationId: "org-1",
      sessionActorId: "user-1",
      effectiveActorId: "user-1",
      impersonating: false,
      payload: {
        title: "Kunden wegen Angebot anrufen",
        projectId: "project-1",
      },
      execution: { enabled: false, reason: "preview_only" },
      audit: [],
    },
    context: { recordType: "project", recordId: "project-1" },
  });
}

async function completeDraft() {
  return completeJarvisTaskDraft(
    "preview-1",
    binding(),
    {
      revision: 1,
      description: "Angebot abstimmen",
      assigneeId: "user-1",
      dueAt,
    },
    baseNow
  );
}

describe("persistent JARVIS task drafts", () => {
  beforeEach(() => {
    fake.reset();
    vi.clearAllMocks();
    process.env.WORKPILOT_SESSION_SECRET =
      "jarvis-test-integrity-secret-with-more-than-32-characters";
    fake.createJarvisConfirmedTask.mockResolvedValue({
      id: "task-1",
      title: "Kunden wegen Angebot anrufen",
      ownerId: "user-1",
      ownerName: "Jarvis Tester",
      deadline: dueAt,
      projectId: "project-1",
    });
  });

  it("persists an expiring, minimized and audited draft", async () => {
    const view = await createDraft();

    expect(view).toMatchObject({
      version: 2,
      previewId: "preview-1",
      state: "awaiting_input",
      missingFields: ["Verantwortliche Person", "Fälligkeit"],
      confirmation: { enabled: false, reason: "missing_fields" },
    });
    expect(view.expiresAt).toBe("2026-07-29T20:15:00.000Z");
    expect(JSON.stringify(view)).not.toContain("org-1");
    expect(JSON.stringify(view)).not.toContain("session-1");
    expect(fake.audits.map((entry) => entry.eventType)).toEqual([
      "draft_created",
    ]);
  });

  it.each([
    ["organization", { organizationId: "org-2" }, "scope_mismatch"],
    ["session", { sessionId: "session-2" }, "scope_mismatch"],
  ])("rejects a foreign %s binding", async (_label, overrides, code) => {
    await createDraft();
    await expect(
      getJarvisTaskDraft("preview-1", {
        ...binding(overrides),
      })
    ).rejects.toMatchObject({ code });
  });

  it("rejects role changes and payload tampering", async () => {
    await createDraft();
    await expect(
      getJarvisTaskDraft("preview-1", {
        ...binding(),
        profile: profile(Role.ADMIN),
      })
    ).rejects.toMatchObject({ code: "role_changed" });

    fake.drafts.get("preview-1")!.payload = {
      title: "Manipulierte Aufgabe",
      projectId: "project-1",
    };
    await expect(
      getJarvisTaskDraft("preview-1", binding())
    ).rejects.toMatchObject({ code: "integrity_failed" });
  });

  it("validates assignee and due date before confirmation", async () => {
    await createDraft();
    await expect(
      completeJarvisTaskDraft(
        "preview-1",
        binding(),
        { revision: 1, assigneeId: "foreign-user", dueAt },
        baseNow
      )
    ).rejects.toMatchObject({ code: "assignee_forbidden" });
    await expect(
      completeJarvisTaskDraft(
        "preview-1",
        binding(),
        { revision: 1, assigneeId: "user-1", dueAt: baseNow.toISOString() },
        baseNow
      )
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("creates exactly one task and makes confirmation replay idempotent", async () => {
    await createDraft();
    const ready = await completeDraft();
    expect(ready).toMatchObject({
      state: "awaiting_confirmation",
      confirmation: { enabled: true, reason: "ready" },
      revision: 2,
    });

    const [first, second] = await Promise.all([
      confirmJarvisTaskDraft("preview-1", binding(), 2, baseNow),
      confirmJarvisTaskDraft("preview-1", binding(), 2, baseNow),
    ]);
    expect(first.state).toBe("executed");
    expect(second.state).toBe("executed");
    expect(first.result?.entityId).toBe("task-1");
    expect(fake.createJarvisConfirmedTask).toHaveBeenCalledTimes(1);

    const replay = await confirmJarvisTaskDraft(
      "preview-1",
      binding(),
      2,
      baseNow
    );
    expect(replay.result?.entityId).toBe("task-1");
    expect(fake.createJarvisConfirmedTask).toHaveBeenCalledTimes(1);
    expect(fake.audits.map((entry) => entry.eventType)).toEqual([
      "draft_created",
      "draft_completed",
      "draft_confirmed_and_executed",
    ]);
  });

  it("rejects stale visible revisions before changing or executing data", async () => {
    await createDraft();
    await completeDraft();

    await expect(
      completeJarvisTaskDraft(
        "preview-1",
        binding(),
        { revision: 1, assigneeId: "user-2", dueAt },
        baseNow
      )
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      confirmJarvisTaskDraft("preview-1", binding(), 1, baseNow)
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      cancelJarvisTaskDraft("preview-1", binding(), 1, baseNow)
    ).rejects.toMatchObject({ code: "conflict" });
    expect(fake.createJarvisConfirmedTask).not.toHaveBeenCalled();
  });

  it("makes cancellation idempotent and permanently prevents execution", async () => {
    await createDraft();
    const cancelled = await cancelJarvisTaskDraft(
      "preview-1",
      binding(),
      1,
      baseNow
    );
    const repeated = await cancelJarvisTaskDraft(
      "preview-1",
      binding(),
      1,
      baseNow
    );
    expect(cancelled.state).toBe("cancelled");
    expect(repeated.state).toBe("cancelled");
    await expect(
      confirmJarvisTaskDraft("preview-1", binding(), 1, baseNow)
    ).rejects.toBeInstanceOf(JarvisActionDraftError);
    expect(fake.createJarvisConfirmedTask).not.toHaveBeenCalled();
  });

  it("expires stale drafts and rejects later mutation", async () => {
    await createDraft();
    const afterTtl = new Date("2026-07-29T20:16:00.000Z");
    const expired = await getJarvisTaskDraft("preview-1", binding());
    expect(expired.state).toBe("awaiting_input");

    await expect(
      completeJarvisTaskDraft(
        "preview-1",
        binding(),
        { revision: 1, assigneeId: "user-1", dueAt },
        afterTtl
      )
    ).rejects.toMatchObject({ code: "expired" });
    expect(fake.drafts.get("preview-1")!.state).toBe("expired");
    expect(fake.createJarvisConfirmedTask).not.toHaveBeenCalled();
  });

  it("rejects confirmation when the linked project changed", async () => {
    await createDraft();
    await completeDraft();
    fake.changeProject();

    await expect(
      confirmJarvisTaskDraft("preview-1", binding(), 2, baseNow)
    ).rejects.toMatchObject({ code: "stale_context" });
    expect(fake.createJarvisConfirmedTask).not.toHaveBeenCalled();
  });
});
