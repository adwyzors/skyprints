import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  console.log('Clearing all SideTask and SideTaskStageHistory records...');

  const deletedHistories = await prisma.sideTaskStageHistory.deleteMany({});
  console.log(`✓ Deleted ${deletedHistories.count} stage history record(s).`);

  const deletedTasks = await prisma.sideTask.deleteMany({});
  console.log(`✓ Deleted ${deletedTasks.count} side task record(s).`);

  // Reset fiscal sequence for prefix 'ST' if present
  try {
    await prisma.fiscalSequence.deleteMany({
      where: { prefix: 'ST' },
    });
    console.log('✓ Reset FiscalSequence counter for ST prefix.');
  } catch (err) {
    console.log('No FiscalSequence entry to reset for ST prefix.');
  }

  console.log('Side task cleanup completed successfully.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});
