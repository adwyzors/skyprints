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

        return this.prisma.$transaction((tx) =>
            this.createGroupSnapshotTx(
                tx,
                billingContextId,
                createdBy
            )
        );
    }


    public async createGroupSnapshotTx(
        tx: Prisma.TransactionClient,
        billingContextId: string,
        createdBy?: string
    ) {
        this.logger.debug(
            `[createGroupSnapshotTx] billingContextId=${billingContextId}`
        );

        const context = await tx.billingContext.findUnique({
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

        const orderSnapshots: {
            orderId: string;
            inputs: OrderBillingInputs;
        }[] = [];

        for (const o of context.orders) {
            let snapshot = await tx.billingSnapshot.findFirst({
                where: {
                    intent: "FINAL",
                    billingContext: {
                        type: "ORDER",
                        orders: {
                            some: { orderId: o.orderId }
                        }
                    }
                },
                orderBy: { version: "desc" }
            });

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

            orderSnapshots.push({
                orderId: o.orderId,
                inputs: snapshot.inputs
            });
        }

        const calc =
            await this.calculator.calculateForGroupFromSnapshots(
                orderSnapshots
            );

        const version =
            (await tx.billingSnapshot.count({
                where: { billingContextId }
            })) + 1;

        const snapshot = tx.billingSnapshot.create({
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

        if (version === 1) {
            this.logger.log(
                `[finalizeGroup] billingContextId=${billingContextId} transitioning order status snapshot.version=${version}`
            )
            await this.transitionOrdersForContext(
                billingContextId
            );
        } else {
            this.logger.log(
                `[finalizeGroup] billingContextId=${billingContextId} NOT transitioning order status snapshot.version=${version}`
            )
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

        return this.prisma.$transaction((tx) =>
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
        billingContextId: string,
        createdBy?: string,
        requestInputs?: Record<string, any>
    ) {
        this.logger.log(
            `[finalizeContextTx] Start billingContextId=${billingContextId} requestInputs=${requestInputs ? "YES" : "NO"}`
        );

        const context = await tx.billingContext.findUnique({
            where: { id: billingContextId },
            include: {
                orders: true,
                snapshots: {
                    where: {
                        intent: "DRAFT",
                        isLatest: true
                    }
                }
            }
        });

        if (!context) {
            this.logger.error(
                `[finalizeContextTx] Billing context NOT FOUND id=${billingContextId}`
            );
            throw new Error("Billing context not found");
        }

        this.logger.debug(
            `[finalizeContextTx] Context found type=${context.type} orders=${context.orders.length}`
        );

        let draft = context.snapshots[0];

        // -----------------------------------------------------
        // 1️⃣ Decide source of inputs
        // -----------------------------------------------------
        let effectiveInputs: any;

        if (requestInputs) {
            this.logger.debug(
                `[finalizeContextTx] Request inputs provided — persisting as DRAFT`
            );

            if (draft) {
                this.logger.debug(
                    `[finalizeContextTx] Updating existing DRAFT id=${draft.id}`
                );

                draft = await tx.billingSnapshot.update({
                    where: { id: draft.id },
                    data: {
                        inputs: requestInputs,
                        createdBy
                    }
                });
            } else {
                this.logger.debug(
                    `[finalizeContextTx] Creating new DRAFT from request inputs`
                );

                draft = await this.saveDraftTx(
                    tx,
                    context.id,
                    requestInputs,
                    undefined,
                    createdBy
                );
            }

            effectiveInputs = requestInputs;
        } else {
            if (!draft) {
                this.logger.error(
                    `[finalizeContextTx] No DRAFT snapshot found and no inputs provided`
                );
                throw new Error(
                    "No DRAFT snapshot found and no inputs provided"
                );
            }

            this.logger.debug(
                `[finalizeContextTx] No request inputs — using existing DRAFT id=${draft.id}`
            );

            effectiveInputs = draft.inputs;
        }

        // -----------------------------------------------------
        // 2️⃣ Calculate billing
        // -----------------------------------------------------
        this.logger.debug(
            `[finalizeContextTx] Calculating billing using DRAFT id=${draft.id}`
        );

        let result: Decimal;
        let snapshotInputs: any;

        if (context.type === "ORDER") {
            const orderId = context.orders[0].orderId;

            this.logger.debug(
                `[finalizeContextTx] ORDER calculation orderId=${orderId}`
            );

            const calc = await this.calculator.calculateForOrder(
                orderId,
                effectiveInputs as Record<string, Record<string, number>>
            );

            result = calc.result;
            snapshotInputs = calc.inputs;
        } else {
            this.logger.debug(
                `[finalizeContextTx] GROUP calculation orders=${context.orders.length}`
            );

            const calc = await this.calculator.calculateForGroup(
                context.orders.map(o => ({
                    orderId: o.orderId,
                    runInputs:
                        (effectiveInputs as Record<string, any>)?.[o.orderId] ?? {}
                }))
            );

            result = calc.result;
            snapshotInputs = calc.perOrder;
        }

        // -----------------------------------------------------
        // 3️⃣ Finalize snapshot
        // -----------------------------------------------------
        this.logger.log(
            `[finalizeContextTx] Finalizing snapshot id=${draft.id}`
        );

        const finalized = await tx.billingSnapshot.update({
            where: { id: draft.id },
            data: {
                intent: "FINAL",
                inputs: snapshotInputs,
                result,
                calculationType: "RECALCULATED",
                createdBy
            }
        });

        return finalized;
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

        const result = await this.prisma.$transaction(async (tx) => {
            const context =
                await this.contextResolver.resolveOrderContext(
                    tx,
                    orderId
                );

            await this.saveDraftTx(
                tx,
                context.id,
                inputs,
                reason,
                createdBy
            );

            const snapshot = await this.finalizeContextTx(
                tx,
                context.id,
                createdBy
            );

            return {
                snapshot,
                contextId: context.id
            };
        });

        if (result.snapshot.version === 1) {
            await this.transitionOrdersForContext(result.contextId);
        }

        return result.snapshot;
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

        return await this.prisma.$transaction((tx) =>
            this.createGroupSnapshotTx(tx, billingContextId, createdBy)
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
