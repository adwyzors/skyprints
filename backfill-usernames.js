/**
 * One-time script: sets Login.username = User.email for all existing Login records
 * that have no username yet. Safe to re-run (skips records that already have a username).
 *
 * Run from repo root:
 *   node --require dotenv/config backfill-usernames.js
 *   (loads apps/backend/.env automatically if you set dotenv path, or copy DATABASE_URL to shell first)
 *
 * Or with explicit env:
 *   node -e "require('dotenv').config({ path: 'apps/backend/.env' })" backfill-usernames.js
 */

// Load env from backend .env
require('dotenv').config({ path: 'apps/backend/.env' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logins = await prisma.login.findMany({
    where: { username: null, user: { deletedAt: null } },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (logins.length === 0) {
    console.log('No logins need backfilling — all done.');
    return;
  }

  console.log(`Backfilling ${logins.length} login record(s)...\n`);

  for (const login of logins) {
    const username = login.user.email;
    await prisma.login.update({
      where: { userId: login.userId },
      data: { username },
    });
    console.log(`  ✓  userId=${login.userId}  name="${login.user.name}"  username set to: ${username}`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
