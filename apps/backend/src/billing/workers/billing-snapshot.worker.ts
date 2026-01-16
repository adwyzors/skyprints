import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { console } from "inspector";
import { BillingCalculatorService } from "../services/billing-calculator.service";

@Injectable()
export class BillingSnapshotWorker {
    private readonly logger = new Logger(BillingSnapshotWorker.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService
    ) { }

    async handle(event: any) {
        const {
            orderId,
            dynamicInputs,
            reason,
            requestedBy
        } = event.payload;

        this.logger.log(
            `Processing billing snapshot for orderId=${orderId}`
        );

        await this.prisma.$transaction(async (tx) => {
            const last = await tx.billingSnapshot.findFirst({
                where: { orderId, isLatest: true },
                orderBy: { version: "desc" }
            });

            const version = last ? last.version + 1 : 1;

            if (last) {
                await tx.billingSnapshot.update({
                    where: { id: last.id },
                    data: { isLatest: false }
                });
            }

            const calc =
                await this.calculator.calculateForOrder(
                    orderId,
                    dynamicInputs ?? {}
                );

            await tx.billingSnapshot.create({
                data: {
                    orderId,
                    version,
                    isLatest: true,
                    formula: calc.formula,
                    formulaChecksum: calc.checksum,
                    inputs: calc.inputs,
                    result: calc.result,
                    currency: "INR",
                    source: last ? "RECALCULATION" : "SYSTEM",
                    reason,
                    createdBy: requestedBy
                }
            });
        });

        this.logger.log(
            `Billing snapshot completed orderId=${orderId}`
        );

        await this.prisma.outboxEvent.create({
            data: {
                aggregateType: 'Order',
                aggregateId: orderId,
                eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                payload: { reason: 'BILLING_COMPLETE' },
            },
        });
    }
}
