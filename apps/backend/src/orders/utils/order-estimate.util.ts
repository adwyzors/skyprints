import { PrismaExecutor } from '../../../prisma/prisma.service';
import { BillingCalculatorService } from '../../billing/services/billing-calculator.service';

export async function recomputeOrderEstimate(
  tx: PrismaExecutor,
  orderId: string,
  billingCalculator: BillingCalculatorService,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { quantity: true },
  });
  const orderQuantity = order?.quantity ?? 0;

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
      const fields = (run.fields as Record<string, any>) || {};
      // Check both human-readable and normalized keys
      const value =
        fields['Estimated Amount'] ?? fields['estimated_amount'] ?? 0;

      // Clean and parse if it's a string (e.g. "9,999.00")
      const numValue =
        typeof value === 'string'
          ? parseFloat(value.replace(/[^0-9.-]+/g, ''))
          : Number(value);

      total += isNaN(numValue) ? 0 : numValue;
    } catch (e) {
      continue;
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data: { estimatedAmount: total },
  });
}
