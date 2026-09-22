import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS } from '../../src/auth/permissions.map';

async function main() {
  const prisma = new PrismaClient();

  console.log('Adding all side_tasks permissions to all user accounts in DB...');

  const logins = await prisma.login.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  const sideTasksPerms = (ROLE_PERMISSIONS.SUPER_ADMIN ?? []).filter((p) =>
    p.startsWith('side_tasks:'),
  );

  let updatedCount = 0;

  for (const loginRecord of logins) {
    const role = loginRecord.user?.role;
    if (!role) continue;

    let currentPerms = loginRecord.permissions ?? [];

    // Ensure all users have all side_tasks permissions added
    currentPerms = Array.from(new Set([...currentPerms, ...sideTasksPerms])).sort();

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
