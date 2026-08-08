import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  ProjectTimeEntryServiceError,
  WITHOUT_OFFER_ASSIGNMENT,
  saveProjectTimeEntry,
} from "@/lib/time/project-time-entry-service";

const manager = {
  id: "manager-1",
  firstName: "Mara",
  lastName: "Leitung",
  email: "mara@example.test",
  role: Role.FUEHRUNGSKRAFT,
  isActive: true,
};

const employee = {
  id: "employee-1",
  firstName: "Emil",
  lastName: "Arbeit",
  email: "emil@example.test",
  role: Role.MITARBEITER,
  isActive: true,
  planningBreakWindows: {
    friday: { start: "12:00", end: "12:30" },
  },
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    organizationId: "org-1",
    mode: "project",
    projectId: "project-1",
    projectLabel: "Projekt Eins",
    trade: "Glasreinigung",
    planningEntryId: null,
    planningBillingGroupId: null,
    offerId: "offer-1",
    offerLabel: "ANG-1 · Angebot · Gewonnen",
    billingCatalogItemId: null,
    billingCatalogItemLabel: null,
    userId: "employee-1",
    employee: "Emil Arbeit",
    entrySource: "manual",
    date: "2026-07-31",
    startTime: "08:00",
    endTime: "10:00",
    durationMs: 6_300_000n,
    pauseMs: 900_000n,
    laborCostRateSnapshot: 0,
    laborCostSnapshot: 0,
    costSnapshotAt: new Date("2026-07-30T20:00:00.000Z"),
    comment: "Fenster gereinigt",
    invoiceId: null,
    invoiceNumber: null,
    invoicedAt: null,
    marketingContentItemId: null,
    marketingContentType: null,
    completionStatus: null,
    overtimeApprovalStatus: "not_required",
    overtimeApprovedByUserId: null,
    overtimeApprovedByName: null,
    overtimeApprovedAt: null,
    editHistory: [],
    deletedAt: null,
    createdAt: new Date("2026-07-30T20:00:00.000Z"),
    ...overrides,
  };
}

function database(options: {
  existing?: ReturnType<typeof row>;
  project?: {
    id: string;
    projectNumber: string;
    title: string;
    trade: string | null;
    projectKind: string | null;
    recurringBillingMode: string | null;
  } | null;
  offer?: Record<string, unknown> | null;
  item?: Record<string, unknown> | null;
  inserted?: ReturnType<typeof row>;
} = {}) {
  const inserted = options.inserted ?? row();
  const queryRaw = vi.fn(
    async (strings: TemplateStringsArray, ..._values: unknown[]) => {
      const sql = strings.join(" ");
      if (sql.includes('SELECT * FROM "ProjectTimeEntry"')) {
        return options.existing ? [options.existing] : [];
      }
      if (sql.includes('FROM "EmployeeCostCalculation"')) return [];
      if (sql.includes('INSERT INTO "ProjectTimeEntry"')) return [inserted];
      throw new Error(`Unerwartetes SQL im Test: ${sql}`);
    }
  );
  const db = {
    $queryRaw: queryRaw,
    workPilotProject: {
      findFirst: vi.fn(async () =>
        options.project === undefined
          ? {
              id: "project-1",
              projectNumber: "GLR-1",
              title: "Projekt Eins",
              trade: "Glasreinigung",
              projectKind: "einmaliges Projekt",
              recurringBillingMode: null,
            }
          : options.project
      ),
    },
    offer: {
      findFirst: vi.fn(async () =>
        options.offer === undefined
          ? {
              id: "offer-1",
              offerNumber: "ANG-1",
              offerType: "main",
              status: "Gewonnen",
            }
          : options.offer
      ),
    },
    catalogItem: {
      findFirst: vi.fn(async () => options.item ?? null),
    },
    projectLogbookEntry: {
      upsert: vi.fn(async () => ({})),
    },
  };
  return { db, queryRaw };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    mode: "project" as const,
    projectId: "project-1",
    userId: "employee-1",
    entrySource: "manual" as const,
    date: "2026-07-31",
    startTime: "08:00",
    endTime: "10:00",
    durationMs: 6_300_000,
    pauseMs: 900_000,
    comment: "Fenster gereinigt",
    offerId: "offer-1",
    overtimeApprovalStatus: "not_required" as const,
    ...overrides,
  };
}

