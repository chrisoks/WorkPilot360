import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  canAccessEmployeeCosts,
  canEditTask,
  canManageProcessAutomation,
  canReadTask,
  canViewCustomerRevenueAnalytics,
  canViewCustomerRevenueAnalyticsDetails,
  canViewInternalCostData,
  hasMinimumRole,
} from '@/lib/permissions';

describe('permissions', () => {
  it('allows leadership to read own team tasks', () => {
    const user = { id: 'u1', organizationId: 'o1', teamId: 't1', role: Role.FUEHRUNGSKRAFT };
    expect(canReadTask(user, { ownerId: 'u2', teamId: 't1' })).toBe(true);
    expect(canReadTask(user, { ownerId: 'u2', teamId: 't2' })).toBe(false);
  });

  it('enforces minimum role', () => {
    const user = { id: 'u1', organizationId: 'o1', role: Role.MITARBEITER };
    expect(hasMinimumRole(user, Role.GAST)).toBe(true);
    expect(hasMinimumRole(user, Role.FUEHRUNGSKRAFT)).toBe(false);
  });

  it('separates task visibility from task editing rights', () => {
    const participant = { id: 'u1', organizationId: 'o1', teamId: 't1', role: Role.MITARBEITER };
    const ownTeamLead = { id: 'u2', organizationId: 'o1', teamId: 't1', role: Role.FUEHRUNGSKRAFT };
    const otherTeamLead = { id: 'u3', organizationId: 'o1', teamId: 't2', role: Role.FUEHRUNGSKRAFT };
    const task = {
      ownerId: 'owner',
      createdById: 'creator',
      teamId: 't1',
      participantUserIds: ['u1'],
    };

    expect(canReadTask(participant, task)).toBe(true);
    expect(canEditTask(participant, task)).toBe(false);
    expect(canEditTask(ownTeamLead, task)).toBe(true);
    expect(canEditTask(otherTeamLead, task)).toBe(false);
  });

  it('limits internal cost access to admin and management roles', () => {
    const admin = { id: 'u1', organizationId: 'o1', role: Role.ADMIN };
    const management = { id: 'u2', organizationId: 'o1', role: Role.GESCHAEFTSFUEHRER };
    const employee = {
      id: 'u3',
      organizationId: 'o1',
      role: Role.MITARBEITER,
      firstName: 'Christian',
      lastName: 'Eid',
    };

    expect(canViewInternalCostData(admin)).toBe(true);
    expect(canViewInternalCostData(management)).toBe(true);
    expect(canViewInternalCostData(employee)).toBe(false);
    expect(canAccessEmployeeCosts(employee)).toBe(false);
  });

  it('allows safe customer revenue aggregates without exposing them to guests', () => {
    expect(canViewCustomerRevenueAnalytics({ role: Role.ADMIN })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.FUEHRUNGSKRAFT })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.MITARBEITER })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.VERTRIEB })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.BUCHHALTUNG })).toBe(true);
    expect(canViewCustomerRevenueAnalytics({ role: Role.GAST })).toBe(false);
  });

  it('limits customer revenue invoice details to invoice-management roles', () => {
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.ADMIN })).toBe(true);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.FUEHRUNGSKRAFT })).toBe(true);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.BUCHHALTUNG })).toBe(true);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.MITARBEITER })).toBe(false);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.VERTRIEB })).toBe(false);
    expect(canViewCustomerRevenueAnalyticsDetails({ role: Role.GAST })).toBe(false);
  });

  it('limits process automation to operational leadership', () => {
    expect(canManageProcessAutomation({ role: Role.ADMIN })).toBe(true);
    expect(canManageProcessAutomation({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
    expect(canManageProcessAutomation({ role: Role.FUEHRUNGSKRAFT })).toBe(true);
    expect(canManageProcessAutomation({ role: Role.MITARBEITER })).toBe(false);
    expect(canManageProcessAutomation({ role: Role.VERTRIEB })).toBe(false);
    expect(canManageProcessAutomation({ role: Role.BUCHHALTUNG })).toBe(false);
  });
});
