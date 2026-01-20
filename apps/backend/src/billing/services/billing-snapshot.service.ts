import type { GetLatestBillingSnapshotDto } from "@app/contracts";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { OrdersService } from "../../orders/orders.service";
import { BillingCalculatorService } from "./billing-calculator.service";
import { BillingContextResolver } from "./billing-context.resolver";
@Injectable()
export class BillingSnapshotService {
    private readonly logger = new Logger(BillingSnapshotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly calculator: BillingCalculatorService,
        private readonly contextResolver: BillingContextResolver,
        private readonly orderService: OrdersService
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

        // -----------------------------------------------------
        // 4️⃣ FIRST SNAPSHOT → TRANSITION ORDERS
        // -----------------------------------------------------
        if (finalized.version === 1) {
            this.logger.log(
                `[finalizeContextTx] First billing snapshot detected — transitioning ${context.orders.length} orders`
            );

            for (const o of context.orders) {
                await this.orderService.transitionOrderById(
                    tx,
                    o.orderId
                );
            }
        }

        return finalized;
    }


    /* =====================================================
       PUBLIC — finalize ORDER
    ===================================================== */
    async finalizeOrder(
        orderId: string,
        inputs: Record<string, Record<string, number>>,
        reason?: string,
        createdBy?: string
    ) {
        this.logger.log(
            `[finalizeOrder] orderId=${orderId}`
        );

        return this.prisma.$transaction(async (tx) => {
            const context =
                await this.contextResolver.resolveOrderContext(
                    tx,
                    orderId
                );

            this.logger.debug(
                `[finalizeOrder] Using billingContextId=${context.id}`
            );

            await this.saveDraftTx(
                tx,
                context.id,
                inputs,
                reason,
                createdBy
            );

            return this.finalizeContextTx(
                tx,
                context.id,
                createdBy
            );
        });
    }

    /* =====================================================
       PUBLIC — finalize GROUP
    ===================================================== */
    async finalizeGroup(
        billingContextId: string,
        inputs: Record<string, Record<string, Record<string, number>>>,
        createdBy?: string
    ) {
        this.logger.log(
            `[finalizeGroup] billingContextId=${billingContextId}`
        );

        return this.prisma.$transaction((tx) =>
            this.finalizeContextTx(
                tx,
                billingContextId,
                createdBy,
                inputs
            )
        );
    }

    /* =====================================================
       PUBLIC — get latest snapshot
    ===================================================== */
    async getLatestSnapshot(
        dto: GetLatestBillingSnapshotDto
    ) {
        this.logger.log(
            `[getLatestSnapshot] orderId=${dto.orderId ?? "-"} billingContextId=${dto.billingContextId ?? "-"}`
        );

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
            this.logger.error(
                `[getLatestSnapshot] Billing context not found`
            );
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
            this.logger.error(
                `[getLatestSnapshot] No snapshot found billingContextId=${context.id}`
            );
            throw new Error("No snapshot found");
        }

        this.logger.debug(
            `[getLatestSnapshot] Found snapshot id=${snapshot.id} version=${snapshot.version} intent=${snapshot.intent}`
        );

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
