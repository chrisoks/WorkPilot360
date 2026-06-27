import { Role } from '@prisma/client';
import { SessionUser } from '@/types/auth';

type RoleCarrier = Pick<SessionUser, 'role'> | { role: Role };

export const roleHierarchy: Record<Role, number> = {
  GAST: 10,
  MITARBEITER: 20,
  VERTRIEB: 20,
  BUCHHALTUNG: 20,
  FUEHRUNGSKRAFT: 30,
  GESCHAEFTSFUEHRER: 40,
  ADMIN: 50
};

export function hasMinimumRole(user: SessionUser, minimumRole: Role): boolean {
  return roleHierarchy[user.role] >= roleHierarchy[minimumRole];
}

export function canReadTask(user: SessionUser, task: { ownerId: string; teamId?: string | null }): boolean {
  if (user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER) return true;
  if (user.role === Role.FUEHRUNGSKRAFT) return task.teamId != null && user.teamId === task.teamId;
  if (user.role === Role.MITARBEITER || user.role === Role.VERTRIEB) return task.ownerId === user.id;
  return false;
}

export function canManageOffers(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    user.role === Role.VERTRIEB
  );
}

export function canDeleteOffers(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canManageInvoices(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    user.role === Role.BUCHHALTUNG
  );
}

export function canDeleteInvoices(user: RoleCarrier): boolean {
  return user.role === Role.GESCHAEFTSFUEHRER;
}
