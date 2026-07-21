export type LeadershipStructureInput = {
  employeeId?: string;
  managerId: string | null;
  deputyId: string | null;
  requireManager: boolean;
  managerByUserId?: ReadonlyMap<string, string | null>;
};

export type LeadershipRecipientUser = {
  id: string;
  role: string;
  isActive: boolean;
  leadershipManagerId?: string | null;
  leadershipDeputyId?: string | null;
};

function isLeadershipRole(role: string) {
  return role === "FUEHRUNGSKRAFT" || role === "GESCHAEFTSFUEHRER";
}

export function getLeadershipRecipientId(
  employeeId: string,
  users: readonly LeadershipRecipientUser[]
) {
  const employee = users.find((user) => user.id === employeeId && user.isActive);
  if (!employee) return null;

  const manager = employee.leadershipManagerId
    ? users.find(
        (user) =>
          user.id === employee.leadershipManagerId &&
          user.isActive &&
          isLeadershipRole(user.role)
      )
    : null;
  if (manager && manager.id !== employeeId) return manager.id;

  const deputy = employee.leadershipDeputyId
    ? users.find((user) => user.id === employee.leadershipDeputyId && user.isActive)
    : null;
  return deputy && deputy.id !== employeeId ? deputy.id : null;
}

export function getLeadershipRecipientIds(
  employeeIds: Iterable<string>,
  users: readonly LeadershipRecipientUser[]
) {
  const recipients = new Set<string>();
  for (const employeeId of employeeIds) {
    const recipientId = getLeadershipRecipientId(employeeId, users);
    if (recipientId) recipients.add(recipientId);
  }
  return Array.from(recipients);
}

export function getLeadershipStructureError(input: LeadershipStructureInput) {
  const {
    employeeId,
    managerId,
    deputyId,
    requireManager,
    managerByUserId = new Map<string, string | null>(),
  } = input;

  if (requireManager && !managerId) {
    return "Bitte eine zuständige Führungskraft auswählen.";
  }
  if (managerId && deputyId && managerId === deputyId) {
    return "Führungskraft und Vertretung müssen unterschiedliche Personen sein.";
  }
  if (employeeId && (managerId === employeeId || deputyId === employeeId)) {
    return "Ein Mitarbeiter kann nicht die eigene Führungskraft oder Vertretung sein.";
  }

  if (employeeId && managerId) {
    const visited = new Set<string>();
    let currentId: string | null = managerId;
    while (currentId) {
      if (currentId === employeeId) {
        return "Diese Zuordnung würde einen Führungskreis erzeugen.";
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);
      currentId = managerByUserId.get(currentId) ?? null;
    }
  }

  return null;
}
