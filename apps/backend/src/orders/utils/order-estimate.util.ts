import { PrismaExecutor } from '../../../prisma/prisma.service';
import { BillingCalculatorService } from '../../billing/services/billing-calculator.service';

export async function recomputeOrderEstimate(
  tx: PrismaExecutor,
  orderId: string,
  billingCalculator: BillingCalculatorService,
) {
  const runs = await tx.processRun.findMany({
    where: {
      orderProcess: {
        orderId,
      },
    },
    include: {
      runTemplate: true,
    },
  });

  let total = 0;

  for (const run of runs) {
    try {
      const value = billingCalculator.calculateRun(run);
      total += Number(value || 0);
    } catch (e) {
      // DO NOT fail system due to bad run
      continue;
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data: { estimatedAmount: total },
  });
}
