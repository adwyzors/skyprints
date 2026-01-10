import { Injectable, Logger } from '@nestjs/common';
import jsonLogic from 'json-logic-js';
import { TemplateField } from 'src/workflow/types/template-field.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxHandlers {
    private readonly logger = new Logger(OutboxHandlers.name);

    constructor(private readonly prisma: PrismaService) { }

    async handle(event: {
        eventType: string;
        aggregateId: string;
        payload: any;
    }) {
        switch (event.eventType) {
            case 'ORDER_CREATED':
                return this.handleOrderCreated(event);

            case 'PROCESS_RUN_STATUS_TRANSITION_REQUESTED':
                return this.handleProcessRunStatusTransition(event);

            case 'ORDER_PROCESS_STATUS_TRANSITION_REQUESTED':
                return this.handleOrderProcessStatusTransition(event);

            case 'ORDER_STATUS_TRANSITION_REQUESTED':
                return this.handleOrderStatusTransition(event);

            default:
                this.logger.warn(`Unhandled outbox event: ${event.eventType}`);
        }
    }

    /* ---------------------------------------------------------
     * ORDER CREATED
     * --------------------------------------------------------- */

    private async handleOrderCreated(event: {
        payload: {
            orderId: string;
            processes: { processId: string; count: number }[];
        };
    }) {
        const { orderId, processes } = event.payload;

        const processCountMap = new Map(
            processes.map(p => [p.processId, p.count]),
        );

        const [orderStatus, processStatus, runStatus] = await Promise.all([
            this.prisma.workflowStatus.findFirstOrThrow({
                where: { workflowType: { code: 'ORDER' }, isInitial: true },
            }),
            this.prisma.workflowStatus.findFirstOrThrow({
                where: { workflowType: { code: 'PROCESS' }, isInitial: true },
            }),
            this.prisma.workflowStatus.findFirstOrThrow({
                where: { workflowType: { code: 'RUN' }, isInitial: true },
            }),
        ]);

        /* ---- update order workflow ---- */
        await this.prisma.$transaction(async tx => {
            await tx.order.update({
                where: { id: orderId },
                data: { statusCode: orderStatus.code },
            });

            await tx.workflowAuditLog.create({
                data: {
                    workflowTypeId: orderStatus.workflowTypeId,
                    aggregateType: 'Order',
                    aggregateId: orderId,
                    fromStatus: null,
                    toStatus: orderStatus.code,
                    payload: { event: 'ORDER_CREATED' },
                },
            });
        });

        /* ---- load processes + runDefs ---- */
        const processEntities = await this.prisma.process.findMany({
            where: { id: { in: processes.map(p => p.processId) } },
            include: {
                runDefs: {
                    include: { runTemplate: true },
                },
            },
        });

        for (const process of processEntities) {
            const count = processCountMap.get(process.id)!;

            if (count < 1) {
                throw new Error(`Invalid run count for process ${process.id}`);
            }

            /* ---- create OrderProcess ---- */
            const op = await this.prisma.orderProcess.create({
                data: {
                    orderId,
                    processId: process.id,
                    statusCode: processStatus.code,
                    minRuns: count,
                    maxRuns: count,
                },
            });

            await this.prisma.workflowAuditLog.create({
                data: {
                    workflowTypeId: processStatus.workflowTypeId,
                    aggregateType: 'Process',
                    aggregateId: op.id,
                    fromStatus: null,
                    toStatus: processStatus.code,
                    payload: { event: 'ORDER_PROCESS_CREATED' },
                },
            });

            /* ---- create runs (count × runDefs) ---- */
            let runNo = 1;

            for (let batch = 0; batch < count; batch++) {
                for (const def of process.runDefs) {
                    const initialFields = this.buildInitialFields(
                        def.runTemplate.fields as TemplateField[],
                    );

                    const run = await this.prisma.processRun.create({
                        data: {
                            displayName: `${def.displayName} (${batch + 1})`,
                            orderProcessId: op.id,
                            runTemplateId: def.runTemplateId,
                            runNumber: runNo++,
                            statusCode: runStatus.code,
                            fields: initialFields,
                        },
                    });

                    await this.prisma.workflowAuditLog.create({
                        data: {
                            workflowTypeId: runStatus.workflowTypeId,
                            aggregateType: 'Run',
                            aggregateId: run.id,
                            fromStatus: null,
                            toStatus: runStatus.code,
                            payload: { event: 'PROCESS_RUN_CREATED' },
                        },
                    });
                }
            }
        }
    }


    private buildInitialFields(
        templateFields: TemplateField[],
    ): Record<string, any> {
        return templateFields.reduce((acc, field) => {
            acc[field.key] = null;
            return acc;
        }, {} as Record<string, any>);
    }

    /* ---------------------------------------------------------
     * RUN → PROCESS
     * --------------------------------------------------------- */

    async handleProcessRunStatusTransition(event: {
        aggregateId: string;
        payload: { workflowTypeCode: string };
    }) {
        const run = await this.prisma.processRun.findUnique({
            where: { id: event.aggregateId },
        });
        if (!run) return;

        const workflow = await this.prisma.workflowType.findUnique({
            where: { code: event.payload.workflowTypeCode },
            include: {
                statuses: true,
                transitions: { include: { fromStatus: true, toStatus: true } },
            },
        });
        if (!workflow) return;

        const currentStatus = workflow.statuses.find(
            s => s.code === run.statusCode,
        );
        if (!currentStatus) return;

        const transition = workflow.transitions.find(t => {
            if (t.fromStatusId !== currentStatus.id) return false;
            if (!t.condition) return true;
            return jsonLogic.apply(JSON.parse(t.condition), {
                fields: run.fields,
                status: run.statusCode,
            });
        });
        if (!transition) return;

        const updated = await this.prisma.processRun.updateMany({
            where: { id: run.id, statusVersion: run.statusVersion },
            data: {
                statusCode: transition.toStatus.code,
                statusVersion: { increment: 1 },
            },
        });
        if (updated.count !== 1) return;

        await this.prisma.workflowAuditLog.create({
            data: {
                workflowTypeId: workflow.id,
                aggregateType: 'Run',
                aggregateId: run.id,
                fromStatus: run.statusCode,
                toStatus: transition.toStatus.code,
                transitionId: transition.id,
            },
        });

        const orderProcess = await this.prisma.orderProcess.findUnique({
            where: { id: run.orderProcessId },
            include: { runs: true },
        });
        if (!orderProcess) return;

        const terminalStatuses = new Set(
            workflow.statuses.filter(s => s.isTerminal).map(s => s.code),
        );

        if (
            orderProcess.runs.every(r =>
                terminalStatuses.has(r.statusCode),
            )
        ) {
            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'Process',
                    aggregateId: orderProcess.id,
                    eventType: 'ORDER_PROCESS_STATUS_TRANSITION_REQUESTED',
                    payload: { workflowTypeCode: 'PROCESS' },
                },
            });
        }
    }

    /* ---------------------------------------------------------
     * PROCESS → ORDER
     * --------------------------------------------------------- */

    async handleOrderProcessStatusTransition(event: {
        aggregateId: string;
        payload: { workflowTypeCode: string };
    }) {
        const op = await this.prisma.orderProcess.findUnique({
            where: { id: event.aggregateId },
            include: { runs: true },
        });
        if (!op) return;

        const workflow = await this.prisma.workflowType.findUnique({
            where: { code: event.payload.workflowTypeCode },
            include: {
                statuses: true,
                transitions: { include: { fromStatus: true, toStatus: true } },
            },
        });
        if (!workflow) return;

        const currentStatus = workflow.statuses.find(
            s => s.code === op.statusCode,
        );
        if (!currentStatus) return;

        const transition = workflow.transitions.find(
            t => t.fromStatusId === currentStatus.id,
        );
        if (!transition) return;

        await this.prisma.orderProcess.update({
            where: { id: op.id },
            data: { statusCode: transition.toStatus.code },
        });

        await this.prisma.workflowAuditLog.create({
            data: {
                workflowTypeId: workflow.id,
                aggregateType: 'Process',
                aggregateId: op.id,
                fromStatus: currentStatus.code,
                toStatus: transition.toStatus.code,
                transitionId: transition.id,
            },
        });

        await this.prisma.outboxEvent.create({
            data: {
                aggregateType: 'Order',
                aggregateId: op.orderId,
                eventType: 'ORDER_STATUS_TRANSITION_REQUESTED',
                payload: { workflowTypeCode: 'ORDER' },
            },
        });
    }

    /* ---------------------------------------------------------
     * ORDER FINAL
     * --------------------------------------------------------- */

    async handleOrderStatusTransition(event: {
        aggregateId: string;
        payload: { workflowTypeCode: string };
    }) {
        const order = await this.prisma.order.findUnique({
            where: { id: event.aggregateId },
            include: { processes: true },
        });
        if (!order) return;

        const workflow = await this.prisma.workflowType.findUnique({
            where: { code: event.payload.workflowTypeCode },
            include: {
                statuses: true,
                transitions: { include: { fromStatus: true, toStatus: true } },
            },
        });
        if (!workflow) return;

        const currentStatus = workflow.statuses.find(
            s => s.code === order.statusCode,
        );
        if (!currentStatus) return;

        const transition = workflow.transitions.find(
            t => t.fromStatusId === currentStatus.id,
        );
        if (!transition) return;

        await this.prisma.order.update({
            where: { id: order.id },
            data: { statusCode: transition.toStatus.code },
        });

        await this.prisma.workflowAuditLog.create({
            data: {
                workflowTypeId: workflow.id,
                aggregateType: 'Order',
                aggregateId: order.id,
                fromStatus: currentStatus.code,
                toStatus: transition.toStatus.code,
                transitionId: transition.id,
            },
        });
    }
}
