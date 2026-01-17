import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";

@Injectable()
export class BillingSnapshotService {
    private readonly logger = new Logger(BillingSnapshotService.name);

    constructor(
        private readonly prisma: PrismaService
    ) { }

    async createSnapshot(
        orderId: string,
        runDynamicInputs: Record<string, Record<string, number>> = {},
        reason?: string,
        requestedBy?: string
    ) {

        const event = await this.prisma.outboxEvent.create({
            data: {
                aggregateType: "ORDER",
                aggregateId: orderId,
                eventType: "BILLING_SNAPSHOT_REQUESTED",
                payload: {
                    orderId,
                    dynamicInputs: runDynamicInputs,
                    reason,
                    requestedBy
                }
            }
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
