import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import {
  canAccessJarvisTask,
  formatJarvisEmptyReadMessage,
  formatJarvisReadCollectionMessage,
  getJarvisReadAccessDecision,
} from "@/lib/jarvis/read-model";

describe("JARVIS read model permissions", () => {
  it("states clearly when a recognized customer has no offers", () => {
    expect(
      formatJarvisEmptyReadMessage({
        intent: { kind: "offer", query: "okw", filter: "all" },
        subjectLabel: "OKW GmbH",
      })
    ).toBe("Für OKW GmbH sind aktuell keine Angebote in WorkPilot360 vorhanden.");
  });

  it("names the search term when no matching subject can be resolved", () => {
    expect(
      formatJarvisEmptyReadMessage({
        intent: { kind: "offer", query: "unbekannt", filter: "open" },
      })
    ).toBe("Zu „unbekannt“ habe ich aktuell keine offenen Angebote in WorkPilot360 gefunden.");
  });

  it("explains a capped result list without broken or misleading grammar", () => {
    expect(
      formatJarvisReadCollectionMessage({
        count: 20,
        pluralLabel: "Projekte",
        hasMore: true,
      })
    ).toBe(
      "Ich zeige 20 passende Projekte in deinem erlaubten Bereich. Weitere Treffer sind vorhanden."
    );
  });

  it("lets employees read projects and their scoped tasks", () => {
    const employee = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
      teamId: "team-a",
    });
    expect(getJarvisReadAccessDecision("project", employee).executable).toBe(true);
    expect(getJarvisReadAccessDecision("task", employee).executable).toBe(true);
  });

  it("blocks customer, offer and invoice reads for normal employees", () => {
    const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });
    expect(getJarvisReadAccessDecision("customer", employee).permitted).toBe(false);
    expect(getJarvisReadAccessDecision("offer", employee).permitted).toBe(false);
    expect(getJarvisReadAccessDecision("invoice", employee).permitted).toBe(false);
  });

  it("allows sales to read customers and offers but not invoices", () => {
    const sales = createJarvisAccessProfile({ id: "sales", role: Role.VERTRIEB });
    expect(getJarvisReadAccessDecision("customer", sales).executable).toBe(true);
    expect(getJarvisReadAccessDecision("offer", sales).executable).toBe(true);
    expect(getJarvisReadAccessDecision("invoice", sales).permitted).toBe(false);
  });

  it("allows management to use all read adapters", () => {
    const management = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
    for (const kind of ["project", "customer", "task", "offer", "invoice"] as const) {
      expect(getJarvisReadAccessDecision(kind, management).executable).toBe(true);
    }
  });

  it("uses the stricter role while impersonating", () => {
    const impersonating = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER }
    );
    expect(getJarvisReadAccessDecision("invoice", impersonating).permitted).toBe(false);
  });

  it("limits employee tasks to their own participation", () => {
    const employee = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
      teamId: "team-a",
    });
    expect(canAccessJarvisTask(employee, { ownerId: "employee", teamId: "team-b" })).toBe(true);
    expect(canAccessJarvisTask(employee, { ownerId: "someone-else", teamId: "team-a" })).toBe(false);
    expect(
      canAccessJarvisTask(employee, {
        ownerId: "someone-else",
        teamId: "team-b",
        participantUserIds: ["employee"],
      })
    ).toBe(true);
  });

  it("limits leadership tasks to its own team", () => {
    const leadership = createJarvisAccessProfile({
      id: "lead",
      role: Role.FUEHRUNGSKRAFT,
      teamId: "team-a",
    });
    expect(canAccessJarvisTask(leadership, { ownerId: "employee", teamId: "team-a" })).toBe(true);
    expect(canAccessJarvisTask(leadership, { ownerId: "employee", teamId: "team-b" })).toBe(false);
  });

  it("does not widen task scope during impersonation", () => {
    const impersonating = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER, teamId: "team-a" }
    );
    expect(canAccessJarvisTask(impersonating, { ownerId: "employee", teamId: "team-a" })).toBe(true);
    expect(canAccessJarvisTask(impersonating, { ownerId: "someone-else", teamId: "team-a" })).toBe(false);
  });
});
