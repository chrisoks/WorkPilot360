export class ProjectMasterdataConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectMasterdataConflictError";
  }
}

export function getProtectedProjectLifecycleState(current: {
  status: string;
  statusCode: string | null;
} | null) {
  return current
    ? { status: current.status, statusCode: current.statusCode }
    : { status: "Lead / Klärung", statusCode: "lead" };
}

export function assertCurrentProjectMasterdataVersion(input: {
  currentUpdatedAt: Date;
  expectedUpdatedAt: unknown;
}) {
  const expected = typeof input.expectedUpdatedAt === "string"
    ? new Date(input.expectedUpdatedAt)
    : null;
  if (!expected || Number.isNaN(expected.getTime())) {
    throw new ProjectMasterdataConflictError(
      "Das Projekt muss vor dem Speichern neu geladen werden. Eine Versionsangabe fehlt."
    );
  }
  if (expected.getTime() !== input.currentUpdatedAt.getTime()) {
    throw new ProjectMasterdataConflictError(
      "Das Projekt wurde zwischenzeitlich geändert. Bitte neu laden und die Eingaben erneut prüfen."
    );
  }
}
