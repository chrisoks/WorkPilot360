import { describe, expect, it } from "vitest";
import { applyJarvisAnswerPolicy } from "@/lib/jarvis/answer-policy";

const diagnosticPayload = {
  type: "answer",
  topicId: "project.health",
  message:
    "HAS-1 erreicht im freigegebenen Prüfumfang 83 von 100 Punkten. Wichtigster Prüfpunkt: Planung unvollständig.",
  structured: {
    title: "Planung & Termine · HAS-1",
    summary: "0 kritische und 2 weitere Prüfungen wurden erkannt.",
    facts: [
      { label: "Teilprüfwert", value: "83 / 100" },
      { label: "Einordnung", value: "Prüfen" },
      { label: "Auswahl", value: "Planung & Termine" },
    ],
    sections: [
      {
        title: "Danach prüfen",
        items: [
          "Für den nächsten Monat fehlen Termine. Nächster Schritt: Öffne das Planungsboard.",
          "Im aktuellen Monat fehlen ebenfalls Stunden.",
          "Ein dritter Nebenbefund.",
        ],
      },
      {
        title: "Bewertung nach Bereichen",
        items: ["Planung: Prüfen · 83 / 100"],
      },
      {
        title: "Geprüfter Umfang",
        items: ["Planung", "Dauerläufer-Monatskette"],
      },
      {
        title: "Erkannte Automatik",
        items: ["Monatspauschale"],
      },
      {
        title: "Rollenbedingter Prüfumfang",
        items: ["Nicht geprüft: Lohndaten."],
      },
      {
        title: "Abgrenzung",
        items: ["Kein Gesamtcheck."],
      },
    ],
  },
  deterministic: true,
};

describe("JARVIS answer depth policy", () => {
  it("reduces a focused why-question to essential findings", () => {
    const result = applyJarvisAnswerPolicy(
      "Warum ist der nächste Monat bei HAS-1 noch nicht vollständig geplant?",
      diagnosticPayload
    );

    expect(result).toMatchObject({
      type: "answer",
      structured: {
        summary: "Für den nächsten Monat fehlen Termine.",
        facts: [{ label: "Einordnung", value: "Prüfen" }],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Teilprüfwert");
    expect(serialized).not.toContain("Bewertung nach Bereichen");
    expect(serialized).not.toContain("Geprüfter Umfang");
    expect(serialized).not.toContain("Erkannte Automatik");
    expect(serialized).not.toContain("Abgrenzung");
    expect(serialized).toContain("Rollenbedingter Prüfumfang");
    expect(serialized).not.toContain(
      "Im aktuellen Monat fehlen ebenfalls Stunden"
    );
    expect(serialized).not.toContain("Ein dritter Nebenbefund");
  });

  it("prioritizes only the requested follow-up month", () => {
    const result = applyJarvisAnswerPolicy(
      "Wieso ist der Folgemonat bei HAS-1 noch nicht komplett verplant?",
      {
        ...diagnosticPayload,
        structured: {
          ...diagnosticPayload.structured,
          sections: [
            {
              title: "Danach prüfen",
              items: [
                "Für den aktuellen Monat fehlen noch Stunden.",
                "Für den nächsten Projektmonat fehlen noch Termine.",
              ],
            },
          ],
        },
      }
    );

    expect(result).toMatchObject({
      structured: {
        summary: "Für den nächsten Projektmonat fehlen noch Termine.",
        sections: [
          {
            items: ["Für den nächsten Projektmonat fehlen noch Termine."],
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      "Für den aktuellen Monat fehlen noch Stunden."
    );
  });

  it("keeps the full report for an explicit diagnostic command", () => {
    const result = applyJarvisAnswerPolicy(
      "Prüfe HAS-1 vollständig.",
      diagnosticPayload
    );

    expect(result).toEqual(diagnosticPayload);
  });

  it("does not change a focused answer that is already concise", () => {
    const concise = {
      type: "answer",
      message: "Für Juni 2026 ist ein Entwurf vorhanden.",
      structured: {
        title: "Rechnung Juni 2026 · HAS-1",
        summary: "Für Juni 2026 ist ein Entwurf vorhanden.",
        facts: [{ label: "Stand", value: "Entwurf vorhanden" }],
        sections: [
          { title: "Festgestellt", items: ["Der Entwurf ist noch offen."] },
          { title: "Nächster Schritt", items: ["Öffne den Entwurf."] },
        ],
      },
    };

    expect(
      applyJarvisAnswerPolicy(
        "Warum wurde für HAS-1 im Juni 2026 keine fertige Rechnung erstellt?",
        concise
      )
    ).toEqual(concise);
  });
});
