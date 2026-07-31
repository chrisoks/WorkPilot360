import { describe, expect, it } from "vitest";
import { resolveJarvisReadIntent } from "@/lib/jarvis/read-intent";

describe("JARVIS read intent", () => {
  it("uses a validated orchestrator hint for a natural collection question", () => {
    expect(
      resolveJarvisReadIntent(
        "Wie viele offene Angebote haben wir?",
        { recordType: "project", recordId: "screen-project" },
        { kind: "offer", filter: "open" }
      )
    ).toMatchObject({
      kind: "offer",
      query: "",
      filter: "open",
      contextRecordId: undefined,
    });
  });

  it("extracts a project search term", () => {
    expect(resolveJarvisReadIntent("Öffne bitte Projekt Müller.")).toEqual({
      kind: "project",
      query: "muller",
      filter: "all",
      contextRecordId: undefined,
      summarize: false,
    });
  });

  it("extracts a customer search term", () => {
    expect(resolveJarvisReadIntent("Finde den Kunden Familienheim.")).toMatchObject({
      kind: "customer",
      query: "familienheim",
      filter: "all",
    });
  });

  it("recognizes open offers without inventing a search term", () => {
    expect(resolveJarvisReadIntent("Welche Angebote sind noch offen?")).toMatchObject({
      kind: "offer",
      query: "",
      filter: "open",
    });
  });

  it("extracts a customer abbreviation from an offer collection request", () => {
    expect(resolveJarvisReadIntent("Zeig mal alle Angebote von OKW.")).toMatchObject({
      kind: "offer",
      query: "okw",
      filter: "all",
    });
  });

  it("recognizes overdue invoices", () => {
    expect(resolveJarvisReadIntent("Zeige mir die überfälligen Rechnungen.")).toMatchObject({
      kind: "invoice",
      filter: "overdue",
    });
  });

  it("recognizes overdue tasks as an organization-wide collection", () => {
    expect(
      resolveJarvisReadIntent("Welche überfälligen Aufgaben gibt es?", {
        recordType: "project",
        recordId: "project-123",
      })
    ).toMatchObject({
      kind: "task",
      query: "",
      filter: "overdue",
      contextRecordId: undefined,
    });
  });

  it("does not turn an organization-wide overdue task question into a text search", () => {
    expect(
      resolveJarvisReadIntent(
        "Welche Aufgaben sind im Unternehmen überfällig?",
        { recordType: "project", recordId: "project-1" }
      )
    ).toMatchObject({
      kind: "task",
      filter: "overdue",
      query: "",
      contextRecordId: undefined,
    });
  });

  it("uses an allowlisted current project id for summaries", () => {
    expect(
      resolveJarvisReadIntent("Fasse dieses Projekt kurz zusammen.", {
        recordType: "project",
        recordId: "project-123",
      })
    ).toEqual({
      kind: "project",
      query: "",
      filter: "all",
      contextRecordId: "project-123",
      summarize: true,
    });
  });

  it("does not let an open project override an explicit plural project search", () => {
    expect(
      resolveJarvisReadIntent("Welche Projekte sind noch offen?", {
        recordType: "project",
        recordId: "project-123",
      })
    ).toEqual({
      kind: "project",
      query: "",
      filter: "open",
      contextRecordId: undefined,
      summarize: false,
    });
  });

  it("does not treat normal system-help questions as record searches", () => {
    expect(resolveJarvisReadIntent("Wie lege ich ein Angebot an?")).toBeUndefined();
    expect(resolveJarvisReadIntent("Zeige mir, wie ich ein Angebot erstelle.")).toBeUndefined();
    expect(resolveJarvisReadIntent("Was ist bei Rechnungen zu beachten?")).toBeUndefined();
    expect(resolveJarvisReadIntent("Wie suche ich einen bestimmten Kunden?")).toBeUndefined();
    expect(resolveJarvisReadIntent("Wie kann ich ein Projekt finden und öffnen?")).toBeUndefined();
  });
});
