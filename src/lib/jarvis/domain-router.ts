import {
  resolveJarvisIntentDecision,
  type JarvisIntentDomain,
} from "@/lib/jarvis/intent-decision";
import {
  resolveJarvisConversationDomain,
  type JarvisDialogState,
} from "@/lib/jarvis/dialog-state";

export type JarvisDomain = JarvisIntentDomain;

export function resolveJarvisDomain(
  question: string,
  previousState?: JarvisDialogState
): JarvisDomain {
  if (previousState) {
    return resolveJarvisConversationDomain(question, previousState);
  }
  const decision = resolveJarvisIntentDecision(question);
  return decision.state === "resolved" ? decision.domain : "system";
}
