import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { canReadTask, hasMinimumRole } from '@/lib/permissions';

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
});
