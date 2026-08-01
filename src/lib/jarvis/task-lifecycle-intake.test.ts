import { describe, expect, it } from "vitest";
import { extractTaskLifecycle, looksLikeTaskLifecycleRequest } from "@/lib/jarvis/task-lifecycle-intake";

describe("JARVIS task lifecycle intake", () => {
  it("recognizes isolated archive and restore commands", () => {
    expect(looksLikeTaskLifecycleRequest("Archiviere die Aufgabe Fenster prüfen. Grund: Doppelt angelegt.")).toBe(true);
    expect(looksLikeTaskLifecycleRequest("Stelle Aufgabe Fenster prüfen wieder her. Grund: Irrtümlich archiviert.")).toBe(true);
    expect(looksLikeTaskLifecycleRequest("Zeig mir archivierte Aufgaben")).toBe(false);
    expect(looksLikeTaskLifecycleRequest("Lösche das Projekt und die Aufgabe")).toBe(false);
  });

  it("extracts action, title and reason without treating the reason as a command", () => {
    expect(extractTaskLifecycle("Archiviere die Aufgabe Fenster prüfen. Grund: Doppelt angelegt.")).toEqual({
      action: "archive", title: "Fenster prüfen", reason: "Doppelt angelegt", taskId: undefined,
    });
    expect(extractTaskLifecycle("Stelle die Aufgabe „Fenster prüfen“ wieder her, weil irrtümlich archiviert.")).toEqual({
      action: "restore", title: "Fenster prüfen", reason: "irrtümlich archiviert", taskId: undefined,
    });
  });

  it("maps delete language to reversible archiving", () => {
    expect(extractTaskLifecycle("Lösche Aufgabe Fenster prüfen wegen doppelt").action).toBe("archive");
  });

  it("accepts an explicit task id for otherwise ambiguous titles", () => {
    expect(extractTaskLifecycle("Archiviere Aufgabe Aufgaben-ID: task_123456. Grund: Doppelt.").taskId).toBe("task_123456");
  });
});
