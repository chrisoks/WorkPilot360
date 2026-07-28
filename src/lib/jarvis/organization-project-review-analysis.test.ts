import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  resolveJarvisProjectReviewInventoryIntent,
  resolveJarvisProjectReviewInventoryRequest,
  type ProjectReviewInventoryItem,
  type ProjectReviewInventorySource,
} from "@/lib/jarvis/organization-project-review-analysis";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const projects: ProjectReviewInventoryItem[] = [
  {
    id: "p-1",
    projectNumber: "HAS-1",
    title: "Hausmeisterdienst",
    customer: "Klaus Testmann",
    status: "Umsetzung",
    reviewStatus: "unreviewed",
    projectType: "Dauerläufer",
    projectKind: "Dauerläufer",
    recurringBillingMode: "monthlyFlat",
    branch: "OK solutions",
    responsibleName: "Erika Muster",
    updatedAt: new Date("2026-07-28T10:00:00Z"),
  },
  {
    id: "p-2",
    projectNumber: "MKG-209",
    title: "Marketing",
    customer: "Klaus Testmann",
    status: "Abrechnungsprüfung",
    reviewStatus: "needs_review",
    projectType: "Einmaliges Projekt",
    projectKind: "Einmaliges Projekt",
    recurringBillingMode: null,
    branch: "OK solutions",
    responsibleName: null,
    updatedAt: new Date("2026-07-27T10:00:00Z"),
  },
  {
    id: "p-3",
    projectNumber: "DAR-399",
    title: "Dachreinigung",
    customer: "Klaus Testmann",
    status: "Warten auf Kunde",
    reviewStatus: "approved",
    projectType: "Einmaliges Projekt",
    projectKind: "Einmaliges Projekt",
    recurringBillingMode: null,
    branch: "OK immocare",
    responsibleName: null,
    updatedAt: new Date("2026-07-26T10:00:00Z"),
  },
];

const source: ProjectReviewInventorySource = {
  async load() {
    return projects;
  },
};

const management = createJarvisAccessProfile({
  id: "gf",
  role: Role.GESCHAEFTSFUEHRER,
});

describe("JARVIS project review inventory intent", () => {
  it.each([
    "Wie viele Projekte müssen deiner Meinung nach noch überarbeitet werden?",
    "Welche Projekte müssen noch geprüft werden?",
    "Wie ist der fachliche Prüfstand unserer Projekte?",
    "Zeig mir alle ungeprüften Projekte.",
    "Wie viele Projekte müssen nach Änderungen erneut geprüft werden?",
    "Welche Porjekte wurden noch nicht geprfüt?",
    "Wie viele Projekte sind noch nicht freigegeben?",
    "Bei welchen Projekten steht die Freigabe noch aus?",
    "Wie sieht der Projektprüfstatus aus?",
    "Wie viele Projekte müssen noch überarbetet werden?",
  ])("recognizes the project review question family: %s", (question) => {
    expect(resolveJarvisProjectReviewInventoryIntent(question)).toBeDefined();
  });

  it("does not steal a specific project health request", () => {
    expect(
      resolveJarvisProjectReviewInventoryIntent("Prüfe HAS-1 vollständig.")
    ).toBeUndefined();
  });

  it("distinguishes approved projects from projects whose approval is still missing", () => {
    expect(
      resolveJarvisProjectReviewInventoryIntent(
        "Welche Projekte sind fachlich freigegeben?"
      )
    ).toMatchObject({ state: "approved" });
    expect(
      resolveJarvisProjectReviewInventoryIntent(
        "Welche Projekte sind noch nicht fachlich freigegeben?"
      )
    ).toMatchObject({ state: undefined });
  });

  it("keeps the requested unreviewed status despite typical spelling mistakes", () => {
    expect(
      resolveJarvisProjectReviewInventoryIntent(
        "Welche Porjekte wurden noch nicht geprfüt?"
      )
    ).toMatchObject({
      presentation: "list",
      state: "unreviewed",
    });
  });

  it("does not interpret ordinary open-project searches as review inventory", () => {
    expect(
      resolveJarvisProjectReviewInventoryIntent("Welche Projekte sind noch offen?")
    ).toBeUndefined();
  });
});

