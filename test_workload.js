
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find an IN_PROGRESS run
  const inProgressRun = await prisma.processRun.findFirst({
    where: { statusCode: 'IN_PROGRESS' }
  });

  if (!inProgressRun) {
    console.log('No IN_PROGRESS run found to test with.');
    return;
  }

  console.log('Testing with run:', inProgressRun.id);

  // Find a location and a user (manager)
  const location = await prisma.location.findFirst();
  const manager = await prisma.user.findFirst({
    where: { role: { contains: 'MANAGER', mode: 'insensitive' } }
  }) || await prisma.user.findFirst();

  if (!location || !manager) {
    console.log('Could not find location or manager to assign.');
    return;
  }

  // Assign them
  await prisma.processRun.update({
    where: { id: inProgressRun.id },
    data: {
      locationId: location.id,
      reviewerId: manager.id
    }
  });

  console.log(`Assigned run ${inProgressRun.id} to location ${location.name} and manager ${manager.name}`);

  // Now simulate the getActiveWorkload logic
  const [byLocation, byReviewer] = await Promise.all([
    prisma.processRun.groupBy({
      by: ['locationId'],
      where: {
        statusCode: { in: ['CONFIGURE', 'IN_PROGRESS'] },
        locationId: { not: null }
      },
      _count: { _all: true }
    }),
    prisma.processRun.groupBy({
      by: ['reviewerId'],
      where: {
        statusCode: { in: ['CONFIGURE', 'IN_PROGRESS'] },
        reviewerId: { not: null }
      },
      _count: { _all: true }
    })
  ]);

  console.log('Active Workload by Location:', byLocation);
  console.log('Active Workload by Reviewer:', byReviewer);
}

main().catch(console.error).finally(() => prisma.$disconnect());
