export type ProjectPlanningProgressState = "done" | "partial" | "open";

export function getHourlyRecurringPlanningProgressState(input: {
  confirmedEntries: number;
  requestedEntries: number;
}): ProjectPlanningProgressState {
  if (input.confirmedEntries > 0) return "done";
  if (input.requestedEntries > 0) return "partial";
  return "open";
}
