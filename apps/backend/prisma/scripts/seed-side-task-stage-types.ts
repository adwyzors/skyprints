import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const stageTypes = [
    { name: 'Orders', code: 'ORDERS', sortOrder: 1 },
    { name: 'Configure', code: 'CONFIGURE', sortOrder: 2 },
    { name: 'Design', code: 'DESIGN', sortOrder: 3 },
    { name: 'Approval', code: 'APPROVAL', sortOrder: 4 },
    { name: 'Production', code: 'PRODUCTION', sortOrder: 5 },
    { name: 'Fusing', code: 'FUSING', sortOrder: 6 },
    { name: 'Curing', code: 'CURING', sortOrder: 7 },
    { name: 'QC', code: 'QC', sortOrder: 8 },
    { name: 'Dispatch', code: 'DISPATCH', sortOrder: 9 },
    { name: 'Completed', code: 'COMPLETED', sortOrder: 10 },
    { name: 'Accounts', code: 'ACCOUNTS', sortOrder: 11 },
    { name: 'Marketing', code: 'MARKETING', sortOrder: 12 },
    { name: 'Sample', code: 'SAMPLE', sortOrder: 13 },
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
