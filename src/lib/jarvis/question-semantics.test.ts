import { describe, expect, it } from "vitest";
import { analyzeJarvisQuestion } from "@/lib/jarvis/question-semantics";

const MONTHS = [
  ["Januar", "2026-01"],
  ["Februar", "2026-02"],
  ["März", "2026-03"],
  ["April", "2026-04"],
  ["Mai", "2026-05"],
  ["Juni", "2026-06"],
  ["Juli", "2026-07"],
  ["August", "2026-08"],
  ["September", "2026-09"],
  ["Oktober", "2026-10"],
  ["November", "2026-11"],
  ["Dezember", "2026-12"],
] as const;

const PROJECT_REFERENCES = ["HAS-1", "MKG-209", "DAR-399"] as const;

const invoiceMonthCases = PROJECT_REFERENCES.flatMap((reference) =>
  MONTHS.map(([month, monthKey]) => ({
    question: `Warum wurde für ${reference} im ${month} 2026 keine fertige Rechnung erstellt?`,
    reference,
    monthKey,
  }))
);

const timeToInvoiceCases = PROJECT_REFERENCES.flatMap((reference) => [
  {
    question: `Warum wurde bei ${reference} für Juli 2026 noch kein Rechnungsentwurf aus den Stempelungen erstellt?`,
    reference,
  },
  {
    question: `Wieso haben die Arbeitszeiten von ${reference} im Juli 2026 keinen Rechnungsentwurf erzeugt?`,
    reference,
  },
  {
    question: `Weshalb fehlt für ${reference} im Juli 2026 die Abrechnung aus den Zeiteinträgen?`,
    reference,
  },
]);

