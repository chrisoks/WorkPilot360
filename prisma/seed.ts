import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-gmbh' },
    update: {},
    create: { name: 'Demo GmbH', slug: 'demo-gmbh', locale: 'de' }
  });

  const department = await prisma.department.create({ data: { name: 'Operations', organizationId: org.id } });
  const team = await prisma.team.create({ data: { name: 'Team Alpha', organizationId: org.id, departmentId: department.id } });

  const users = [
    { email: 'admin@demo.local', role: Role.ADMIN, firstName: 'Ada', lastName: 'Admin' },
    { email: 'ceo@demo.local', role: Role.GESCHAEFTSFUEHRER, firstName: 'Gina', lastName: 'CEO' },
    { email: 'lead@demo.local', role: Role.FUEHRUNGSKRAFT, firstName: 'Lars', lastName: 'Lead' },
    { email: 'mitarbeiter1@demo.local', role: Role.MITARBEITER, firstName: 'Mia', lastName: 'Mitarbeiter' },
    { email: 'mitarbeiter2@demo.local', role: Role.MITARBEITER, firstName: 'Max', lastName: 'Mitarbeiter' }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: user.email } },
      update: {},
      create: {
        ...user,
        passwordHash: await bcrypt.hash('Passwort123!', 10),
        organizationId: org.id,
        departmentId: department.id,
        teamId: team.id
      }
    });
  }
}

main().finally(async () => prisma.$disconnect());
