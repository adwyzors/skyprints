import { Injectable, Logger } from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';
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

            case 'PROCESS_WORKFLOW_BOOTSTRAP_REQUESTED':
                return this.handleProcessWorkflowBootstrap(event);

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
                    include: { statuses: true },
                },
                runDefs: {
                    include: { runTemplate: true },
                },
            },
        });

        for (const process of processEntities) {
            const count = processCountMap.get(process.id)!;

            /* 🔐 HARD GUARD: PROCESS MUST BE INITIALIZED */
            if (!process.workflowType || !process.workflowTypeId) {
                this.logger.error(
                    `Process ${process.id} is not initialized (workflow missing)`,
                );
                throw new Error(
                    `Order cannot be created using uninitialized process ${process.id}`,
                );
            }

            const initialProcessStatus = process.workflowType.statuses.find(
                s => s.isInitial,
            );

            if (!initialProcessStatus) {
                throw new Error(
                    `No initial workflow status found for process ${process.id}`,
                );
            }

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
     * PROCESS RUN STATUS TRANSITION
     * --------------------------------------------------------- */

    private async handleProcessRunStatusTransition(event: {
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
            where: {
                id: run.id,
                statusVersion: run.statusVersion,
            },
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
    }

    /* ---------------------------------------------------------
     * ORDER PROCESS STATUS TRANSITION
     * --------------------------------------------------------- */

    private async handleOrderProcessStatusTransition(event: {
        aggregateId: string;
        payload: {};
    }) {
        const orderProcess = await this.prisma.orderProcess.findUnique({
            where: { id: event.aggregateId },
        });
        if (!orderProcess) return;

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
    }

    /* ---------------------------------------------------------
     * ORDER STATUS TRANSITION
     * --------------------------------------------------------- */

    private async handleOrderStatusTransition(event: {
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
     * PROCESS WORKFLOW BOOTSTRAP
     * --------------------------------------------------------- */

    private async handleProcessWorkflowBootstrap(event: {
        aggregateId: string;
        payload: { workflowTypes: string[] };
    }) {
        const { aggregateId: processId, payload } = event;

        const process = await this.prisma.process.findUnique({
            where: { id: processId },
        });
        if (!process) return;

        await this.prisma.$transaction(async tx => {
            const workflowType = await tx.workflowType.create({
                data: {
                    code: `PROCESS_${process.name.toUpperCase().replace(/\s+/g, '_')}`,
                },
            });

            const statuses: WorkflowStatus[] = [];

            for (let i = 0; i < payload.workflowTypes.length; i++) {
                const code = payload.workflowTypes[i].toUpperCase();

                const status = await tx.workflowStatus.create({
                    data: {
                        workflowTypeId: workflowType.id,
                        code,
                        isInitial: i === 0,
                        isTerminal: i === payload.workflowTypes.length - 1,
                    },
                });

                statuses.push(status);
            }

            for (let i = 0; i < statuses.length - 1; i++) {
                await tx.workflowTransition.create({
                    data: {
                        workflowTypeId: workflowType.id,
                        fromStatusId: statuses[i].id,
                        toStatusId: statuses[i + 1].id,
                    },
                });
            }

            await tx.process.update({
                where: { id: processId },
                data: {
                    workflowTypeId: workflowType.id,
                },
            });
        });
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
