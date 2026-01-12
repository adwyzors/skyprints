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

            case 'ORDER_STATUS_TRANSITION_REQUESTED':
                return this.handleOrderStatusTransition(event);

            case 'ORDER_PROCESS_STATUS_TRANSITION_REQUESTED':
                return this.handleOrderProcessStatusTransition(event);


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

        const [orderStatus, runStatus] = await Promise.all([
            this.prisma.workflowStatus.findFirstOrThrow({
                where: { workflowType: { code: 'ORDER' }, isInitial: true },
            }),
            this.prisma.workflowStatus.findFirstOrThrow({
                where: { workflowType: { code: 'RUN' }, isInitial: true },
            }),
        ]);

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

        const processEntities = await this.prisma.process.findMany({
            where: { id: { in: processes.map(p => p.processId) } },
            include: {
                workflowType: {
                    include: {
                        statuses: { where: { isInitial: true } },
                    },
                },
                runDefs: {
                    include: { runTemplate: true },
                },
            },
        });

        for (const process of processEntities) {
            const count = processCountMap.get(process.id)!;

            const initialProcessStatus = process.workflowType.statuses[0];

            const op = await this.prisma.orderProcess.create({
                data: {
                    orderId,
                    processId: process.id,
                    workflowTypeId: process.workflowTypeId,
                    statusCode: initialProcessStatus.code,
                    minRuns: count,
                    maxRuns: count,
                },
            });

            let runNo = 1;

            for (let batch = 0; batch < count; batch++) {
                for (const def of process.runDefs) {
                    const initialFields = this.buildInitialFields(
                        def.runTemplate.fields as TemplateField[],
                    );

                    await this.prisma.processRun.create({
                        data: {
                            displayName: `${def.displayName} (${batch + 1})`,
                            orderProcessId: op.id,
                            runTemplateId: def.runTemplateId,
                            runNumber: runNo++,
                            statusCode: runStatus.code,
                            fields: initialFields,
                        },
                    });
                }
            }
        }
    }

    /* ---------------------------------------------------------
     * RUN STATUS TRANSITION
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

        /* -----------------------------------------------------
         * CONFIGURATION COMPLETION CHECK
         * ----------------------------------------------------- */

        const initialRunStatus = workflow.statuses.find(s => s.isInitial);
        if (!initialRunStatus) return;

        const orderProcess = await this.prisma.orderProcess.findUnique({
            where: { id: run.orderProcessId },
            include: {
                order: {
                    include: {
                        processes: {
                            include: { runs: true },
                        },
                    },
                },
            },
        });
        if (!orderProcess) return;

        const order = orderProcess.order;

        const allRunsConfigured = order.processes.every(op =>
            op.runs.every(r => r.statusCode !== initialRunStatus.code),
        );

        if (allRunsConfigured) {
            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: order.id,
                    eventType: 'ORDER_STATUS_TRANSITION_REQUESTED',
                    payload: { workflowTypeCode: 'ORDER' },
                },
            });
        }
    }

    /* ---------------------------------------------------------
     * ORDER STATUS TRANSITION
     * --------------------------------------------------------- */

    async handleOrderStatusTransition(event: {
        aggregateId: string;
        payload: { workflowTypeCode: string };
    }) {
        const order = await this.prisma.order.findUnique({
            where: { id: event.aggregateId },
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

    /* ---------------------------------------------------------
 * ORDER PROCESS STATUS TRANSITION
 * --------------------------------------------------------- */
    private async handleOrderProcessStatusTransition(event: {
        aggregateId: string;
        payload: { };
    }) {
        const orderProcess = await this.prisma.orderProcess.findUnique({
            where: { id: event.aggregateId },
        });

        if (!orderProcess) return;

        this.logger.log(
            `Handling OrderProcess transition ${orderProcess.id} (${orderProcess.statusCode})`,
        );

        const workflow = await this.prisma.workflowType.findUnique({
            where: { id: orderProcess.workflowTypeId },
            include: {
                statuses: true,
                transitions: { include: { fromStatus: true, toStatus: true } },
            },
        });

        if (!workflow) return;

        const currentStatus = workflow.statuses.find(
            s => s.code === orderProcess.statusCode,
        );

        if (!currentStatus) return;

        const transition = workflow.transitions.find(
            t => t.fromStatusId === currentStatus.id,
        );

        if (!transition) return;

        await this.prisma.orderProcess.update({
            where: { id: orderProcess.id },
            data: { statusCode: transition.toStatus.code },
        });

        await this.prisma.workflowAuditLog.create({
            data: {
                workflowTypeId: workflow.id,
                aggregateType: 'OrderProcess',
                aggregateId: orderProcess.id,
                fromStatus: currentStatus.code,
                toStatus: transition.toStatus.code,
                transitionId: transition.id,
            },
        });

        /* -----------------------------------------------------
         * CHECK IF ALL ORDER PROCESSES ARE TERMINAL
         * ----------------------------------------------------- */
        const terminalStatuses = workflow.statuses
            .filter(s => s.isTerminal)
            .map(s => s.code);

        const remaining = await this.prisma.orderProcess.count({
            where: {
                orderId: orderProcess.orderId,
                statusCode: { notIn: terminalStatuses },
            },
        });

        if (remaining === 0) {
            this.logger.log(
                `All OrderProcesses completed for order ${orderProcess.orderId}, requesting ORDER transition`,
            );

            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: orderProcess.orderId,
                    eventType: 'ORDER_STATUS_TRANSITION_REQUESTED',
                    payload: { workflowTypeCode: 'ORDER' },
                },
            });
        }
    }



    /* ---------------------------------------------------------
     * HELPERS
     * --------------------------------------------------------- */

    private buildInitialFields(
        templateFields: TemplateField[],
    ): Record<string, any> {
        return templateFields.reduce((acc, field) => {
            acc[field.key] = null;
            return acc;
        }, {} as Record<string, any>);
    }


}
