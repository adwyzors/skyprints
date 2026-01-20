//import { Injectable, Logger } from '@nestjs/common';
//import { PrismaService } from '../../prisma/prisma.service';
//import { BillingSnapshotWorker } from '../billing/workers/billing-snapshot.worker';

//@Injectable()
//export class OutboxHandlers {
//    private readonly logger = new Logger(OutboxHandlers.name);

//    constructor(
//        private readonly prisma: PrismaService,
//        private readonly billingSnapshotWorker: BillingSnapshotWorker,
//    ) { }

//    async handle(event: {
//        id: string;
//        eventType: string;
//        aggregateId: string;
//        payload?: any;
//    }) {
//        this.logger.debug(
//            `[OUTBOX] event=${event.eventType} aggregate=${event.aggregateId}`,
//        );

//        switch (event.eventType) {
//            /* =====================================================
//             * LEGACY – SAFE NO-OP (STATE IS SYNC NOW)
//             * ===================================================== */

//            case 'PROCESS_RUN_CONFIG_TRANSITION_REQUESTED':
//            case 'PROCESS_RUN_LIFECYCLE_TRANSITION_REQUESTED':
//                this.logger.warn(
//                    `[OUTBOX] deprecated event ignored type=${event.eventType} aggregate=${event.aggregateId}`,
//                );
//                return;

//            /* =====================================================
//             * REQUIRED EVENTS
//             * ===================================================== */

//            case 'ORDER_CREATED':
//                return this.handleOrderCreated(event.payload);

//            case 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED':
//                return this.handleOrderProcess(
//                    event.aggregateId,
//                    event.payload?.reason,
//                );

//            case 'ORDER_LIFECYCLE_TRANSITION_REQUESTED':
//                return this.handleOrder(event.aggregateId);

//            case 'BILLING_SNAPSHOT_REQUESTED':
//                return this.billingSnapshotWorker.handle(event);

//            default:
//                this.logger.warn(
//                    `[OUTBOX] unhandled eventType=${event.eventType}`,
//                );
//        }
//    }

//    /* =========================================================
//     * ORDER CREATED (IDEMPOTENT)
//     * ========================================================= */

//    private async handleOrderCreated(payload: {
//        orderId: string;
//        processes: { processId: string; count: number }[];
//    }) {
//        if (!payload) {
//            this.logger.error('[ORDER_CREATED] payload is undefined');
//            return;
//        }

//        const { orderId, processes } = payload;

//        this.logger.log(
//            `ORDER_CREATED start orderId=${orderId}, processes=${processes.length}`,
//        );

//        const processCountMap = new Map(
//            processes.map(p => [p.processId, p.count]),
//        );

//        const processEntities = await this.prisma.process.findMany({
//            where: { id: { in: processes.map(p => p.processId) } },
//            include: {
//                runDefs: {
//                    orderBy: { sortOrder: 'asc' },
//                    include: {
//                        runTemplate: {
//                            include: {
//                                lifecycleWorkflowType: { include: { statuses: true } },
//                            },
//                        },
//                    },
//                },
//            },
//        });

//        const processWorkflow = await this.prisma.workflowType.findUniqueOrThrow({
//            where: { code: 'ORDER_PROCESS' },
//        });

//        const initialProcessStatus =
//            await this.prisma.workflowStatus.findFirstOrThrow({
//                where: {
//                    workflowTypeId: processWorkflow.id,
//                    isInitial: true,
//                },
//            });

//        for (const process of processEntities) {
//            const count = processCountMap.get(process.id)!;

//            const totalRuns = count * process.runDefs.length;

//            const orderProcess = await this.prisma.orderProcess.upsert({
//                where: {
//                    orderId_processId: {
//                        orderId,
//                        processId: process.id,
//                    },
//                },
//                create: {
//                    orderId,
//                    processId: process.id,
//                    workflowTypeId: processWorkflow.id,
//                    statusCode: initialProcessStatus.code,

//                    totalRuns,
//                    configCompletedRuns: 0,
//                    lifecycleCompletedRuns: 0,
//                },
//                update: {},
//            });


//            const existingRuns = await this.prisma.processRun.count({
//                where: { orderProcessId: orderProcess.id },
//            });

//            if (existingRuns > 0) {
//                this.logger.warn(
//                    `ProcessRuns already exist, skipping creation orderProcessId=${orderProcess.id}`,
//                );
//                continue;
//            }

//            let runNumber = 1;

//            for (let batch = 0; batch < count; batch++) {
//                for (const def of process.runDefs) {
//                    const template = def.runTemplate;

