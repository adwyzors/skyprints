
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getActiveWorkload() {
  try {
    const [byLocation, byReviewer, byExecutor] = await Promise.all([
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
      }),
      prisma.processRun.groupBy({
        by: ['executorId'],
        where: {
          statusCode: { in: ['CONFIGURE', 'IN_PROGRESS'] },
          executorId: { not: null }
        },
        _count: { _all: true }
      })
    ]);

    const locationIds = byLocation.map(l => l.locationId).filter(Boolean);
    const userIds = new Set();
    byReviewer.forEach(r => userIds.add(r.reviewerId));
    byExecutor.forEach(e => userIds.add(e.executorId));
    const managerIds = Array.from(userIds).filter(Boolean);

    const [locations, managers] = await Promise.all([
      prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true }
      }),
      prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true }
      })
    ]);

    const locationMap = new Map(locations.map(l => [l.id, l.name]));
    const managerMap = new Map(managers.map(m => [m.id, m.name]));

    const managerCounts = new Map();
    byReviewer.forEach(r => {
      managerCounts.set(r.reviewerId, (managerCounts.get(r.reviewerId) || 0) + r._count._all);
    });
    byExecutor.forEach(e => {
      managerCounts.set(e.executorId, (managerCounts.get(e.executorId) || 0) + e._count._all);
    });

    return {
      byLocation: byLocation.map(l => ({
        id: l.locationId,
        name: locationMap.get(l.locationId) || 'Unknown Hub',
        count: l._count._all
      })),
      byManager: Array.from(managerCounts.entries()).map(([id, count]) => ({
        id,
        name: managerMap.get(id) || 'Unknown Manager',
        count
      }))
    };
  } catch (error) {
    console.error(error);
    return { byLocation: [], byManager: [] };
  }
}

async function main() {
  const result = await getActiveWorkload();
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
