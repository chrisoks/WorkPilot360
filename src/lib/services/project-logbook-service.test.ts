import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  createProjectLogbookEntry,
} from "@/lib/services/project-logbook-service";

function transaction(options: { status?: string; secondRole?: Role } = {}) {
  const actors = [
    {
      id: "employee",
      role: Role.MITARBEITER,
      firstName: "Mara",
      lastName: "Muster",
      email: "mara@example.test",
    },
    ...(options.secondRole
      ? [
          {
            id: "session",
            role: options.secondRole,
            firstName: "Sina",
            lastName: "Sitzung",
            email: "sina@example.test",
          },
        ]
      : []),
  ];
  return {
    user: {
      findMany: vi.fn().mockResolvedValue(actors),
    },
    workPilotProject: {
      findFirst: vi.fn().mockResolvedValue({
        id: "project-1",
        status: options.status ?? "Umsetzung",
        projectNumber: "GLR-449",
        title: "Glasreinigung",
      }),
    },
    projectLogbookEntry: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          createdAt: data.createdAt ?? new Date(),
          updatedAt: new Date(),
        })
      ),
    },
  };
}

describe("project logbook service", () => {
  it("creates a text-only entry through the shared tenant-bound service", async () => {
    const tx = transaction();
    const result = await createProjectLogbookEntry(tx as never, {
      organizationId: "org-1",
      projectId: "project-1",
      authority: [{ id: "employee", role: Role.MITARBEITER }],
      authorUserId: "employee",
      title: "Baustellenstand",
      body: "Fenster im Erdgeschoss abgeschlossen.",
      source: "manual",
    });
    expect(result.project.label).toContain("GLR-449");
    expect(tx.projectLogbookEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        projectId: "project-1",
        authorUserId: "employee",
        attachments: [],
      }),
    });
  });

  it("requires every bound identity to retain logbook permission", async () => {
    const tx = transaction({ secondRole: Role.GAST });
    await expect(
      createProjectLogbookEntry(tx as never, {
        organizationId: "org-1",
        projectId: "project-1",
        authority: [
          { id: "session", role: Role.GAST },
          { id: "employee", role: Role.MITARBEITER },
        ],
        authorUserId: "employee",
        title: "Hinweis",
        body: "Nur ein Test.",
      })
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(tx.projectLogbookEntry.create).not.toHaveBeenCalled();
  });

  it("blocks archived projects for ordinary employees", async () => {
    const tx = transaction({ status: "Archiviert" });
    await expect(
      createProjectLogbookEntry(tx as never, {
        organizationId: "org-1",
        projectId: "project-1",
        authority: [{ id: "employee", role: Role.MITARBEITER }],
        authorUserId: "employee",
        title: "Hinweis",
        body: "Darf nicht geschrieben werden.",
      })
    ).rejects.toMatchObject({
      code: "project_archived",
    });
  });
});