describe("JARVIS project review inventory response", () => {
  it("returns the deterministic grouped counts instead of project creation help", async () => {
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question:
        "Wie viele Projekte müssen deiner Meinung nach noch überarbeitet werden?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });

    expect(response?.type).toBe("answer");
    expect(response?.message).toBe(
      "Aktuell müssen noch 2 Projekte fachlich geprüft werden. Davon wurde eines noch nie geprüft und bei einem Projekt ist nach Änderungen eine erneute Prüfung notwendig. Ein Projekt ist bereits fachlich freigegeben."
    );
    expect(response?.structured?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Noch zu prüfen", value: "2" }),
        expect.objectContaining({ label: "Noch nie geprüft", value: "1" }),
        expect.objectContaining({ label: "Erneut prüfen", value: "1" }),
        expect.objectContaining({ label: "Freigegeben", value: "1" }),
      ])
    );
    expect(response?.records).toBeUndefined();
  });

  it("returns clickable review candidates for list questions", async () => {
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question: "Welche Projekte müssen noch geprüft werden?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });

    expect(response?.records).toHaveLength(2);
    expect(response?.records?.map((record) => record.target)).toEqual([
      { kind: "project", id: "p-1" },
      { kind: "project", id: "p-2" },
    ]);
  });

  it("does not widen a misspelled unreviewed-only question to every review candidate", async () => {
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question: "Welche Porjekte wurden noch nicht geprfüt?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });

    expect(response?.message).toBe(
      "Aktuell wurde ein Projekt noch nie fachlich geprüft."
    );
    expect(response?.records?.map((record) => record.target.id)).toEqual([
      "p-1",
    ]);
  });

  it("uses natural wording when no project matches a requested review state", async () => {
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question:
        "Wie viele Projekte bei OK immocare müssen nach Änderungen erneut geprüft werden?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });

    expect(response?.message).toBe(
      "Aktuell ist bei keinem Projekt nach Änderungen eine erneute fachliche Prüfung notwendig."
    );
  });

  it("supports status, project-type and branch filters", async () => {
    const unreviewed = await resolveJarvisProjectReviewInventoryRequest({
      question:
        "Welche ungeprüften Dauerläufer mit Monatspauschale gibt es bei OK solutions?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });
    const approved = await resolveJarvisProjectReviewInventoryRequest({
      question: "Welche Projekte bei OK immocare sind fachlich freigegeben?",
      organizationId: "org-a",
      accessProfile: management,
      source,
    });

    expect(unreviewed?.records?.map((record) => record.target.id)).toEqual(["p-1"]);
    expect(approved?.records?.map((record) => record.target.id)).toEqual(["p-3"]);
  });

  it("treats unknown stored states as review candidates instead of approved truth", async () => {
    const unknownSource: ProjectReviewInventorySource = {
      async load() {
        return [{ ...projects[0], reviewStatus: "legacy_value" }];
      },
    };
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question: "Wie viele Projekte müssen geprüft werden?",
      organizationId: "org-a",
      accessProfile: management,
      source: unknownSource,
    });

    expect(response?.message).toContain("muss noch ein Projekt");
    expect(response?.message).toContain("Prüfstatus unklar");
  });

  it("applies the stricter effective role before loading data", async () => {
    let loadCount = 0;
    const guardedSource: ProjectReviewInventorySource = {
      async load() {
        loadCount += 1;
        return projects;
      },
    };
    const impersonatingGuest = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "guest", role: Role.GAST }
    );
    const response = await resolveJarvisProjectReviewInventoryRequest({
      question: "Welche Projekte müssen noch geprüft werden?",
      organizationId: "org-a",
      accessProfile: impersonatingGuest,
      source: guardedSource,
    });

    expect(response?.type).toBe("refusal");
    expect(loadCount).toBe(0);
  });
});
