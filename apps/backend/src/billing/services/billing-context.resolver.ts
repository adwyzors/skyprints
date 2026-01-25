import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "apps/backend/prisma/prisma.service";

@Injectable()
export class BillingContextResolver {
    constructor(private readonly prisma: PrismaService) { }

    async resolveOrderContext(
        tx: Prisma.TransactionClient,
        orderId: string
    ) {
        const existing = await tx.billingContext.findFirst({
            where: {
                type: "ORDER",
                orders: {
                    some: { orderId }
                }
            }
        });

        if (existing) return existing;

        return tx.billingContext.create({
            data: {
                type: "ORDER",
                name: `Order Billing ${orderId}`,
                orders: {
                    create: { orderId }
                }
            }
        });
    }
}
