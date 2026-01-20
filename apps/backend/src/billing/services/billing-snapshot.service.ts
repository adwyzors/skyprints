import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { OrdersService } from "../../orders/orders.service";
import { BillingCalculatorService } from "./billing-calculator.service";

@Injectable()
export class BillingSnapshotService {
    private readonly logger = new Logger(BillingSnapshotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService,
        private readonly orderService: OrdersService
    ) { }

    async createSnapshot(
        orderId: string,
        dynamicInputs: Record<string, Record<string, number>> = {},
        reason?: string,
        requestedBy?: string
    ) {


        this.logger.log(
            `Processing billing snapshot for orderId=${orderId}`
        );

        await this.prisma.$transaction(async (tx) => {
            const calc =
                await this.calculator.calculateForOrder(
                    orderId,
                    dynamicInputs ?? {}
                );

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
            this.logger.log(
                `Billing snapshot completed orderId=${orderId}`
            );

            await this.orderService.transitionOrderById(tx, orderId)
        });

        return {
            success: true
        };
    }

    async getLatest(orderId: string) {
        return this.prisma.billingSnapshot.findFirst({
            where: { orderId, isLatest: true }
        });
    }

    async getAll(orderId: string) {
        return this.prisma.billingSnapshot.findMany({
            where: { orderId },
            orderBy: { version: "asc" }
        });
    }
}
