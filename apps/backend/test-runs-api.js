const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.dzunntewqnlgrhtasftz:19TzxyLslGkN1aFy@aws-1-ap-southeast-1.pooler.supabase.com:6543/skyprints_db?pgbouncer=true&connection_limit=1'
    }
  }
});

async function main() {
  console.log("Fetching runs with lifeCycleStatusCode='PRODUCTION'...");

  const runs = await prisma.processRun.findMany({
    where: {
      lifeCycleStatusCode: 'PRODUCTION'
    },
    select: {
      id: true,
      statusCode: true,
      lifeCycleStatusCode: true,
      fields: true,
      orderProcess: {
        select: {
          process: {
            select: {
              id: true,
              name: true
            }
          },
          order: {
            select: {
              statusCode: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${runs.length} runs.`);
  const stats = runs.map(r => ({
    id: r.id,
    runStatus: r.statusCode,
    lifecycleStatus: r.lifeCycleStatusCode,
    processNameInDb: r.orderProcess?.process?.name,
    processIdInDb: r.orderProcess?.process?.id,
    fieldsProcessName: r.fields?.['Process Name'] || r.fields?.process_name,
    orderStatus: r.orderProcess?.order?.statusCode
  }));
  console.log("Stats:", JSON.stringify(stats.slice(0, 10), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
