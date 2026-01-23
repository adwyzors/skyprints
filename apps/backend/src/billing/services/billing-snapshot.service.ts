import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { OrdersService } from "../../orders/orders.service";
import {
    isOrderBillingInputs,
    OrderBillingInputs
} from "../types/billing-snapshot.types";
import { BillingCalculatorService } from "./billing-calculator.service";
import { BillingContextResolver } from "./billing-context.resolver";

@Injectable()
export class BillingSnapshotService {
    private readonly logger = new Logger(BillingSnapshotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService,
        private readonly contextResolver: BillingContextResolver,
        private readonly ordersService: OrdersService
    ) { }

    /* =====================================================
       INTERNAL — transactional only
    ===================================================== */
    private async saveDraftTx(
        tx: Prisma.TransactionClient,
        billingContextId: string,
        inputs: any,
        reason?: string,
        createdBy?: string
    ) {
        this.logger.debug(
            `[saveDraftTx] billingContextId=${billingContextId} createdBy=${createdBy ?? "system"}`
        );

        const last = await tx.billingSnapshot.findFirst({
            where: {
                billingContextId,
                intent: "DRAFT",
                isLatest: true
            }
        });

        if (last) {
            this.logger.debug(
                `[saveDraftTx] Updating existing DRAFT snapshot id=${last.id}`
            );

            return tx.billingSnapshot.update({
                where: { id: last.id },
                data: {
                    inputs,
                    reason,
                    createdBy
                }
            });
        }

        const version =
            (await tx.billingSnapshot.count({
                where: { billingContextId }
            })) + 1;

        this.logger.debug(
            `[saveDraftTx] Creating new DRAFT snapshot version=${version}`
        );

        return tx.billingSnapshot.create({
            data: {
                billingContextId,
                version,
                isLatest: true,
                intent: "DRAFT",
                inputs,
                result: new Prisma.Decimal(0),
                currency: "INR",
                calculationType: "INITIAL",
                reason,
                createdBy
            }
        });
    }

    public async createGroupSnapshot(
        billingContextId: string,
        createdBy?: string
    ) {
        this.logger.log(
            `[createGroupSnapshot] billingContextId=${billingContextId}`
        );

        // 🔹 NO TRANSACTION HERE
        return this.createGroupSnapshotTx(
            billingContextId,
            createdBy
        );
    }



    public async createGroupSnapshotTx(
        billingContextId: string,
        createdBy?: string
    ) {
        this.logger.debug(
            `[createGroupSnapshotTx] billingContextId=${billingContextId}`
        );

        /* -------------------------------
           1️⃣ READ context + orders (NO TX)
        ------------------------------- */
        const context = await this.prisma.billingContext.findUnique({
            where: { id: billingContextId },
            include: { orders: true }
        });

        if (!context || context.type !== "GROUP") {
            throw new Error("Invalid GROUP billing context");
        }

        if (context.orders.length === 0) {
            throw new Error(
                "Cannot create group snapshot without orders"
            );
        }

        /* -------------------------------
           2️⃣ READ FINAL snapshots (NO TX)
           — include orders so we can match by orderId
        ------------------------------- */
        const orderSnapshots = await this.prisma.billingSnapshot.findMany({
            where: {
                intent: "FINAL",
                billingContext: {
                    type: "ORDER",
                    orders: {
                        some: {
                            orderId: {
                                in: context.orders.map(o => o.orderId)
                            }
                        }
                    }
                }
            },
            include: {
                billingContext: {
                    include: {
                        orders: true
                    }
                }
            },
            orderBy: { version: "desc" }
        });

        /* -------------------------------
           3️⃣ BUILD per-order inputs
        ------------------------------- */
        const inputs: {
            orderId: string;
            inputs: OrderBillingInputs;
        }[] = [];

        for (const o of context.orders) {
            const snapshot = orderSnapshots.find(s =>
                s.billingContext.orders.some(
                    ord => ord.orderId === o.orderId
                )
            );

            if (!snapshot) {
                throw new Error(
                    `Missing FINAL snapshot for order=${o.orderId}`
                );
            }

            if (!isOrderBillingInputs(snapshot.inputs)) {
                throw new Error(
                    `Invalid billing snapshot inputs for order=${o.orderId}`
                );
            }

            inputs.push({
                orderId: o.orderId,
                inputs: snapshot.inputs as OrderBillingInputs
            });
        }

        /* -------------------------------
           4️⃣ CALCULATE (NO TX)
        ------------------------------- */
        const calc =
            await this.calculator.calculateForGroupFromSnapshots(inputs);

        /* -------------------------------
           5️⃣ WRITE snapshot (SHORT TX)
        ------------------------------- */
        const snapshot = await this.prisma.transaction(async (tx) => {
            const version =
                (await tx.billingSnapshot.count({
                    where: { billingContextId }
                })) + 1;

            return tx.billingSnapshot.create({
                data: {
                    billingContextId,
                    version,
                    intent: "FINAL",
                    isLatest: true,
                    inputs: calc.perOrderInputs,
                    result: calc.result,
                    currency: "INR",
                    calculationType: "RECALCULATED",
                    createdBy
                }
            });
        });

        if (snapshot.version === 1) {
            this.logger.log(
                `[finalizeGroup] billingContextId=${billingContextId} transitioning order status snapshot.version=${snapshot.version}`
            );
            await this.transitionOrdersForContext(billingContextId);
        } else {
            this.logger.log(
                `[finalizeGroup] billingContextId=${billingContextId} NOT transitioning order status snapshot.version=${snapshot.version}`
            );
        }

        return snapshot;
    }