//                    const initialConfigStatus =
//                        await this.prisma.workflowStatus.findFirstOrThrow({
//                            where: {
//                                workflowTypeId: template.configWorkflowTypeId,
//                                isInitial: true,
//                            },
//                        });

//                    const initialLifecycleStatus =
//                        template.lifecycleWorkflowType.statuses.find(
//                            s => s.isInitial,
//                        )!;

//                    await this.prisma.processRun.create({
//                        data: {
//                            orderProcessId: orderProcess.id,
//                            runTemplateId: template.id,
//                            runNumber: runNumber++,
//                            displayName: `${def.displayName} (${batch + 1})`,
//                            configWorkflowTypeId: template.configWorkflowTypeId,
//                            lifecycleWorkflowTypeId: template.lifecycleWorkflowTypeId,
//                            statusCode: initialConfigStatus.code,
//                            lifeCycleStatusCode: initialLifecycleStatus.code,
//                            fields: {},
//                        },
//                    });
//                }
//            }
//        }

//        this.logger.log(`ORDER_CREATED completed orderId=${orderId}`);
//    }

//    /* =========================================================
//     * ORDER PROCESS → ORDER (ASYNC, O(1))
//     * ========================================================= */

//    private async handleOrderProcess(
//        orderProcessId: string,
//        reason?: 'CONFIG_COMPLETE' | 'ALL_RUNS_COMPLETED',
//    ) {
//        await this.prisma.$transaction(async tx => {
//            const op = await tx.orderProcess.findUnique({
//                where: { id: orderProcessId },
//            });
//            if (!op) return;

//            const wf = await tx.workflowType.findUnique({
//                where: { id: op.workflowTypeId },
//                include: { statuses: true, transitions: true },
//            });
//            if (!wf) return;

//            const current = wf.statuses.find(s => s.code === op.statusCode);
//            if (!current) return;

//            const transition = wf.transitions.find(
//                t => t.fromStatusId === current.id,
//            );
//            if (!transition) return;

//            const toStatus = wf.statuses.find(
//                s => s.id === transition.toStatusId,
//            );
//            if (!toStatus) return;

//            this.logger.log(
//                `[ASYNC OP] ${op.id} ${current.code} → ${toStatus.code} (${reason})`,
//            );

//            await tx.orderProcess.update({
//                where: { id: op.id },
//                data: { statusCode: toStatus.code },
//            });

//            /* 🚫 DO NOT COMPLETE ORDER ON CONFIG */
//            if (reason !== 'ALL_RUNS_COMPLETED') {
//                return;
//            }

//            /* ✅ ONLY HERE */
//            const order = await tx.order.update({
//                where: { id: op.orderId },
//                data: { completedProcesses: { increment: 1 } },
//                select: {
//                    completedProcesses: true,
//                    totalProcesses: true,
//                    lifecycleCompletionSent: true,
//                },
//            });

//            if (
//                order.completedProcesses === order.totalProcesses &&
//                !order.lifecycleCompletionSent
//            ) {
//                await tx.order.update({
//                    where: { id: op.orderId },
//                    data: { lifecycleCompletionSent: true },
//                });

//                await tx.outboxEvent.create({
//                    data: {
//                        aggregateType: 'Order',
//                        aggregateId: op.orderId,
//                        eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
//                        payload: {},
//                    },
//                });
//            }
//        });
//    }

//    /* =========================================================
//     * ORDER FINAL TRANSITION (ASYNC)
//     * ========================================================= */

//    private async handleOrder(orderId: string) {
//        await this.prisma.$transaction(async tx => {
//            const order = await tx.order.findUnique({ where: { id: orderId } });
//            if (!order) return;

//            const wf = await tx.workflowType.findUnique({
//                where: { id: order.workflowTypeId },
//                include: { statuses: true, transitions: true },
//            });
//            if (!wf) return;

//            const current = wf.statuses.find(s => s.code === order.statusCode);
//            if (!current) return;

//            const transition = wf.transitions.find(
//                t => t.fromStatusId === current.id,
//            );
//            if (!transition) return;

//            const toStatus = wf.statuses.find(
//                s => s.id === transition.toStatusId,
//            );
//            if (!toStatus) {
//                this.logger.error(
//                    `[ASYNC ORDER] invalid transition target order=${order.id}`,
//                );
//                return;
//            }

//            this.logger.log(
//                `[ASYNC ORDER] ${order.id} ${current.code} → ${toStatus.code}`,
//            );

//            await tx.order.update({
//                where: { id: order.id },
//                data: { statusCode: toStatus.code },
//            });
//        });
//    }
//}
