import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const stageTypes = [
    { name: 'Accounts', code: 'ACCOUNTS', sortOrder: 1 },
    { name: 'Marketing', code: 'MARKETING', sortOrder: 2 },
    { name: 'Sample', code: 'SAMPLE', sortOrder: 3 },
  ];

  console.log('Seeding Side Task Stage Types...');

  for (const st of stageTypes) {
    const result = await prisma.sideTaskStageType.upsert({
      where: { code: st.code },
      update: {
        name: st.name,
        sortOrder: st.sortOrder,
        isActive: true,
      },
      create: {
        name: st.name,
        code: st.code,
        sortOrder: st.sortOrder,
        isActive: true,
      },
    });
    console.log(`✓ ${result.name} (${result.code}) - ID: ${result.id}`);
  }

  console.log('Seeding completed successfully.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});
