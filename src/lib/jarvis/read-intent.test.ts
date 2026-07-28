import { describe, expect, it } from "vitest";
import { resolveJarvisReadIntent } from "@/lib/jarvis/read-intent";

describe("JARVIS read intent", () => {
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

  it("recognizes overdue invoices", () => {
    expect(resolveJarvisReadIntent("Zeige mir die überfälligen Rechnungen.")).toMatchObject({
      kind: "invoice",
      filter: "overdue",
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
