const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const t = await prisma.runTemplate.findFirst({ where: { name: 'Direct to Film (DTF)' } });
    console.log('Formula DTF:', t?.billingFormula);
}
main().finally(() => prisma.$disconnect());
