/**
 * Creates one ADMIN user in the local database for testing internal auth.
 * Run from apps/backend/:
 *   npx ts-node scripts/seed-admin-user.ts
 *
 * Reads DATABASE_URL from .env.local (dotenv).
 */
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const ADMIN_PERMISSIONS = [
  'orders:view', 'orders:create', 'orders:create-test', 'orders:update', 'orders:delete',
  'orders:reorder', 'orders:start-production',
  'process:view', 'process:create', 'process:update', 'process:delete',
  'runs:view', 'runs:create', 'runs:delete', 'runs:update',
  'runs:lifecycle:rollback', 'runs:lifecycle:update',
  'runs:transition:digital', 'runs:transition:fusing',
  'rates:view', 'rates:create', 'rates:update', 'rates:delete',
  'billings:view', 'billings:create', 'billings:create-test', 'billings:update', 'billings:delete',
  'customers:view', 'customers:create', 'customers:update', 'customers:delete',
  'analytics:view', 'analytics:sync',
  'users:view', 'users:create', 'users:update', 'users:delete',
  'locations:view', 'locations:create', 'locations:update', 'locations:delete', 'locations:all:view',
  'settings:view',
];

const EMAIL    = process.env.SEED_EMAIL    ?? 'admin@skyprints.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@1234';
const NAME     = process.env.SEED_NAME     ?? 'Admin';

async function main() {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findFirst({ where: { email: EMAIL, deletedAt: null } });
    if (existing) {
      console.log(`User ${EMAIL} already exists (id=${existing.id}). Skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: EMAIL, name: NAME, role: 'SUPER_ADMIN', isActive: true },
      });
      await tx.login.create({
        data: {
          userId: u.id,
          passwordHash,
          tokenVersion: 0,
          permissions: ADMIN_PERMISSIONS,
          isActive: true,
        },
      });
      return u;
    });

    console.log(`Created admin user: ${EMAIL} (id=${user.id})`);
    console.log(`Password: ${PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
