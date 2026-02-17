
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const runs = await prisma.processRun.groupBy({
    by: ['statusCode'],
    _count: { _all: true }
  });
  console.log('ProcessRun Status Counts:', runs);

  const assignedRuns = await prisma.processRun.findMany({
    where: { 
      OR: [
        { locationId: { not: null } },
        { reviewerId: { not: null } },
        { executorId: { not: null } }
      ]
    },
    take: 5,
    select: {
      id: true,
      statusCode: true,
      locationId: true,
      reviewerId: true,
      executorId: true
    }
  });
  console.log('Assigned Runs Sample:', assignedRuns);

  const locations = await prisma.location.findMany({
    select: { id: true, name: true }
  });
  console.log('Locations:', locations);
}

main().catch(console.error).finally(() => prisma.$disconnect());
