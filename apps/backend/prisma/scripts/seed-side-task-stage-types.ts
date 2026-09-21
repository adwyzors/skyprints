import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const stageTypes = [
    { name: 'Design', code: 'DESIGN', sortOrder: 1 },
    { name: 'Size/Color', code: 'SIZE_COLOR', sortOrder: 2 },
    { name: 'Tracing', code: 'TRACING', sortOrder: 3 },
    { name: 'Exposing', code: 'EXPOSING', sortOrder: 4 },
    { name: 'Sample', code: 'SAMPLE', sortOrder: 5 },
    { name: 'Range', code: 'RANGE', sortOrder: 6 },
    { name: 'Production', code: 'PRODUCTION', sortOrder: 7 },
    { name: 'Waiting', code: 'WAITING', sortOrder: 8 },
    { name: 'Cutting/Weeding', code: 'CUTTING_WEEDING', sortOrder: 9 },
    { name: 'Curing', code: 'CURING', sortOrder: 10 },
    { name: 'Fusing', code: 'FUSING', sortOrder: 11 },
    { name: 'QC & Counting', code: 'QC_COUNTING', sortOrder: 12 },
    { name: 'Var Kata and Kg', code: 'VAR_KATA_KG', sortOrder: 13 },
    { name: 'Accounts', code: 'ACCOUNTS', sortOrder: 14 },
    { name: 'Marketing', code: 'MARKETING', sortOrder: 15 },
  ];

  console.log('Seeding Side Task Stage Types...');

  const activeCodes = new Set(stageTypes.map((st) => st.code));

  // Deactivate any stage types not in the new active list
  await prisma.sideTaskStageType.updateMany({
    where: { code: { notIn: Array.from(activeCodes) } },
    data: { isActive: false },
  });

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