describe("JARVIS question semantics evaluation matrix", () => {
  it.each([
    "Was läuft bei HAS-1 gerade schief?",
    "Ist MKG-209 insgesamt gesund?",
    "Wo hakt es bei diesem Projekt?",
    "Gib mir bitte nur einen kurzen Überblick über MKG-209.",
    "Hilf mir, MKG-209 korrekt abzuschließen.",
    "Prüf mal das Projekt hier.",
  ])("treats a broad project assessment as a full check: %s", (question) => {
    expect(analyzeJarvisQuestion(question).projectScopes).toEqual(["full"]);
  });

  it.each(MONTHS)(
    "infers the current year for a bare billing month %s",
    (month, monthKey) => {
      const semantics = analyzeJarvisQuestion(
        `Was verhindert die ${month}-Abrechnung bei HAS-1?`,
        { now: new Date("2026-07-28T10:00:00.000Z") }
      );
      expect(semantics.projectReferences).toEqual(["HAS-1"]);
      expect(semantics.explicitMonths).toEqual([
        expect.objectContaining({ key: monthKey }),
      ]);
      expect(semantics.relation).toBe("invoice_month");
      expect(semantics.projectScopes).toEqual(["commercial"]);
      expect(semantics.answerDepth).toBe("focused");
    }
  );

  it("understands a bare month draft as a time-to-invoice question", () => {
    const semantics = analyzeJarvisQuestion(
      "Weshalb erzeugen die Arbeitszeiten bei MKG-209 keinen Juli-Entwurf?",
      { now: new Date("2026-07-28T10:00:00.000Z") }
    );
    expect(semantics.projectReferences).toEqual(["MKG-209"]);
    expect(semantics.explicitMonths).toEqual([
      expect.objectContaining({ key: "2026-07" }),
    ]);
    expect(semantics.relation).toBe("time_to_invoice");
    expect(semantics.projectScopes).toEqual(["commercial"]);
    expect(semantics.answerDepth).toBe("focused");
  });

  it.each([
    "Welche Materialien wurden bei HAS-1 abgerechnet?",
    "Wie viel Streusalz wurde bei HAS-1 verkauft?",
    "Werte die Artikelmengen von HAS-1 aus.",
    "Prüfe Material und Lager bei HAS-1.",
  ])("recognizes a project material analysis: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["HAS-1"]);
    expect(semantics.relation).toBe("project_materials");
    expect(semantics.projectScopes).toEqual(["commercial"]);
  });

  it("treats natural project material anomalies as a focused material analysis", () => {
    const semantics = analyzeJarvisQuestion(
      "Gibt es Auffälligkeiten beim Material?"
    );
    expect(semantics.relation).toBe("project_materials");
    expect(semantics.projectScopes).toEqual(["commercial"]);
  });

  it("treats economic material wording as a focused material analysis", () => {
    const semantics = analyzeJarvisQuestion(
      "Welche Materialien fallen in diesem Projekt wirtschaftlich auf?"
    );
    expect(semantics.relation).toBe("project_materials");
    expect(semantics.projectScopes).toEqual(["commercial"]);
  });

  it.each([
    "Wie hoch ist der tatsächlich erzielte Stundenverrechnungssatz bei HAS-1?",
    "Analysiere Leistungen und Stundensätze bei HAS-1.",
    "Müssen wir den SVS bei HAS-1 erhöhen?",
    "Werte den Leistungspreis von HAS-1 aus.",
  ])("recognizes a project service-rate analysis: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["HAS-1"]);
    expect(semantics.relation).toBe("project_service_rates");
    expect(semantics.projectScopes).toEqual(["commercial"]);
  });

  it.each([
    ["Wie wirtschaftlich ist dieses Projekt?", ["improvements"]],
    ["Was fehlt bis zur Abrechnung?", ["commercial"]],
    ["Wie erkenne ich, ob ein Angebot fehlt?", ["commercial"]],
    ["Welche Nachweise fehlen in dieser Projektakte?", ["improvements"]],
    ["Wie prüfe ich fehlende Leistungsnachweise?", ["improvements"]],
    ["Was ist der wichtigste nächste Schritt im Projekt?", ["improvements"]],
    ["Gib mir kurz den nächsten sinnvollen Schritt.", ["improvements"]],
  ])("maps the natural project question %s to one scope", (question, scopes) => {
    expect(analyzeJarvisQuestion(question).projectScopes).toEqual(scopes);
  });

  it("does not reinterpret an offer draft without a month as an invoice", () => {
    const semantics = analyzeJarvisQuestion(
      "Warum ist der Angebotsentwurf bei HAS-1 noch offen?",
      { now: new Date("2026-07-28T10:00:00.000Z") }
    );
    expect(semantics.relation).toBe("none");
  });

  it.each(invoiceMonthCases)(
    "keeps month and project separate: $question",
    ({ question, reference, monthKey }) => {
      const semantics = analyzeJarvisQuestion(question);
      expect(semantics.projectReferences).toEqual([reference]);
      expect(semantics.explicitMonths).toEqual([
        expect.objectContaining({ key: monthKey }),
      ]);
      expect(semantics.relation).toBe("invoice_month");
      expect(semantics.projectScopes).toEqual(["commercial"]);
      expect(semantics.answerDepth).toBe("focused");
      expect(semantics.responsePolicy).toMatchObject({
        includeScore: false,
        includeAreaAssessments: false,
        maxPrimaryFindings: 2,
      });
    }
  );

  it.each(timeToInvoiceCases)(
    "keeps a causal time-to-invoice question together: $question",
    ({ question, reference }) => {
      const semantics = analyzeJarvisQuestion(question);
      expect(semantics.projectReferences).toEqual([reference]);
      expect(semantics.explicitMonths).toEqual([
        expect.objectContaining({ key: "2026-07" }),
      ]);
      expect(semantics.relation).toBe("time_to_invoice");
      expect(semantics.projectScopes).toEqual(["commercial"]);
      expect(semantics.answerDepth).toBe("focused");
    }
  );

  it.each([
    "Warum ist der nächste Monat bei HAS-1 noch nicht vollständig geplant?",
    "Wieso wurde der Folgemonat für HAS-1 noch nicht komplett verplant?",
    "Weshalb fehlen bei HAS-1 im nächsten Monat noch Termine?",
    "Warum ist die Planung für HAS-1 unvollständig?",
  ])("treats a planning gap as focused planning, not a full check: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["HAS-1"]);
    expect(semantics.relation).toBe("planning_gap");
    expect(semantics.projectScopes).toEqual(["planning"]);
    expect(semantics.answerDepth).toBe("focused");
    expect(semantics.projectScopes).not.toContain("full");
  });

  it.each([
    "Prüfe HAS-1 vollständig.",
    "Checke HAS-1 komplett.",
    "Mach einen vollständigen Projektcheck für HAS-1.",
    "Führe den Gesundheitscheck für HAS-1 aus.",
  ])("recognizes an explicit full diagnostic command: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["HAS-1"]);
    expect(semantics.projectScopes).toEqual(["full"]);
    expect(semantics.answerDepth).toBe("diagnostic");
    expect(semantics.responsePolicy).toMatchObject({
      includeScore: true,
      includeAreaAssessments: true,
    });
  });

  it.each([
    {
      question: "Prüfe bei HAS-1 Planung und Rechnungen.",
      scopes: ["planning", "commercial"],
    },
    {
      question: "Analysiere bei HAS-1 Stempelungen und Aufgaben.",
      scopes: ["stamps", "tasks"],
    },
    {
      question: "Kontrolliere bei HAS-1 Angebote, Rechnungen und Automatik.",
      scopes: ["commercial", "automation"],
    },
  ])("preserves explicitly requested diagnostic scopes: $question", ({ question, scopes }) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectScopes).toEqual(scopes);
    expect(semantics.answerDepth).toBe("diagnostic");
  });

  it.each([
    "Warum ist der nächste Monat bei HAS-1 noch nicht vollstndig geplnat?",
    "Wieso wurde der Folgemonat für HAS-1 nicht komplet verpalnt?",
  ])("survives small spelling errors in planning questions: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["HAS-1"]);
    expect(semantics.relation).toBe("planning_gap");
    expect(semantics.projectScopes).toEqual(["planning"]);
  });

  it.each([
    "Warum wurde bei MKG-209 für Juli 2026 kein Rechnunsgentwurf aus den Stmepelungen erstellt?",
    "Wieso haben die Arbeitszetien von MKG-209 im Juli 2026 keinen Rechungsentwurf erzeugt?",
  ])("survives small spelling errors in causal billing questions: %s", (question) => {
    const semantics = analyzeJarvisQuestion(question);
    expect(semantics.projectReferences).toEqual(["MKG-209"]);
    expect(semantics.relation).toBe("time_to_invoice");
    expect(semantics.projectScopes).toEqual(["commercial"]);
  });

  it.each(MONTHS)(
    "never treats the calendar month %s as a project",
    (month, monthKey) => {
      const semantics = analyzeJarvisQuestion(
        `Was ist bei HAS-1 im ${month} 2026 passiert?`
      );
      expect(semantics.projectReferences).toEqual(["HAS-1"]);
      expect(semantics.explicitMonths).toEqual([
        expect.objectContaining({ key: monthKey }),
      ]);
    }
  );

  it("keeps two real project references while excluding the date", () => {
    const semantics = analyzeJarvisQuestion(
      "Vergleiche HAS-1 und MKG-209 im Juli 2026."
    );
    expect(semantics.projectReferences).toEqual(["HAS-1", "MKG-209"]);
    expect(semantics.explicitMonths).toEqual([
      expect.objectContaining({ key: "2026-07" }),
    ]);
  });

  it("does not reinterpret an ordinary duration as a project reference", () => {
    const semantics = analyzeJarvisQuestion(
      "Welche Angebote sind seit mehr als 30 Tagen offen?"
    );
    expect(semantics.projectReferences).toEqual([]);
  });
});
