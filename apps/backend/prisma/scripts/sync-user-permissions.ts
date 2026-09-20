import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS } from '../../src/auth/permissions.map';

async function main() {
  const prisma = new PrismaClient();

  console.log('Stripping side_tasks permissions from DB for non-SuperAdmin accounts...');

  const logins = await prisma.login.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  let updatedCount = 0;

  for (const loginRecord of logins) {
    const role = loginRecord.user?.role;
    if (!role) continue;

    let currentPerms = loginRecord.permissions ?? [];

    if (role === 'SUPER_ADMIN') {
      // Ensure SUPER_ADMIN has all side_tasks permissions
      const superAdminPerms = ROLE_PERMISSIONS.SUPER_ADMIN ?? [];
      currentPerms = Array.from(new Set([...currentPerms, ...superAdminPerms])).sort();
    } else {
      // Strip any side_tasks permissions from DB for non-SuperAdmin users
      currentPerms = currentPerms.filter((p) => !p.startsWith('side_tasks:'));
    }

    await prisma.login.update({
      where: { id: loginRecord.id },
      data: {
        permissions: currentPerms,
      },
    });

    console.log(`✓ Updated DB permissions for ${loginRecord.user.email} (${role}): ${currentPerms.length} active permissions`);
    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} user login record(s) in the database.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Permission sync failed:', e);
  process.exit(1);
});
