import {
  resolveJarvisIntentDecision,
  type JarvisIntentDomain,
} from "@/lib/jarvis/intent-decision";

export type JarvisDomain = JarvisIntentDomain;

export function resolveJarvisDomain(question: string): JarvisDomain {
  const decision = resolveJarvisIntentDecision(question);
  return decision.state === "resolved" ? decision.domain : "system";
}
