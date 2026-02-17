
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeOrderStatuses = [
    'CONFIGURE',
    'PRODUCTION_READY',
    'IN_PRODUCTION',
    'COMPLETE'
  ];

  const [byLocation] = await Promise.all([
    prisma.processRun.groupBy({
      by: ['locationId'],
      where: {
        locationId: { not: null },
        orderProcess: {
          order: {
            statusCode: { in: activeOrderStatuses }
          }
        }
      },
      _count: { _all: true }
    })
  ]);

  console.log('Workload with expanded status:', byLocation);

  // Sample check for why it might be empty
  const sample = await prisma.processRun.findFirst({
    where: { locationId: { not: null } },
    include: { orderProcess: { include: { order: true } } }
  });
  
  if (sample) {
    console.log('Sample run status:', sample.statusCode);
    console.log('Sample order status:', sample.orderProcess.order.statusCode);
  } else {
    console.log('No assigned runs found at all.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
