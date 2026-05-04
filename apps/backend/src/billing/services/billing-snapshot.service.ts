import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import { Injectable } from "@nestjs/common";
import { BillingSnapshotIntent, CalculationType, OrderStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import pLimit from 'p-limit';
import { AnalyticsService } from "../../analytics/analytics.service";
import { ContextLogger } from "../../common/logger/context.logger";
import { OrdersService } from "../../orders/orders.service";
import {
    isOrderBillingInputs,
    OrderBillingInputs
} from "../types/billing-snapshot.types";
import { BillingCalculatorService } from "./billing-calculator.service";
import { BillingContextResolver } from "./billing-context.resolver";


@Injectable()
export class BillingSnapshotService {
    private readonly logger = new ContextLogger(BillingSnapshotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService,
        private readonly contextResolver: BillingContextResolver,
        private readonly ordersService: OrdersService,
        private readonly analyticsService: AnalyticsService
    ) { }

    private async adjustCustomerOutstanding(
        tx: Prisma.TransactionClient,
        orderId: string,
        amount: Decimal,
        isAdd: boolean
    ) {
        if (amount.isZero()) return;

        const order = await tx.order.findUnique({
            where: { id: orderId },
            select: { customerId: true }
        });

        if (order?.customerId) {
            const decimalAmount = new Prisma.Decimal(amount.toString());
            await tx.customer.update({
                where: { id: order.customerId },
                data: {
                    outstandingAmount: isAdd
                        ? { increment: decimalAmount }
                        : { decrement: decimalAmount }
                }
            });
            this.logger.log(`[OUTSTANDING] ${isAdd ? 'Added' : 'Subtracted'} ${decimalAmount} to customer ${order.customerId} for order ${orderId}`);
        }
    }

    private async saveDraftTx(
        tx: Prisma.TransactionClient,
        billingContextId: string,
        inputs: any,
        intent: BillingSnapshotIntent,
        reason?: string,
        createdBy?: string,
    ) {
        this.logger.debug(
            `[saveDraftTx] billingContextId=${billingContextId} createdBy=${createdBy ?? 'system'}`,
        );

        // 1️⃣ Invalidate previous latest snapshot (atomic, indexed)
        await tx.billingSnapshot.updateMany({
            where: {
                billingContextId,
                intent,
                isLatest: true,
            },
            data: { isLatest: false },
        });

        // 2️⃣ Compute next version safely (O(1))
        const { _max } = await tx.billingSnapshot.aggregate({
            where: { billingContextId },
            _max: { version: true },
        });

        const version = (_max.version ?? 0) + 1;

        this.logger.debug(
            `[saveDraftTx] Creating snapshot version=${version} intent=${intent}`,
        );

        // 3️⃣ Create new snapshot
        return tx.billingSnapshot.create({
            data: {
                billingContextId,
                version,
                isLatest: true,
                intent,
                inputs,
                result: new Prisma.Decimal(0),
                currency: 'INR',
                calculationType: CalculationType.INITIAL,
                reason,
                createdBy,
            },
        });
    }



    public async createGroupSnapshot(
        billingContextId: string,
        createdBy?: string
    ) {
        this.logger.log(
            `[createGroupSnapshot] billingContextId=${billingContextId}`
        );

        return this.createGroupSnapshotTx(
            billingContextId,
            {},
            createdBy
        );
    }



    public async createGroupSnapshotTx(
        billingContextId: string,
        inputRequest: Record<
            string,
            Record<string, Record<string, number>>
        >,
        createdBy?: string,
    ) {
        this.logger.debug(
            `[createGroupSnapshotTx] billingContextId=${billingContextId}`,
        );

        /* -------------------------------
           1️⃣ Load context + orders (LEAN)
        ------------------------------- */
        const context = await this.prisma.billingContext.findUnique({
            where: { id: billingContextId },
            select: {
                id: true,
                type: true,
                orders: {
                    select: {
                        orderId: true,
                    },
                },
            },
        });

        if (!context || context.type !== 'GROUP') {
            throw new Error('Invalid GROUP billing context');
        }

        if (!context.orders.length) {
            throw new Error('Cannot create group snapshot without orders');
        }

        const orderIds = context.orders.map(o => o.orderId);

        /* -------------------------------
           2️⃣ Finalize orders (BOUNDED PARALLELISM)
        ------------------------------- */
        if (inputRequest && Object.keys(inputRequest).length) {
            const limit = pLimit(7);

            await Promise.all(
                Object.entries(inputRequest).map(
                    ([orderId, orderInputs]) =>
                        limit(() =>
                            this.finalizeOrder(
                                orderId,
                                orderInputs as OrderBillingInputs,
                                BillingSnapshotIntent.FINAL,
                                'GROUP_RECALCULATION',
                                createdBy,
                            ),
                        ),
                ),
            );
        }

        /* -------------------------------
           3️⃣ Load latest FINAL snapshots ONLY
           (no version ordering needed)
        ------------------------------- */
        const orderSnapshots = await this.prisma.billingSnapshot.findMany({
            where: {
                intent: 'FINAL',
                isLatest: true,
                billingContext: {
                    type: 'ORDER',
                    orders: {
                        some: {
                            orderId: { in: orderIds },
                        },
                    },
                },
            },
            select: {
                inputs: true,
                billingContext: {
                    select: {
                        orders: {
                            select: { orderId: true },
                        },
                    },
                },
            },
        });

        /* -------------------------------
           4️⃣ Map snapshots by orderId (O(n))
        ------------------------------- */
        const snapshotByOrderId = new Map<string, OrderBillingInputs>();

        for (const snapshot of orderSnapshots) {
            for (const o of snapshot.billingContext.orders) {
                snapshotByOrderId.set(
                    o.orderId,
                    snapshot.inputs as OrderBillingInputs,
                );
            }
        }

        /* -------------------------------
           5️⃣ Build calculation inputs
        ------------------------------- */
        const inputs: {
            orderId: string;
            inputs: OrderBillingInputs;
        }[] = [];

        for (const orderId of orderIds) {
            const orderInputs = snapshotByOrderId.get(orderId);

            if (!orderInputs) {
                throw new Error(
                    `Missing FINAL snapshot for order=${orderId}`,
                );
            }

            if (!isOrderBillingInputs(orderInputs)) {
                throw new Error(
                    `Invalid billing inputs for order=${orderId}`,
                );
            }

            inputs.push({ orderId, inputs: orderInputs });
        }

        /* -------------------------------
           6️⃣ Calculate (NO TX)
        ------------------------------- */
        const calc =
            await this.calculator.calculateForGroupFromSnapshots(
                inputs,
            );

        /* -------------------------------
           7️⃣ Create GROUP snapshot (SHORT TX)
        ------------------------------- */
        const snapshot = await this.prisma.transaction(async tx => {
            const { _max } = await tx.billingSnapshot.aggregate({
                where: { billingContextId },
                _max: { version: true },
            });

            const version = (_max.version ?? 0) + 1;

            const s = await tx.billingSnapshot.create({
                data: {
                    billingContextId,
                    version,
                    intent: 'FINAL',
                    isLatest: true,
                    inputs: Object.fromEntries(
                        Object.entries(calc.perOrderCalculations).map(([orderId, orderCalc]) => [
                            orderId,
                            {
                                ...orderCalc.inputs,
                                '__ORDER_RESULT__': orderCalc.result.toString()
                            }
                        ])
                    ),
                    result: calc.result,
                    currency: 'INR',
                    calculationType: CalculationType.RECALCULATED,
                    createdBy,
                },
            });

            // 🔑 HANDLE OUTSTANDING ADJUSTMENT (REDUCE ON INVOICE)
            if (s.version === 1) {
                for (const orderId of orderIds) {
                    const order = await tx.order.findUnique({
                        where: { id: orderId },
                        select: { estimatedAmount: true, customerId: true, statusCode: true }
                    });

                    // Only subtract if it was in a post-config status (meaning it was added to outstanding)
                    if (order && ([OrderStatus.PRODUCTION_READY, OrderStatus.IN_PRODUCTION, OrderStatus.COMPLETE] as OrderStatus[]).includes(order.statusCode)) {
                        const amount = new Prisma.Decimal(order.estimatedAmount.toString());
                        if (!amount.isZero()) {
                            await tx.customer.update({
                                where: { id: order.customerId },
                                data: { outstandingAmount: { decrement: amount } }
                            });
                            this.logger.log(`[OUTSTANDING] Subtracted ${amount} from customer ${order.customerId} for order ${orderId} (Group Billed)`);
                        }
                    }
                }

                // Transition status
                await tx.order.updateMany({
                    where: {
                        id: { in: orderIds },
                        statusCode: { not: OrderStatus.GROUP_BILLED },
                    },
                    data: { statusCode: OrderStatus.GROUP_BILLED },
                });

                // Track Analytics
                for (const orderId of orderIds) {
                    const orderCalc = calc.perOrderCalculations[orderId];
                    if (orderCalc) {
                        await this.analyticsService.trackOrderFinalized(orderId, Number(orderCalc.result), s.createdAt);
                    }
                }
            } else {
                // Re-billing: No adjustment needed if we only track WIP in outstandingAmount
            }

            return s;
        });

        return snapshot;
    }

    /* =====================================================
       INTERNAL — finalize context
    ===================================================== */
    private async finalizeContextTx(
        tx: Prisma.TransactionClient,
        draftId: string,
        result: Decimal,
        snapshotInputs: any,
        createdBy?: string
    ) {
        this.logger.log(
            `[finalizeContextTx] Finalizing snapshot id=${draftId}`
        );

        return tx.billingSnapshot.update({
            where: { id: draftId },
            data: {
                intent: "FINAL",
                inputs: snapshotInputs,
                result,
                calculationType: "RECALCULATED",
                createdBy
            }
        });
    }



    async finalizeOrder(
        orderId: string,
        inputs: OrderBillingInputs,
        intent: BillingSnapshotIntent,
        reason?: string,
        createdBy?: string,
    ) {
        this.logger.log(`[finalizeOrder] orderId=${orderId}`);

        /* -------------------------------
           1️⃣ Resolve context (NO TX)
        ------------------------------- */
        const context =
            await this.contextResolver.resolveOrderContext(
                this.prisma,
                orderId,
            );

        /* -------------------------------
           2️⃣ Save DRAFT (SHORT TX)
        ------------------------------- */
        const { contextId, draftId } =
            await this.prisma.transaction(async tx => {
                const draft = await this.saveDraftTx(
                    tx,
                    context.id,
                    inputs,
                    intent,
                    reason,
                    createdBy,
                );

                return { contextId: context.id, draftId: draft.id };
            });

        /* -------------------------------
           3️⃣ Calculate (NO TX)
        ------------------------------- */
        const calc =
            await this.calculator.calculateForOrder(
                orderId,
                inputs,
            );

        /* -------------------------------
           4️⃣ Finalize snapshot (SHORT TX)
        ------------------------------- */
        const snapshot = await this.prisma.transaction(async tx => {
            const s = await this.finalizeContextTx(
                tx,
                draftId,
                calc.result,
                {
                    ...calc.inputs,
                    '__ORDER_RESULT__': calc.result.toString()
                },
                createdBy,
            );

            // 🔑 HANDLE OUTSTANDING ADJUSTMENT (REDUCE ON INVOICE)
            this.logger.log(`[finalizeOrder] orderId=${orderId}, s.version=${s.version}, intent=${intent}`);
            if (s.version === 1) {
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    select: { estimatedAmount: true, customerId: true, statusCode: true }
                });

                this.logger.log(`finalizeOrder order.statusCode=${order?.statusCode}`);
                this.logger.log(`[OUTSTANDING] order.estimatedAmount=${order?.estimatedAmount}, customerId=${order?.customerId}`);
                // Only subtract if it was in a post-config status (meaning it was added to outstanding)
                if (order && ([OrderStatus.PRODUCTION_READY, OrderStatus.IN_PRODUCTION, OrderStatus.COMPLETE] as OrderStatus[]).includes(order.statusCode)) {
                    this.logger.log(`[OUTSTANDING] Order is in post-config status`);
                    const amount = new Prisma.Decimal(order.estimatedAmount.toString());
                    this.logger.log(`[OUTSTANDING] amount=${amount}`);
                    if (!amount.isZero()) {
                        this.logger.log(`[OUTSTANDING] Decrementing amount`);
                        await tx.customer.update({
                            where: { id: order.customerId },
                            data: { outstandingAmount: { decrement: amount } }
                        });
                        this.logger.log(`[OUTSTANDING] Subtracted ${amount} from customer ${order.customerId} for order ${orderId} (Invoiced)`);
                    }
                }
                this.logger.log(`[OUTSTANDING] Updating order status`);

                // Transition order status
                await tx.order.update({
                    where: { id: orderId },
                    data: { statusCode: OrderStatus.BILLED },
                });

                // Track analytics
                await this.analyticsService.trackOrderFinalized(
                    orderId,
                    Number(calc.result),
                    s.createdAt
                );

            } else {
                // Re-billing: No adjustment needed if we only track WIP in outstandingAmount
            }

            return s;
        });

        return snapshot;
    }



    /* =====================================================
       PUBLIC — finalize GROUP
    ===================================================== */
    async finalizeGroup(
        billingContextId: string,
        inputs: Record<string, Record<string, Record<string, number>>>,
        createdBy?: string
    ) {
        return await this.createGroupSnapshotTx(billingContextId, inputs, createdBy);
    }


    /* =====================================================
       INTERNAL
    ===================================================== */
    private async transitionOrdersForContext(
        billingContextId: string,
    ) {

    }


    /* =====================================================
       PUBLIC — get latest snapshot
    ===================================================== */
    async getLatestSnapshot(
        dto: GetLatestBillingSnapshotDto
    ) {
        let context;

        if (dto.billingContextId) {
            context = await this.prisma.billingContext.findUnique({
                where: { id: dto.billingContextId }
            });
        } else {
            context = await this.prisma.billingContext.findFirst({
                where: {
                    type: "ORDER",
                    orders: {
                        some: { orderId: dto.orderId }
                    }
                }
            });
        }

        if (!context) {
            throw new Error("Billing context not found");
        }

        const snapshot = await this.prisma.billingSnapshot.findFirst({
            where: {
                billingContextId: context.id,
                isLatest: true
            },
            orderBy: { version: "desc" }
        });

        if (!snapshot) {
            throw new Error("No snapshot found");
        }

        return {
            billingContextId: context.id,
            type: context.type,
            version: snapshot.version,
            intent: snapshot.intent,
            currency: snapshot.currency,
            result: snapshot.result.toString(),
            inputs: snapshot.inputs,
            isLatest: true,
            createdAt: snapshot.createdAt.toISOString()
        };
    }
}
