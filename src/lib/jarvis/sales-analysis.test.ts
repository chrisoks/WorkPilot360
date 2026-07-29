import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import {
  buildJarvisSalesAnalysisRecords,
  resolveJarvisSalesAnalysisIntent,
  resolveJarvisSalesAnalysisRequest,
  type JarvisSalesSignal,
} from "@/lib/jarvis/sales-analysis";

const NOW = new Date("2026-07-26T12:00:00.000Z");

function signal(
  kind: JarvisSalesSignal["kind"],
  overrides: Partial<JarvisSalesSignal> = {}
): JarvisSalesSignal {
  return {
    kind,
    sourceId: `${kind}-source`,
    projectId: `${kind}-project`,
    contactId: `${kind}-contact`,
    customerName: "Beispielkunde",
    projectNumber: "P-100",
    projectTitle: "Beispielprojekt",
    occurredAt: new Date("2026-07-20T10:00:00.000Z"),
    evidence: "Belastbare Testquelle.",
    ...overrides,
  };
}

describe("JARVIS sales analysis", () => {
  it("recognizes sales-analysis language but not normal system help", () => {
    expect(resolveJarvisSalesAnalysisIntent("Welche Kunden sollte ich nachfassen?")).toBe(true);
    expect(resolveJarvisSalesAnalysisIntent("Analysiere unsere Projekte auf Vertriebschancen.")).toBe(true);
    expect(resolveJarvisSalesAnalysisIntent("Welche Kunden oder Angebote soll ich heute aktiv angehen?")).toBe(true);
    expect(resolveJarvisSalesAnalysisIntent("Zeige Kunden mit ungenutztem Zusatzverkaufspotenzial.")).toBe(true);
    expect(resolveJarvisSalesAnalysisIntent("Wie lege ich einen Kunden an?")).toBe(false);
  });

  it("prioritizes recently viewed offers and removes duplicate source signals", () => {
    const records = buildJarvisSalesAnalysisRecords(
      [
        signal("completed_project"),
        signal("viewed_offer", {
          sourceId: "view-1",
          offerId: "offer-1",
          occurredAt: new Date("2026-07-25T10:00:00.000Z"),
        }),
        signal("viewed_offer", {
          sourceId: "view-2",
          offerId: "offer-1",
          occurredAt: new Date("2026-07-24T10:00:00.000Z"),
        }),
      ],
      NOW
    );

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      kind: "offer",
      status: "Hohe Priorität · Dry-Run",
      target: { kind: "offer", id: "offer-1" },
    });
  });

  it("loads fresh live signals on every request so new projects can appear", async () => {
    const management = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    let signals = [signal("completed_project", { projectId: "project-existing" })];
    const source = {
      loadSignals: async () => signals,
    };

    const first = await resolveJarvisSalesAnalysisRequest(
      {
        question: "Welche Kunden sollte ich nachfassen?",
        organizationId: "org-1",
        accessProfile: management,
        now: NOW,
      },
      source
    );
    signals = [
      signal("completed_project", {
        sourceId: "new-source",
        projectId: "project-new",
      }),
    ];
    const second = await resolveJarvisSalesAnalysisRequest(
      {
        question: "Welche Kunden sollte ich nachfassen?",
        organizationId: "org-1",
        accessProfile: management,
        now: NOW,
      },
      source
    );

    expect(first?.records?.[0].target.id).toBe("project-existing");
    expect(second?.records?.[0].target.id).toBe("project-new");
  });

  it("keeps the first dry run restricted to actual management sessions", async () => {
    const employee = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
    });
    const impersonating = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER }
    );
    const source = {
      loadSignals: async () => [signal("viewed_offer", { offerId: "offer-1" })],
    };

    for (const accessProfile of [employee, impersonating]) {
      const response = await resolveJarvisSalesAnalysisRequest(
        {
          question: "Wo gibt es Vertriebschancen?",
          organizationId: "org-1",
          accessProfile,
          now: NOW,
        },
        source
      );
      expect(response).toMatchObject({
        type: "refusal",
        topicId: "sales.analysis.refused",
      });
    }
  });

  it("returns a transparent empty result without creating anything", async () => {
    const management = createJarvisAccessProfile({
      id: "gf",
      role: Role.GESCHAEFTSFUEHRER,
    });
    const response = await resolveJarvisSalesAnalysisRequest(
      {
        question: "Checke Kunden auf Vertriebschancen.",
        organizationId: "org-1",
        accessProfile: management,
        now: NOW,
      },
      { loadSignals: async () => [] }
    );

    expect(response).toMatchObject({
      type: "unknown",
      topicId: "sales.analysis.empty",
    });
    expect(response?.message).toContain("keine Mail oder Aufgabe");
  });
});
