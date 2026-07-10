import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  canAccessEmployeeCosts,
  canEditTask,
  canReadTask,
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
});
