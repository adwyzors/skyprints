import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import { Injectable } from "@nestjs/common";
import { BillingSnapshotIntent, CalculationType, OrderStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import pLimit from 'p-limit';
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
        private readonly ordersService: OrdersService
    ) { }

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

            return tx.billingSnapshot.create({
                data: {
                    billingContextId,
                    version,
                    intent: 'FINAL',
                    isLatest: true,
                    inputs: calc.perOrderInputs,
                    result: calc.result,
                    currency: 'INR',
                    calculationType: CalculationType.RECALCULATED,
                    createdBy,
                },
            });
        });

        /* -------------------------------
           8️⃣ Transition orders ONCE (ATOMIC)
        ------------------------------- */
        if (snapshot.version === 1) {
            const res = await this.prisma.order.updateMany({
                where: {
                    id: { in: orderIds },
                    statusCode: {
                        not: OrderStatus.GROUP_BILLED,
                    },
                },
                data: {
                    statusCode: OrderStatus.GROUP_BILLED,
                },
            });

            this.logger.debug(
                `GROUP_BILLED transition affected ${res.count} orders`,
            );
        }

        return snapshot;
    }






    /* =====================================================
       PUBLIC — controller-safe
    ===================================================== */
    //async saveDraft(
    //    billingContextId: string,
    //    inputs: any,
    //    reason?: string,
    //    createdBy?: string
    //) {
    //    this.logger.log(
    //        `[saveDraft] billingContextId=${billingContextId}`
    //    );

    //    return this.prisma.transaction((tx) =>
    //        this.saveDraftTx(
    //            tx,
    //            billingContextId,
    //            inputs,
    //            reason,
    //            createdBy
    //        )
    //    );
    //}

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
        const snapshot =
            await this.prisma.transaction(tx =>
                this.finalizeContextTx(
                    tx,
                    draftId,
                    calc.result,
                    calc.inputs,
                    createdBy,
                ),
            );

        /* -------------------------------
           5️⃣ Transition order if first FINAL
        ------------------------------- */
        if (snapshot.version === 1) {
            await this.prisma.order.updateMany({
                where: {
                    id: orderId,
                    statusCode: { equals: OrderStatus.COMPLETE },
                },
                data: { statusCode: OrderStatus.BILLED },
            });
        }

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
