
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.user.groupBy({ by: ['role'] });
  console.log('Roles:', roles);
  const locations = await prisma.location.findMany({ select: { name: true, isActive: true } });
  console.log('Locations:', locations);
}
main().catch(console.error).finally(() => prisma.$disconnect());
