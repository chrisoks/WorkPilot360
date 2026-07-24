export function shouldAttemptHourlyDraftAttachment(input: {
  mode: unknown;
  completionStatus: unknown;
}) {
  // "Unterbrochen" beschreibt den Projektfortschritt. Die bis dahin
  // geleistete Zeit bleibt bei Stundenabrechnung trotzdem abrechenbar.
  return String(input.mode ?? "").trim() === "project";
}
