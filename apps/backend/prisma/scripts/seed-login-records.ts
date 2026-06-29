import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_PERMISSIONS } from '../../src/auth/permissions.map';

const TEMP_PASSWORD = 'Admin@123';
const BCRYPT_ROUNDS = 10;

async function main() {
  const prisma = new PrismaClient();

  const usersWithoutLogin = await prisma.user.findMany({
    where: {
      deletedAt: null,
      login: null,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (usersWithoutLogin.length === 0) {
    console.log('No users missing Login records. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${usersWithoutLogin.length} user(s) without a Login record:`);
  for (const u of usersWithoutLogin) {
    console.log(`  - ${u.email} (${u.role}, isActive=${u.isActive})`);
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, BCRYPT_ROUNDS);
  console.log('\nBcrypt hash generated. Creating Login records...\n');

  let created = 0;
  let skipped = 0;

  for (const user of usersWithoutLogin) {
    const permissions: string[] = ROLE_PERMISSIONS[user.role] ?? [];

    if (permissions.length === 0) {
      console.warn(`  WARN: Unknown role "${user.role}" for ${user.email} — Login created with empty permissions.`);
    }

    try {
      await prisma.login.create({
        data: {
          userId: user.id,
          passwordHash,
          permissions,
          tokenVersion: 0,
          isActive: user.isActive,
        },
      });
      console.log(`  ✓ ${user.email} (${user.role}) — ${permissions.length} permissions`);
      created++;
    } catch (err: any) {
      // Unique constraint on userId means a race or duplicate run — skip safely
      console.error(`  ✗ ${user.email} — skipped (${err.message})`);
      skipped++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  console.log(`Temp password set for all created records: ${TEMP_PASSWORD}`);
  console.log('Users must change their password after first login.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
