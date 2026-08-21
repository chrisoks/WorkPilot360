import { describe, expect, it } from "vitest";
import {
  JARVIS_EVALUATION_CATEGORIES,
  JARVIS_SMOKE_EVALUATION_IDS,
  planJarvisEvaluation,
  selectJarvisEvaluationCases,
} from "@/lib/jarvis/evaluation-profile";
import { JARVIS_LIVE_QUESTION_CORPUS } from "@/lib/jarvis/live-question-corpus";

describe("JARVIS risk-based evaluation profiles", () => {
  it("keeps the smoke gate small, stable, unique and cross-functional", () => {
    const selected = selectJarvisEvaluationCases({ corpus: JARVIS_LIVE_QUESTION_CORPUS, profile: "smoke" });
    expect(selected.map((item) => item.id)).toEqual([...JARVIS_SMOKE_EVALUATION_IDS]);
    expect(new Set(selected.map((item) => item.category)).size).toBe(JARVIS_EVALUATION_CATEGORIES.length);
    expect(selected.length).toBeLessThan(JARVIS_LIVE_QUESTION_CORPUS.length / 4);
  });

  it("adds affected domains to the smoke gate without duplicates", () => {
    const selected = selectJarvisEvaluationCases({
      corpus: JARVIS_LIVE_QUESTION_CORPUS,
      profile: "targeted",
      categories: ["planning", "time"],
    });
    expect(selected.filter((item) => item.category === "planning")).toHaveLength(10);
    expect(selected.filter((item) => item.category === "time")).toHaveLength(10);
    expect(new Set(selected.map((item) => item.id)).size).toBe(selected.length);
  });

  it("requires the release profile for cross-cutting JARVIS changes", () => {
    expect(planJarvisEvaluation(["src/app/api/jarvis/chat/route.ts"])).toMatchObject({
      profile: "release",
      categories: [...JARVIS_EVALUATION_CATEGORIES],
    });
    expect(planJarvisEvaluation(["src/lib/jarvis/action-draft-store.ts"]).profile).toBe("release");
  });

  it("maps normal product changes to affected domain suites", () => {
    expect(planJarvisEvaluation(["src/lib/time/work-duration.ts", "src/app/api/planning-entries/route.ts"])).toMatchObject({
      profile: "targeted",
      categories: ["planning", "time"],
    });
    expect(planJarvisEvaluation(["docs/README.md"]).profile).toBe("smoke");
  });

  it("uses every maintained case for a release", () => {
    expect(selectJarvisEvaluationCases({ corpus: JARVIS_LIVE_QUESTION_CORPUS, profile: "release" }))
      .toEqual(JARVIS_LIVE_QUESTION_CORPUS);
  });
});
