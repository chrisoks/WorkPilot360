import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { canAccessEmployeeCosts, canReadTask, canViewInternalCostData, hasMinimumRole } from '@/lib/permissions';

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
