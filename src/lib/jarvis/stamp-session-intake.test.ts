import { describe, expect, it } from "vitest";
import {
  extractStampSessionSwitchRequest,
  extractStampSessionStartRequest,
  extractStampSessionStopRequest,
  extractStampSessionTransition,
  looksLikeStampSessionStartRequest,
  looksLikeStampSessionTransitionRequest,
} from "@/lib/jarvis/stamp-session-intake";

describe("stamp-session-intake", () => {
  it.each([
    ["Pausiere meine Stempelung.", "pause"],
    ["Bitte den Stempeltimer pausieren", "pause"],
    ["Setze meine Stempelung fort", "resume"],
    ["Beende meine Stempelpause", "resume"],
  ] as const)("recognizes %s", (question, expected) => {
    expect(extractStampSessionTransition(question)).toBe(expected);
    expect(looksLikeStampSessionTransitionRequest(question)).toBe(true);
  });

  it("extracts a structured project start without confusing it with resume", () => {
    expect(
      extractStampSessionStartRequest(
        "Starte meine Stempelung auf Projekt HAS-1. Tätigkeit: Treppenhaus reinigen; Gewerk: Gebäudereinigung; Abrechnungsleistung: LR-10 | Facharbeiterstunde. Projektstatus auf Umsetzung."
      )
    ).toEqual({
      mode: "project",
      projectNumber: "HAS-1",
      comment: "Treppenhaus reinigen",
      unproductiveLabel: "",
      trade: "Gebäudereinigung",
      billingService: "LR-10 | Facharbeiterstunde",
      confirmImplementationStatus: true,
    });
    expect(looksLikeStampSessionStartRequest("Starte meine Stempelung auf HAS-1. Tätigkeit: Kontrolle")).toBe(true);
    expect(extractStampSessionTransition("Starte meine Stempelung auf HAS-1. Tätigkeit: Kontrolle")).toBeNull();
  });

  it("extracts an unproductive personal start", () => {
    expect(
      extractStampSessionStartRequest(
        "Starte meine Stempelung unproduktiv. Unproduktive Tätigkeit: Büroorganisation; Tätigkeit: Ablage bearbeiten"
      )
    ).toMatchObject({
      mode: "unproductive",
      projectNumber: "",
      unproductiveLabel: "Büroorganisation",
      comment: "Ablage bearbeiten",
      confirmImplementationStatus: false,
    });
  });

  it.each([
    "Zeig meine aktive Stempelung",
    "Läuft meine Stempelung?",
    "Trage meine Stempelung von gestern nach",
    "Stoppe meine Stempelung",
    "Starte eine Stempelung auf HAS-1",
  ])("does not capture other stamp intents: %s", (question) => {
    expect(extractStampSessionTransition(question)).toBeNull();
  });

  it("extracts a finished stop with colleague inspection", () => {
    expect(
      extractStampSessionStopRequest(
        "Beende meine Stempelung. Arbeit fertig. Endkontrolle: Kollege. Ergänzung: Treppenhaus abgeschlossen",
      ),
    ).toEqual(
      expect.objectContaining({
        completionStatus: "finished",
        finalInspectionMode: "colleague",
        comment: "Treppenhaus abgeschlossen",
      }),
    );
  });

  it("extracts an interrupted stop and its mandatory reason", () => {
    expect(
      extractStampSessionStopRequest(
        "Stoppe meine Stempelung. Arbeit unterbrochen. Unterbrechungsgrund: Material fehlt",
      ),
    ).toEqual(
      expect.objectContaining({
        completionStatus: "interrupted",
        interruptionReason: "Material fehlt",
      }),
    );
  });

  it("does not confuse pause, resume, or start with stop", () => {
    expect(extractStampSessionStopRequest("Pausiere meine Stempelung")).toBeNull();
    expect(extractStampSessionStopRequest("Setze meine Stempelung fort")).toBeNull();
    expect(extractStampSessionStopRequest("Starte meine Stempelung")).toBeNull();
  });

  it("extracts the old completion and the new project activity from one switch request", () => {
    expect(extractStampSessionSwitchRequest(
      "Wechsle meine Stempelung zu Projekt GLR-449. Bisherige Arbeit fertig. Bisherige Ergänzung: Treppenhaus abgeschlossen; Neue Tätigkeit: Fenster reinigen; Gewerk: Glasreinigung; Abrechnungsleistung: GLR-10",
    )).toEqual(expect.objectContaining({
      stop: expect.objectContaining({ completionStatus: "finished", comment: "Treppenhaus abgeschlossen" }),
      start: expect.objectContaining({ mode: "project", projectNumber: "GLR-449", comment: "Fenster reinigen", trade: "Glasreinigung", billingService: "GLR-10" }),
    }));
  });

  it("extracts the unproductive follow-up switch used by the permanent corpus", () => {
    expect(extractStampSessionSwitchRequest(
      "Wechsle meine Stempelung zur Folgetätigkeit unproduktiv. Unproduktive Tätigkeit: QA Büroorganisation; Neue Tätigkeit: QA Ablage prüfen",
    )).toEqual(expect.objectContaining({
      stop: expect.objectContaining({ completionStatus: "" }),
      start: expect.objectContaining({
        mode: "unproductive",
        projectNumber: "",
        unproductiveLabel: "QA Büroorganisation",
        comment: "QA Ablage prüfen",
      }),
    }));
  });
});
