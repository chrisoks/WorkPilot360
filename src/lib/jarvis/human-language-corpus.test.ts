import { describe, expect, it } from "vitest";
import { resolveJarvisEnterpriseInsightIntent } from "@/lib/jarvis/enterprise-insights";
import { JARVIS_HUMAN_LANGUAGE_CORPUS } from "@/lib/jarvis/human-language-corpus";
import { resolveJarvisManagementCompositeTopics } from "@/lib/jarvis/management-composite";
import { isJarvisBroadNaturalEntry } from "@/lib/jarvis/natural-entry";
import { parseJarvisTeamSlotQuery } from "@/lib/jarvis/team-slot-finder";

describe("JARVIS versioned human-language contract", () => {
  it("contains a stable broad corpus in addition to the risk-based reference evaluation", () => {
    expect(JARVIS_HUMAN_LANGUAGE_CORPUS).toHaveLength(156);
    expect(new Set(JARVIS_HUMAN_LANGUAGE_CORPUS.map((item) => item.id)).size).toBe(156);
  });

  it.each(JARVIS_HUMAN_LANGUAGE_CORPUS)("understands $id: $question", (item) => {
    if (item.family === "broad_entry") {
      expect(isJarvisBroadNaturalEntry(item.question)).toBe(true);
      return;
    }
    if (item.family === "team_slot") {
      expect(parseJarvisTeamSlotQuery(item.question)).toMatchObject({
        recognized: true,
        employeeCount: item.employeeCount,
        durationMinutes: item.durationMinutes,
      });
      return;
    }
    if (item.family === "enterprise") {
      expect(resolveJarvisEnterpriseInsightIntent(item.question)).toBe(item.intent);
      return;
    }
    expect(resolveJarvisManagementCompositeTopics(item.question)).toEqual(item.topics);
  });
});
