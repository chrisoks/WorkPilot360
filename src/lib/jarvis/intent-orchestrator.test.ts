import { describe, expect, it } from "vitest";
import type { JarvisAiIntentClassification } from "@/lib/jarvis/ai-intent-fallback";
import { resolveJarvisIntentDecision } from "@/lib/jarvis/intent-decision";
import {
  doesJarvisResponseFitRoute,
  getJarvisReadHint,
  resolveJarvisRoutePlan,
} from "@/lib/jarvis/intent-orchestrator";

function ai(
  value: Partial<JarvisAiIntentClassification>
): JarvisAiIntentClassification {
  return {
    intent: "read",
    domain: "system",
    entity: "project",
    scope: "explicit_record",
    helpTopicId: "none",
    confidence: "high",
    needsClarification: false,
    usesCurrentContext: false,
    actionKind: "none",
    ...value,
  };
}

describe("JARVIS intent orchestrator V4", () => {
  it("keeps an organization-wide invoice collection out of the open project", () => {
    const question = "Welche Rechnungen sind bei uns noch offen?";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "project-1" },
      ai: ai({
        entity: "invoice",
        scope: "organization",
        usesCurrentContext: false,
      }),
    });

    expect(plan).toMatchObject({
      preferRead: true,
      preferProjectHealth: false,
      usesCurrentContext: false,
    });
    expect(getJarvisReadHint(plan)).toEqual({ kind: "invoice" });
  });

  it("uses a named project before the unrelated screen project", () => {
    const question = "Warum fehlt bei HAS-1 die Rechnung für Juni?";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "mkg-209" },
      ai: ai({
        intent: "diagnose",
        entity: "project",
        scope: "explicit_record",
      }),
    });

    expect(plan).toMatchObject({
      preferProjectHealth: true,
      preferRead: false,
      scope: "explicit_record",
      usesCurrentContext: false,
    });
  });

  it.each([
    ["Prüfe bei HAS-1 die Rechnungen.", "invoice"],
    ["Jetzt zu MKG-209: Prüfe die Angebote.", "offer"],
  ])(
    "keeps project-scoped %s questions in the project health path",
    (question, entity) => {
      const plan = resolveJarvisRoutePlan({
        question,
        decision: resolveJarvisIntentDecision(question),
        context: { recordType: "project", recordId: "screen-project" },
        ai: ai({
          intent: "diagnose",
          entity: entity as "invoice" | "offer",
          scope: "current_record",
          usesCurrentContext: true,
        }),
      });

      expect(plan).toMatchObject({
        scope: "explicit_record",
        preferProjectHealth: true,
        preferRead: false,
        needsClarification: false,
      });
    }
  );

  it("uses a deterministic person intent when AI asks an unnecessary clarification", () => {
    const question = "Was weißt du über Klaus Testmann?";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "project-1" },
      ai: ai({
        intent: "unclear",
        entity: "none",
        scope: "none",
        needsClarification: true,
      }),
      hasDeterministicPersonIntent: true,
    });

    expect(plan).toMatchObject({
      preferPerson: true,
      preferProjectHealth: false,
      needsClarification: false,
      source: "deterministic",
    });
  });

  it("routes a customer summary before project health despite project screen context", () => {
    const question = "Was weißt du über Klaus Testmann?";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "project-1" },
      ai: ai({
        intent: "explain",
        entity: "customer",
        scope: "explicit_record",
      }),
    });

    expect(plan).toMatchObject({
      preferPerson: true,
      preferProjectHealth: false,
      allowExactHelp: false,
    });
  });

  it("distinguishes a how-to question from a live customer search", () => {
    const howTo = resolveJarvisRoutePlan({
      question: "Wie suche ich einen Kunden?",
      decision: resolveJarvisIntentDecision("Wie suche ich einen Kunden?"),
      ai: ai({
        intent: "how_to",
        entity: "customer",
        scope: "none",
        helpTopicId: "customer.search",
      }),
    });
    const search = resolveJarvisRoutePlan({
      question: "Finde den Kunden Klaus Testmann.",
      decision: resolveJarvisIntentDecision(
        "Finde den Kunden Klaus Testmann."
      ),
      ai: ai({
        intent: "read",
        entity: "customer",
        scope: "explicit_record",
      }),
    });

    expect(howTo.allowExactHelp).toBe(true);
    expect(howTo.preferRead).toBe(false);
    expect(search.allowExactHelp).toBe(false);
    expect(search.preferRead).toBe(true);
  });

  it("keeps direct actions in the non-executable preparation path", () => {
    const question = "Schick dem Kunden bitte die Rechnung.";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "project-1" },
      ai: ai({
        intent: "prepare_action",
        entity: "invoice",
        scope: "current_record",
        usesCurrentContext: true,
        actionKind: "email.send",
      }),
    });

    expect(plan.prepareAction).toBe(true);
    expect(plan.preferRead).toBe(false);
    expect(plan.preferProjectHealth).toBe(false);
  });

  it("rejects a project answer for an organization-wide invoice question", () => {
    const question = "Welche Rechnungen sind bei uns noch offen?";
    const plan = resolveJarvisRoutePlan({
      question,
      decision: resolveJarvisIntentDecision(question),
      context: { recordType: "project", recordId: "screen-project" },
      ai: ai({
        entity: "invoice",
        scope: "organization",
        domain: "management",
      }),
    });

    expect(
      doesJarvisResponseFitRoute(plan, {
        type: "answer",
        topicId: "project.health",
      })
    ).toBe(false);
    expect(
      doesJarvisResponseFitRoute(plan, {
        type: "answer",
        topicId: "records.invoice.search",
      })
    ).toBe(true);
  });
});
