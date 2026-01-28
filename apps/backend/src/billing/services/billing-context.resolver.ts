import { Injectable } from '@nestjs/common';
import { PrismaExecutor } from 'apps/backend/prisma/prisma.service';

@Injectable()
export class BillingContextResolver {
    async resolveOrderContext(
        tx: PrismaExecutor,
        orderId: string,
    ) {
        const existing = await tx.billingContext.findFirst({
            where: {
                type: 'ORDER',
                orders: {
                    some: { orderId },
                },
            },
        });

        if (existing) return existing;

        return tx.billingContext.create({
            data: {
                type: 'ORDER',
                name: `Order Billing ${orderId}`,
                orders: {
                    create: { orderId },
                },
            },
        });
    }
}
