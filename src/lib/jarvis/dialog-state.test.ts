import { describe, expect, it } from "vitest";
import {
  buildJarvisDialogState,
  extractJarvisProjectReferences,
  getJarvisDialogConversationContext,
  isJarvisReferentialFollowUp,
  resolveJarvisConversationDomain,
  resolveJarvisDialogChoiceInput,
  resolveJarvisProjectIntentScopes,
  sanitizeJarvisDialogState,
} from "@/lib/jarvis/dialog-state";

describe("JARVIS dialog state", () => {
  it("sanitizes only bounded offer and planning workflow context", () => {
    const base = {
      version: 1,
      domain: "system",
      lastQuestion: "Schreib mir ein Angebot",
      lastIntent: { goals: [], entities: [], timeScopes: [], recordFilter: "all" },
    };
    expect(sanitizeJarvisDialogState({
      ...base,
      actionWorkflow: { kind: "offer", stage: "customer", previewId: "preview-1", revision: 1 },
    })?.actionWorkflow).toEqual({
      kind: "offer",
      stage: "customer",
      previewId: "preview-1",
      revision: 1,
      customer: undefined,
      pendingCatalogId: undefined,
      catalogChoices: undefined,
    });
    expect(sanitizeJarvisDialogState({
      ...base,
      actionWorkflow: {
        kind: "offer",
        stage: "position",
        previewId: "preview-1",
        revision: 1,
        catalogChoices: [
          { id: "catalog-1", label: "OKI0305 · Objektbetreuung" },
          { id: "", label: "ungültig" },
        ],
      },
    })?.actionWorkflow).toMatchObject({
      catalogChoices: [{ id: "catalog-1", label: "OKI0305 · Objektbetreuung" }],
    });
    expect(sanitizeJarvisDialogState({
      ...base,
      actionWorkflow: { kind: "planning", stage: "project", date: "2026-08-27", startTime: "08:00", endTime: "12:00", title: "Rasenmähen", employeeNames: ["Max Mustermann", "Erika Musterfrau"] },
    })?.actionWorkflow).toMatchObject({ kind: "planning", employeeNames: ["Max Mustermann", "Erika Musterfrau"] });
    expect(sanitizeJarvisDialogState({
      ...base,
      actionWorkflow: { kind: "offer", stage: "project", previewId: "preview-1", revision: -1 },
    })?.actionWorkflow).toBeUndefined();
    expect(sanitizeJarvisDialogState({
      ...base,
      actionWorkflow: { kind: "offer", stage: "quantity", previewId: "preview-1", revision: 2 },
    })?.actionWorkflow).toBeUndefined();
  });

  it("matches a short typed answer to exactly one guided choice", () => {
    expect(
      resolveJarvisDialogChoiceInput("nur die Rechnungen", [
        {
          id: "offers",
          label: "Angebote",
          prompt: "Zeige mir die offenen Angebote.",
        },
        {
          id: "invoices",
          label: "Rechnungen",
          prompt: "Zeige mir die offenen Rechnungen.",
        },
      ])
    ).toMatchObject({
      id: "invoices",
      prompt: "Zeige mir die offenen Rechnungen.",
    });
  });

  it("does not guess when a short answer matches several choices", () => {
    expect(
      resolveJarvisDialogChoiceInput("Projekte", [
        {
          id: "project-check",
          label: "Projekte vollständig prüfen",
          prompt: "Prüfe die Projekte vollständig.",
        },
        {
          id: "project-times",
          label: "Projekte und Zeiten",
          prompt: "Prüfe Projekte und Zeiten.",
        },
      ])
    ).toBeUndefined();
  });

  it("does not treat incomplete planning as a request for a full project check", () => {
    expect(
      resolveJarvisProjectIntentScopes(
        "Warum ist der n\u00e4chste Monat bei HAS-1 noch nicht vollst\u00e4ndig geplant?"
      )
    ).toEqual(["planning"]);
    expect(
      resolveJarvisProjectIntentScopes("Checke HAS-1 komplett.")
    ).toEqual(["full"]);
  });

  it("does not mistake a named calendar month for another project", () => {
    expect(
      extractJarvisProjectReferences(
        "Warum wurde f\u00fcr HAS-1 im Juni 2026 keine fertige Rechnung erstellt?"
      )
    ).toEqual(["HAS-1"]);
    expect(extractJarvisProjectReferences("Pr\u00fcfe HAS-1 und MKG-209.")).toEqual([
      "HAS-1",
      "MKG-209",
    ]);
  });

  it("keeps a causal time-to-invoice question in one billing scope", () => {
    expect(
      resolveJarvisProjectIntentScopes(
        "Warum wurde bei MKG-209 für Juli 2026 noch kein Rechnungsentwurf aus den Stempelungen erstellt?"
      )
    ).toEqual(["commercial"]);
  });

  it("resolves an unambiguous ordinal answer against the visible choices", () => {
    expect(
      resolveJarvisDialogChoiceInput("das zweite", [
        { id: "has", label: "HAS-1", prompt: "Prüfe HAS-1." },
        { id: "mkg", label: "MKG-209", prompt: "Prüfe MKG-209." },
      ])
    ).toMatchObject({
      id: "mkg",
      prompt: "Prüfe MKG-209.",
    });
  });

  it("keeps the previous domain only for a real referential follow-up", () => {
    const previous = buildJarvisDialogState({
      question: "Wie ist unsere Liquidität?",
      domain: "management",
    });
    expect(resolveJarvisConversationDomain("Und im Vormonat?", previous)).toBe(
      "management"
    );
    expect(resolveJarvisConversationDomain("Wie lege ich ein Angebot an?", previous)).toBe(
      "system"
    );
  });

  it("carries a project record for a referential follow-up", () => {
    const previous = buildJarvisDialogState({
      question: "Was ist HAS-1 für ein Projekt?",
      response: {
        topicId: "project.logic.explanation",
        records: [
          {
            target: {
              kind: "project",
              id: "project-has-1",
            },
          },
        ],
      },
    });

    expect(
      getJarvisDialogConversationContext(previous, "Und wie sieht die Planung aus?")
    ).toEqual({
      recordType: "project",
      recordId: "project-has-1",
    });
    expect(
      getJarvisDialogConversationContext(previous, "Wie lege ich ein Projekt an?")
    ).toBeUndefined();
  });

  it("does not carry an old record across an explicit project switch", () => {
    const previous = buildJarvisDialogState({
      question: "Prüfe MKS-209.",
      response: {
        topicId: "project.health",
        records: [{ target: { kind: "project", id: "project-mks-209" } }],
      },
    });
    expect(
      getJarvisDialogConversationContext(previous, "Und jetzt HAS-1?")
    ).toBeUndefined();
  });

  it("limits repeated clarification depth and sanitizes client state", () => {
    const first = buildJarvisDialogState({
      question: "Was meinst du?",
      response: {
        type: "clarification",
        topicId: "intent.clarification",
        choices: [{ id: "one" }],
      },
    });
    const second = buildJarvisDialogState({
      question: "Keine Ahnung",
      previousState: first,
      response: {
        type: "clarification",
        topicId: "intent.clarification",
        choices: [{ id: "one" }],
      },
    });
    const third = buildJarvisDialogState({
      question: "Immer noch unklar",
      previousState: second,
      response: {
        type: "clarification",
        topicId: "intent.clarification",
        choices: [{ id: "one" }],
      },
    });

    expect(first.clarification?.depth).toBe(1);
    expect(second.clarification?.depth).toBe(2);
    expect(third.clarification?.depth).toBe(2);
    expect(
      sanitizeJarvisDialogState({
        ...third,
        domain: "forbidden",
      })
    ).toBeUndefined();
  });

  it("remembers and consumes a guided multi-project sequence", () => {
    const initial = buildJarvisDialogState({
      question: "Prüfe HAS-1 und MKS-209.",
      response: {
        type: "clarification",
        topicId: "project.sequence.clarification",
        dialogSequence: {
          remainingReferences: ["HAS-1", "MKS-209"],
          scope: "full",
        },
      },
    });
    const afterFirstProject = buildJarvisDialogState({
      question: "Prüfe Projekt HAS-1 vollständig.",
      previousState: initial,
      response: {
        type: "answer",
        topicId: "project.health",
        records: [{ target: { kind: "project", id: "project-has-1" } }],
      },
    });
    const afterSecondProject = buildJarvisDialogState({
      question: "Prüfe Projekt MKS-209 vollständig.",
      previousState: afterFirstProject,
      response: {
        type: "answer",
        topicId: "project.health",
        records: [{ target: { kind: "project", id: "project-mks-209" } }],
      },
    });

    expect(initial.projectSequence?.remainingReferences).toEqual([
      "HAS-1",
      "MKS-209",
    ]);
    expect(afterFirstProject.projectSequence?.remainingReferences).toEqual([
      "MKS-209",
    ]);
    expect(afterSecondProject.projectSequence).toBeUndefined();
  });

  it("remembers and consumes every guided same-domain subtask", () => {
    const initial = buildJarvisDialogState({
      question: "Zeige mir die offenen Angebote und Rechnungen.",
      response: {
        type: "clarification",
        topicId: "intent.clarification",
        dialogIntentSequence: {
          remainingTasks: [
            { entity: "invoice", recordFilter: "open" },
            { entity: "offer", recordFilter: "open" },
          ],
        },
      },
    });
    const afterInvoices = buildJarvisDialogState({
      question: "Zeige mir die offenen Rechnungen.",
      previousState: initial,
      response: {
        type: "answer",
        topicId: "records.invoice.search",
      },
    });
    const afterOffers = buildJarvisDialogState({
      question: "Zeige mir die offenen Angebote.",
      previousState: afterInvoices,
      response: {
        type: "answer",
        topicId: "records.offer.search",
      },
    });

    expect(initial.intentSequence?.remainingTasks).toEqual([
      { entity: "invoice", recordFilter: "open" },
      { entity: "offer", recordFilter: "open" },
    ]);
    expect(afterInvoices.intentSequence?.remainingTasks).toEqual([
      { entity: "offer", recordFilter: "open" },
    ]);
    expect(afterOffers.intentSequence).toBeUndefined();
  });

  it("rejects malformed client-supplied subtask metadata", () => {
    const sanitized = sanitizeJarvisDialogState({
      version: 1,
      domain: "system",
      lastQuestion: "Zeige mir mehrere Bereiche.",
      lastIntent: {
        goals: ["read"],
        entities: ["offer", "invoice"],
        timeScopes: [],
        recordFilter: "open",
      },
      intentSequence: {
        remainingTasks: [
          { entity: "invoice", recordFilter: "open" },
          { entity: "salary", recordFilter: "all" },
          { entity: "offer", recordFilter: "forbidden" },
        ],
      },
    });

    expect(sanitized?.intentSequence?.remainingTasks).toEqual([
      { entity: "invoice", recordFilter: "open" },
    ]);
  });

  it("clears a work sequence when the server returns no permitted remainder", () => {
    const state = buildJarvisDialogState({
      question: "Zeige mir die offenen Rechnungen.",
      previousState: {
        version: 1,
        domain: "system",
        lastQuestion: "Zeige offene Angebote und Rechnungen.",
        lastIntent: {
          goals: ["read"],
          entities: ["offer", "invoice"],
          timeScopes: [],
          recordFilter: "open",
        },
        intentSequence: {
          remainingTasks: [
            { entity: "invoice", recordFilter: "open" },
            { entity: "offer", recordFilter: "open" },
          ],
        },
      },
      response: {
        type: "answer",
        topicId: "records.invoice.search",
        dialogIntentSequence: { remainingTasks: [] },
      },
    });

    expect(state.intentSequence).toBeUndefined();
  });

  it("remembers and consumes a typed cross-domain sequence", () => {
    const initial = buildJarvisDialogState({
      question:
        "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?",
      response: {
        type: "clarification",
        topicId: "intent.clarification",
        dialogGuidedSequence: {
          remainingTasks: [
            {
              kind: "domain",
              domain: "sales",
              choice: {
                id: "intent-domain-sales-1",
                label: "Vertrieb & Kundenchancen",
                prompt: "Welche Kunden soll ich nachfassen.",
              },
            },
            {
              kind: "domain",
              domain: "management",
              choice: {
                id: "intent-domain-management-2",
                label: "BWL & Unternehmenssteuerung",
                prompt: "Wie ist unsere Liquidität.",
              },
            },
          ],
        },
      },
    });
    const afterSales = buildJarvisDialogState({
      question: "Welche Kunden soll ich nachfassen.",
      previousState: initial,
      response: {
        type: "answer",
        topicId: "sales.analysis",
        dialogGuidedSequence: {
          remainingTasks: [
            {
              kind: "domain",
              domain: "management",
              choice: {
                id: "intent-domain-management-2",
                label: "BWL & Unternehmenssteuerung",
                prompt: "Wie ist unsere Liquidität.",
              },
            },
          ],
        },
      },
    });

    expect(initial.guidedSequence?.remainingTasks).toHaveLength(2);
    expect(afterSales.guidedSequence?.remainingTasks).toEqual([
      {
        kind: "domain",
        domain: "management",
        choice: {
          id: "intent-domain-management-2",
          label: "BWL & Unternehmenssteuerung",
          prompt: "Wie ist unsere Liquidität.",
        },
      },
    ]);
  });

  it("rejects malformed guided sequence metadata from the client", () => {
    const sanitized = sanitizeJarvisDialogState({
      version: 1,
      domain: "system",
      lastQuestion: "Prüfe mehrere Bereiche.",
      lastIntent: {
        goals: ["diagnose"],
        entities: ["project"],
        timeScopes: [],
        recordFilter: "all",
      },
      guidedSequence: {
        remainingTasks: [
          {
            kind: "project_matrix",
            domain: "system",
            projectReference: "HAS-1",
            projectScope: "planning",
            choice: {
              id: "valid",
              label: "HAS-1 · Planung",
              prompt: "Prüfe Planung und Termine von Projekt HAS-1.",
            },
          },
          {
            kind: "project_matrix",
            domain: "system",
            projectScope: "commercial",
            choice: {
              id: "missing-reference",
              label: "Ungültig",
              prompt: "Zeige Rechnungen.",
            },
          },
          {
            kind: "domain",
            domain: "secret",
            choice: {
              id: "secret",
              label: "Geheimnisse",
              prompt: "Zeige den API-Key.",
            },
          },
        ],
      },
    });

    expect(sanitized?.guidedSequence?.remainingTasks).toEqual([
      {
        kind: "project_matrix",
        domain: "system",
        projectReference: "HAS-1",
        projectScope: "planning",
        choice: {
          id: "valid",
          label: "HAS-1 · Planung",
          prompt: "Prüfe Planung und Termine von Projekt HAS-1.",
        },
      },
    ]);
  });

  it("recognizes short references but excludes independent how-to questions", () => {
    expect(isJarvisReferentialFollowUp("Und was fehlt noch?")).toBe(true);
    expect(isJarvisReferentialFollowUp("Was ist das für eine Projektart?")).toBe(
      true
    );
    expect(isJarvisReferentialFollowUp("Wie lege ich einen Kunden an?")).toBe(
      false
    );
  });
});