describe("shared project time-entry service", () => {
  it("requires explicit confirmation when a manual entry omits the configured break", async () => {
    const { db } = database({
      inserted: row({
        date: "2026-07-31",
        startTime: "08:00",
        endTime: "16:00",
        durationMs: BigInt(8 * 3_600_000),
        pauseMs: BigInt(0),
      }),
    });
    const manualDay = payload({
      date: "2026-07-31",
      startTime: "08:00",
      endTime: "16:00",
      durationMs: 8 * 3_600_000,
      pauseMs: 0,
    });

    await expect(saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: manualDay,
    })).rejects.toMatchObject({
      code: "break_confirmation_required",
      message: expect.stringContaining("30 Minuten"),
    });

    const saved = await saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: { ...manualDay, confirmScheduledBreakShortfall: true },
    });
    expect(saved.durationMs).toBe(8 * 3_600_000);
  });

  it("derives the duration, reloads canonical project and offer data and writes a logbook entry", async () => {
    const { db, queryRaw } = database();
    const saved = await saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: payload(),
      createLogbookEntry: true,
    });

    expect(saved).toMatchObject({
      id: "entry-1",
      durationMs: 6_300_000,
      projectLabel: "Projekt Eins",
      offerId: "offer-1",
    });
    expect(db.workPilotProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "project-1", organizationId: "org-1" },
      })
    );
    expect(db.offer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "offer-1",
          organizationId: "org-1",
          projectId: "project-1",
        },
      })
    );
    expect(db.projectLogbookEntry.upsert).toHaveBeenCalledTimes(1);
    expect(
      queryRaw.mock.calls.some(([strings]) =>
        strings.join(" ").includes('INSERT INTO "ProjectTimeEntry"')
      )
    ).toBe(true);
  });

  it("preserves the normal API default that omitted entrySource means stamped", async () => {
    const { db } = database({
      inserted: row({
        entrySource: "stamped",
        offerId: null,
        offerLabel: null,
      }),
    });
    const saved = await saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: payload({ entrySource: undefined, offerId: "" }),
    });
    expect(saved.entrySource).toBe("stamped");
  });

  it("allows an employee only their own explicitly manual entry", async () => {
    const own = database({
      inserted: row({ userId: "employee-1", employee: "Emil Arbeit" }),
    });
    await expect(
      saveProjectTimeEntry({
        db: own.db as never,
        organizationId: "org-1",
        actor: employee,
        users: [manager, employee],
        payload: payload(),
      })
    ).resolves.toMatchObject({ userId: "employee-1" });

    const foreign = database();
    await expect(
      saveProjectTimeEntry({
        db: foreign.db as never,
        organizationId: "org-1",
        actor: employee,
        users: [manager, employee],
        payload: payload({ userId: "manager-1" }),
      })
    ).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });

  it("blocks cross-tenant execution IDs before any upsert can touch the foreign row", async () => {
    const { db, queryRaw } = database({
      existing: row({ organizationId: "org-2" }),
    });
    await expect(
      saveProjectTimeEntry({
        db: db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload(),
      })
    ).rejects.toMatchObject({
      code: "conflict",
      status: 409,
    });
    expect(db.workPilotProject.findFirst).not.toHaveBeenCalled();
    expect(
      queryRaw.mock.calls.some(([strings]) =>
        strings.join(" ").includes('INSERT INTO "ProjectTimeEntry"')
      )
    ).toBe(false);
  });

  it("requires a final offer or an explicit documented no-offer decision for one-time projects", async () => {
    const missing = database();
    await expect(
      saveProjectTimeEntry({
        db: missing.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({ offerId: "", comment: "" }),
      })
    ).rejects.toMatchObject({ code: "invalid_input", status: 400 });

    const documented = database({
      inserted: row({
        offerId: null,
        offerLabel: "Ohne Angebotszuweisung",
        comment: "Altauftrag ohne digitales Angebot",
      }),
    });
    await expect(
      saveProjectTimeEntry({
        db: documented.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({
          offerId: WITHOUT_OFFER_ASSIGNMENT,
          comment: "Altauftrag ohne digitales Angebot",
        }),
      })
    ).resolves.toMatchObject({
      offerId: "",
      offerLabel: "Ohne Angebotszuweisung",
    });
  });

  it("validates the hourly recurring trade and billing service server-side", async () => {
    const { db } = database({
      project: {
        id: "project-1",
        projectNumber: "GLR-1",
        title: "Dauerauftrag",
        trade: "Glasreinigung",
        projectKind: "Dauerläufer",
        recurringBillingMode: "hourly",
      },
      item: {
        id: "service-1",
        number: "GLR-STD",
        name: "Glasreinigung Stunde",
        type: "service",
        unit: "Std.",
        trade: "Grünpflege",
        salesPrice: 55,
        isActive: true,
        isLaborPosition: true,
      },
    });
    await expect(
      saveProjectTimeEntry({
        db: db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({
          offerId: "",
          trade: "Glasreinigung",
          billingCatalogItemId: "service-1",
        }),
      })
    ).rejects.toMatchObject({
      code: "invalid_input",
      status: 400,
    });
  });

  it("accepts a valid hourly service and a flat recurring entry without offer context", async () => {
    const hourly = database({
      project: {
        id: "project-1",
        projectNumber: "GLR-1",
        title: "Dauerauftrag",
        trade: "Glasreinigung",
        projectKind: "Dauerläufer",
        recurringBillingMode: "hourly",
      },
      item: {
        id: "service-1",
        number: "GLR-STD",
        name: "Glasreinigung Stunde",
        type: "service",
        unit: "Std.",
        trade: "Glasreinigung",
        salesPrice: 55,
        isActive: true,
        isLaborPosition: true,
      },
      inserted: row({
        trade: "Glasreinigung",
        offerId: null,
        offerLabel: null,
        billingCatalogItemId: "service-1",
        billingCatalogItemLabel: "GLR-STD | Glasreinigung Stunde",
      }),
    });
    await expect(
      saveProjectTimeEntry({
        db: hourly.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({
          offerId: "",
          trade: "Glasreinigung",
          billingCatalogItemId: "service-1",
        }),
      })
    ).resolves.toMatchObject({
      billingCatalogItemId: "service-1",
      trade: "Glasreinigung",
    });

    const flat = database({
      project: {
        id: "project-1",
        projectNumber: "OBJ-1",
        title: "Monatspauschale",
        trade: "Objektbetreuung",
        projectKind: "Dauerläufer",
        recurringBillingMode: "flat",
      },
      inserted: row({
        trade: "Objektbetreuung",
        offerId: null,
        offerLabel: null,
      }),
    });
    await expect(
      saveProjectTimeEntry({
        db: flat.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({ offerId: "" }),
      })
    ).resolves.toMatchObject({
      projectId: "project-1",
      offerId: "",
    });
  });

  it("rejects inconsistent durations and undocumented interruptions", async () => {
    const inconsistent = database();
    await expect(
      saveProjectTimeEntry({
        db: inconsistent.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({ durationMs: 7_200_000 }),
      })
    ).rejects.toBeInstanceOf(ProjectTimeEntryServiceError);

    const interrupted = database();
    await expect(
      saveProjectTimeEntry({
        db: interrupted.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        payload: payload({
          completionStatus: "interrupted",
          comment: "",
        }),
      })
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: expect.stringContaining("Unterbrechung"),
    });
  });

  it("returns an identical create-only result without issuing a second insert", async () => {
    const existing = row();
    const { db, queryRaw } = database({ existing });
    const saved = await saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: payload(),
      createOnly: true,
    });

    expect(saved.id).toBe("entry-1");
    expect(
      queryRaw.mock.calls.some(([strings]) =>
        strings.join(" ").includes('INSERT INTO "ProjectTimeEntry"')
      )
    ).toBe(false);
  });

  it("blocks direct updates that bypass the controlled correction service", async () => {
    const existing = row();
    const { db, queryRaw } = database({ existing });
    await expect(saveProjectTimeEntry({
      db: db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      payload: payload({ startTime: "08:15", durationMs: 5_400_000 }),
    })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("kontrollierten Korrekturweg"),
    });
    expect(queryRaw.mock.calls.some(([strings]) =>
      strings.join(" ").includes('INSERT INTO "ProjectTimeEntry"')
    )).toBe(false);
  });
});