    /* =====================================================
       PUBLIC — controller-safe
    ===================================================== */
    async saveDraft(
        billingContextId: string,
        inputs: any,
        reason?: string,
        createdBy?: string
    ) {
        this.logger.log(
            `[saveDraft] billingContextId=${billingContextId}`
        );

        return this.prisma.transaction((tx) =>
            this.saveDraftTx(
                tx,
                billingContextId,
                inputs,
                reason,
                createdBy
            )
        );
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



    /* =====================================================
       PUBLIC — finalize ORDER
    ===================================================== */
    async finalizeOrder(
        orderId: string,
        inputs: OrderBillingInputs,
        reason?: string,
        createdBy?: string
    ) {
        this.logger.log(`[finalizeOrder] orderId=${orderId}`);

        /* -------------------------------
           1️⃣ Resolve context + save DRAFT
        ------------------------------- */
        const { contextId, draftId } = await this.prisma.transaction(async (tx) => {
            const context =
                await this.contextResolver.resolveOrderContext(
                    tx,
                    orderId
                );

            const draft = await this.saveDraftTx(
                tx,
                context.id,
                inputs,
                reason,
                createdBy
            );

            return {
                contextId: context.id,
                draftId: draft.id
            };
        });

        /* -------------------------------
           2️⃣ CALCULATE (NO TX)
        ------------------------------- */
        const calc = await this.calculator.calculateForOrder(
            orderId,
            inputs
        );

        /* -------------------------------
           3️⃣ FINALIZE (SHORT TX)
        ------------------------------- */
        const snapshot = await this.prisma.transaction((tx) =>
            this.finalizeContextTx(
                tx,
                draftId,
                calc.result,
                calc.inputs,
                createdBy
            )
        );

        /* -------------------------------
           4️⃣ TRANSITION ORDERS (NO TX)
        ------------------------------- */
        if (snapshot.version === 1) {
            await this.transitionOrdersForContext(contextId);
        }

        return snapshot;
    }



    /* =====================================================
       PUBLIC — finalize GROUP
    ===================================================== */
    async finalizeGroup(
        billingContextId: string,
        createdBy?: string
    ) {
        this.logger.log(
            `[finalizeGroup] billingContextId=${billingContextId}`
        );

        return await this.prisma.transaction((tx) =>
            this.createGroupSnapshotTx(billingContextId, createdBy)
        );
    }


    /* =====================================================
       INTERNAL
    ===================================================== */
    private async transitionOrdersForContext(
        billingContextId: string
    ) {
        const context = await this.prisma.billingContext.findUnique({
            where: { id: billingContextId },
            include: { orders: true }
        });

        if (!context) return;

        for (const o of context.orders) {
            await this.ordersService.transitionOrderById(
                this.prisma,
                o.orderId
            );
        }
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
