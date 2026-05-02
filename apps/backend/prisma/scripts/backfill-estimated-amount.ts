import { PrismaClient } from '@prisma/client';
import { BillingCalculatorService } from '../../src/billing/services/billing-calculator.service';
import { recomputeOrderEstimate } from '../../src/orders/utils/order-estimate.util';
import { FormulaCompiler } from '../../src/billing/formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../../src/billing/formula/math-only.formula.engine';

async function main() {
  const prisma = new PrismaClient();
  const compiler = new FormulaCompiler();
  const engine = new MathOnlyFormulaEngine();
  const billingCalculator = new BillingCalculatorService(prisma as any, compiler, engine);

  const orders = await prisma.order.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  console.log(`Backfilling ${orders.length} orders...`);

  const batchSize = 5;
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    await Promise.all(
      batch.map((order) =>
        recomputeOrderEstimate(prisma as any, order.id, billingCalculator)
      ),
    );
    console.log(`Processed ${i + batch.length} / ${orders.length}`);
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
