import { SessionUser } from '@/types/auth';

export function assertSameTenant(user: SessionUser, organizationId: string): void {
  if (user.organizationId !== organizationId) {
    throw new Error('Forbidden: tenant mismatch');
  }
}

export function withTenantFilter<T extends object>(user: SessionUser, where: T): T & { organizationId: string } {
  return { ...where, organizationId: user.organizationId };
}
