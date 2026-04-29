import { describe, expect, it } from 'vitest';
import { assertSameTenant, withTenantFilter } from '@/lib/tenant';

describe('tenant isolation', () => {
  const user = { id: 'u1', organizationId: 'tenant-a', role: 'MITARBEITER' as const };

  it('adds organization filter automatically', () => {
    expect(withTenantFilter(user, { id: 'task-1' })).toEqual({ id: 'task-1', organizationId: 'tenant-a' });
  });

  it('throws on tenant mismatch', () => {
    expect(() => assertSameTenant(user, 'tenant-b')).toThrowError(/tenant mismatch/);
  });
});
