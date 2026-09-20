import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSIONS } from '../../src/auth/permissions.map';

async function main() {
  const prisma = new PrismaClient();

  console.log('Syncing Login permissions for all active user roles...');

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

    const targetPermissions = ROLE_PERMISSIONS[role] ?? [];
    if (targetPermissions.length === 0) continue;

    // Merge existing permissions with target role permissions to ensure super admins and users get all permissions
    const mergedPermissions = Array.from(
      new Set([...(loginRecord.permissions ?? []), ...targetPermissions]),
    ).sort();

    await prisma.login.update({
      where: { id: loginRecord.id },
      data: {
        permissions: mergedPermissions,
      },
    });

    console.log(`✓ Updated ${loginRecord.user.email} (${role}): ${mergedPermissions.length} permissions`);
    updatedCount++;
  }

  console.log(`Successfully synced permissions for ${updatedCount} user login record(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Permission sync failed:', e);
  process.exit(1);
});
