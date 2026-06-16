import { Role } from '@prisma/client';

export type SessionUser = {
  id: string;
  organizationId: string;
  teamId?: string | null;
  role: Role;
};
