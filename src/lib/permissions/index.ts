import { Role } from '@prisma/client';
import { SessionUser } from '@/types/auth';

type RoleCarrier = (Pick<SessionUser, 'role'> | { role: Role }) & { salesRoleEnabled?: boolean | null };
type TaskAccessUser =
  | Pick<SessionUser, 'id' | 'role' | 'teamId'>
  | { id: string; role: Role; teamId?: string | null };
type TaskAccessTarget = {
  ownerId: string;
  teamId?: string | null;
  createdById?: string | null;
  participantUserIds?: string[];
};

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

function hasSalesAccess(user: RoleCarrier): boolean {
  return user.role === Role.VERTRIEB || user.salesRoleEnabled === true;
}

export function canReadTask(user: TaskAccessUser, task: TaskAccessTarget): boolean {
  if (user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER) return true;
  if (user.role === Role.FUEHRUNGSKRAFT) return task.teamId != null && user.teamId === task.teamId;
  if (task.ownerId === user.id || task.createdById === user.id) return true;
  if (task.participantUserIds?.includes(user.id)) return true;
  return false;
}

export function canEditTask(user: TaskAccessUser, task: TaskAccessTarget): boolean {
  if (task.ownerId === user.id || task.createdById === user.id) return true;
  return canAssignTasksToOthers(user) && canReadTask(user, task);
}

export function canManageOffers(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    hasSalesAccess(user)
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

export function canManageUsers(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canManageTeams(user: RoleCarrier): boolean {
  return canManageUsers(user);
}

export function canManagePersonalNumber(user: RoleCarrier): boolean {
  return user.role === Role.GESCHAEFTSFUEHRER;
}

export function canManageEmployeeAssessments(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canViewInternalCostData(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canViewCustomerRevenueAnalytics(user: RoleCarrier): boolean {
  return user.role !== Role.GAST;
}

export function canViewCustomerRevenueAnalyticsDetails(user: RoleCarrier): boolean {
  return canManageInvoices(user);
}

export function canAccessEmployeeCosts(user: RoleCarrier): boolean {
  return canViewInternalCostData(user);
}

export function canManageProjectTimeEntries(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    user.role === Role.BUCHHALTUNG
  );
}

export function canApproveProjectOvertime(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT
  );
}

export function canAssignTasksToOthers(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT
  );
}

export function canDeleteTasks(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canManageTaskTimeEntries(user: RoleCarrier): boolean {
  return canAssignTasksToOthers(user);
}

export function canManageMasterData(user: RoleCarrier): boolean {
  return user.role === Role.ADMIN || user.role === Role.GESCHAEFTSFUEHRER;
}

export function canManageCatalogItems(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageUnits(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageTrades(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageBusinessAreaTargets(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageProjectMarketingQuotas(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageStatusRules(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageEscalationRules(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canRunStatusEscalations(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT
  );
}

export function canMaintainStatusTimeline(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canManagePlanningEntries(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canCreateFixedPlanningEntries(user: RoleCarrier): boolean {
  return canManagePlanningEntries(user) || hasSalesAccess(user);
}

export function canManageSalesPipeline(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    hasSalesAccess(user)
  );
}

export function canManageProcessAutomation(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canManageAllSalesPipeline(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT
  );
}

export function canAssignSalesItemsToOthers(user: RoleCarrier): boolean {
  return canManageAllSalesPipeline(user);
}

export function canManageOwnedSalesItem(
  user: RoleCarrier & { id: string },
  item: { ownerUserId?: string | null }
): boolean {
  return canManageAllSalesPipeline(user) || (canManageSalesPipeline(user) && item.ownerUserId === user.id);
}

export function canCreateProjectPotentials(user: RoleCarrier): boolean {
  return user.role !== Role.GAST;
}

export function canManageProjects(user: RoleCarrier): boolean {
  return canManageSalesPipeline(user);
}

export function canReadOnlineRequests(user: RoleCarrier): boolean {
  return canManageSalesPipeline(user);
}

export function canManageOnlineRequests(user: RoleCarrier): boolean {
  return canManageSalesPipeline(user);
}

export function canConvertOnlineRequests(user: RoleCarrier): boolean {
  return canManageProjects(user);
}

export function canReviewProjects(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canArchiveProjects(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canCreateProjectLogbookEntries(user: RoleCarrier): boolean {
  return user.role !== Role.GAST;
}

export function canManageProjectLogbookAttachments(user: RoleCarrier): boolean {
  return canManageProjects(user);
}

export function canManageDocumentConfiguration(user: RoleCarrier): boolean {
  return canManageMasterData(user);
}

export function canManageDocumentTypes(user: RoleCarrier): boolean {
  return canManageDocumentConfiguration(user);
}

export function canManageDocumentTexts(user: RoleCarrier): boolean {
  return canManageDocumentConfiguration(user);
}

export function canSendDocumentMails(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    hasSalesAccess(user) ||
    user.role === Role.BUCHHALTUNG
  );
}

export function canSendOfferDocuments(user: RoleCarrier): boolean {
  return canManageOffers(user);
}

export function canSendInvoiceDocuments(user: RoleCarrier): boolean {
  return canManageInvoices(user) || hasSalesAccess(user);
}

export function canReadCustomerFeedback(user: RoleCarrier): boolean {
  return canSendDocumentMails(user);
}

export function canManageCustomerFeedback(user: RoleCarrier): boolean {
  return canSendDocumentMails(user);
}

export function canDeleteCustomerFeedback(user: RoleCarrier): boolean {
  return user.role === Role.GESCHAEFTSFUEHRER;
}

export function canReadCustomerFeedbackRequests(user: RoleCarrier): boolean {
  return canReadCustomerFeedback(user);
}

export function canManageCustomerFeedbackRequests(user: RoleCarrier): boolean {
  return canManageCustomerFeedback(user);
}

export function canReadContacts(user: RoleCarrier): boolean {
  return canSendDocumentMails(user);
}

export function canManageContacts(user: RoleCarrier): boolean {
  return canSendDocumentMails(user);
}

export function canMarkContactsForDeletion(user: RoleCarrier): boolean {
  return (
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    hasSalesAccess(user)
  );
}

export function canDeleteContacts(user: RoleCarrier): boolean {
  return user.role === Role.GESCHAEFTSFUEHRER;
}

export function canCreateNotifications(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    user.role === Role.BUCHHALTUNG
  );
}

export function canManageAbsences(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT
  );
}

export function canUseIdeaStore(user: RoleCarrier): boolean {
  return user.role !== Role.GAST;
}

export function canManageIdeaStore(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canManageContentItems(user: RoleCarrier): boolean {
  return canRunStatusEscalations(user);
}

export function canRunUnbilledTimeAlerts(user: RoleCarrier): boolean {
  return (
    user.role === Role.ADMIN ||
    user.role === Role.GESCHAEFTSFUEHRER ||
    user.role === Role.FUEHRUNGSKRAFT ||
    user.role === Role.BUCHHALTUNG
  );
}
