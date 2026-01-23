import { Injectable, Logger } from '@nestjs/common';
import jsonLogic from 'json-logic-js';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutboxHandlers {
    private readonly logger = new Logger(OutboxHandlers.name);

    constructor(
        private readonly prisma: PrismaService
    ) { }

    async handle(event: {
        eventType: string;
        aggregateId: string;
        payload: any;
    }) {
        this.logger.debug(
            `Handling eventType=${event.eventType}, aggregateId=${event.aggregateId}`,
        );

        switch (event.eventType) {
            case 'PROCESS_RUN_CONFIG_TRANSITION_REQUESTED':
                return this.handleProcessRunConfigTransition(event);
            case 'PROCESS_RUN_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleProcessRunLifecycleTransition(event);
            case 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleOrderProcessLifecycleTransition(event);
            case 'ORDER_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleOrderLifecycleTransition(event);
            default:
                this.logger.warn(`Unhandled eventType=${event.eventType}`);
        }
    }


    /* =========================================================
     * PROCESS RUN – CONFIG WORKFLOW
     * ========================================================= */

    private async handleProcessRunConfigTransition(event: {
        aggregateId: string;
    }) {
        this.logger.debug(
            `PROCESS_RUN_CONFIG_TRANSITION_REQUESTED runId=${event.aggregateId}`,
        );

        const run = await this.prisma.processRun.findUnique({
            where: { id: event.aggregateId },
            include: {
                runTemplate: {
                    include: {
                        configWorkflowType: {
                            include: {
                                statuses: true,
                                transitions: {
                                    include: { fromStatus: true, toStatus: true },
                                },
                            },
                        },
                    },
                },
                orderProcess: true,
            },
        });

        if (!run) {
            this.logger.warn(`ProcessRun not found runId=${event.aggregateId}`);
            return;
        }

        const workflow = run.runTemplate.configWorkflowType;
        const current = workflow.statuses.find(
            s => s.code === run.statusCode,
        );

        if (!current) {
            this.logger.warn(
                `Invalid config status runId=${run.id}, status=${run.statusCode}`,
            );
            return;
        }

        const transition = workflow.transitions.find(
            t =>
                t.fromStatusId === current.id &&
                (!t.condition ||
                    jsonLogic.apply(JSON.parse(t.condition), {
                        fields: run.fields,
                    })),
        );

        if (!transition) {
            this.logger.debug(
                `No config transition runId=${run.id}, status=${current.code}`,
            );
            return;
        }

        this.logger.log(
            `Config transition START runId=${run.id} ${current.code} → ${transition.toStatus.code}`,
        );

        await this.prisma.transaction(async tx => {
            await tx.processRun.update({
                where: { id: run.id },
                data: { statusCode: transition.toStatus.code },
            });

            await tx.workflowAuditLog.create({
                data: {
                    workflowTypeId: workflow.id,
                    aggregateType: 'ProcessRun',
                    aggregateId: run.id,
                    fromStatus: current.code,
                    toStatus: transition.toStatus.code,
                },
            });
        });

        this.logger.log(
            `Config transition DONE runId=${run.id} → ${transition.toStatus.code}`,
        );

        const runs = await this.prisma.processRun.findMany({
            where: { orderProcessId: run.orderProcessId },
            include: {
                runTemplate: {
                    include: {
                        configWorkflowType: { include: { statuses: true } },
                    },
                },
            },
        });

        const allConfigRunsTerminal = runs.every(r => {
            const terminal = r.runTemplate.configWorkflowType.statuses.find(
                s => s.isTerminal,
            );
            return terminal && r.statusCode === terminal.code;
        });

        if (!allConfigRunsTerminal) {
            this.logger.debug(
                `Not all config runs terminal orderProcessId=${run.orderProcessId}`,
            );
            return;
        }

        this.logger.log(
            `All config runs terminal → attempting CONFIG_COMPLETE emission orderProcessId=${run.orderProcessId}`,
        );

        await this.prisma.transaction(async tx => {
            const updated = await tx.orderProcess.updateMany({
                where: {
                    id: run.orderProcessId,
                    configCompletedAt: null,
                },
                data: {
                    configCompletedAt: new Date(),
                },
            });

            if (updated.count === 0) {
                this.logger.debug(
                    `CONFIG_COMPLETE already emitted orderProcessId=${run.orderProcessId}`,
                );
                return;
            }

            this.logger.log(
                `CONFIG_COMPLETE emitted orderProcessId=${run.orderProcessId}`,
            );

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'OrderProcess',
                    aggregateId: run.orderProcessId,
                    eventType: 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'CONFIG_COMPLETE' },
                },
            });

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: run.orderProcess.orderId,
                    eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'CONFIG_COMPLETE' },
                },
            });
        });
    }

    /* =========================================================
     * PROCESS RUN – LIFECYCLE
     * ========================================================= */

    private async handleProcessRunLifecycleTransition(event: {
        aggregateId: string;
    }) {
        this.logger.debug(
            `PROCESS_RUN_LIFECYCLE_TRANSITION_REQUESTED runId=${event.aggregateId}`,
        );

        const run = await this.prisma.processRun.findUnique({
            where: { id: event.aggregateId },
            include: {
                runTemplate: {
                    include: {
                        lifecycleWorkflowType: {
                            include: {
                                statuses: true,
                                transitions: {
                                    include: { fromStatus: true, toStatus: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!run) {
            this.logger.warn(`ProcessRun not found runId=${event.aggregateId}`);
            return;
        }
        const workflow = run.runTemplate.lifecycleWorkflowType;
        const current = workflow.statuses.find(
            s => s.code === run.lifeCycleStatusCode,
        );

        if (!current) {
            this.logger.warn(
                `Invalid lifecycle status runId=${run.id}, status=${run.lifeCycleStatusCode}`,
            );
            return;
        }

        const transition = workflow.transitions.find(
            t => t.fromStatusId === current.id,
        );

        if (!transition) {
            this.logger.debug(
                `No lifecycle transition runId=${run.id}, status=${current.code}`,
            );
            return;
        }

        this.logger.log(
            `Lifecycle transition START runId=${run.id} ${current.code} → ${transition.toStatus.code}`,
        );

        await this.prisma.transaction(async tx => {
            await tx.processRun.update({
                where: { id: run.id },
                data: { lifeCycleStatusCode: transition.toStatus.code },
            });

            await tx.workflowAuditLog.create({
                data: {
                    workflowTypeId: workflow.id,
                    aggregateType: 'ProcessRun',
                    aggregateId: run.id,
                    fromStatus: current.code,
                    toStatus: transition.toStatus.code,
                },
            });

            const runs = await tx.processRun.findMany({
                where: { orderProcessId: run.orderProcessId },
                include: {
                    runTemplate: {
                        include: {
                            lifecycleWorkflowType: { include: { statuses: true } },
                        },
                    },
                },
            });

            const allRunsTerminal = runs.every(r => {
                const terminal = r.runTemplate.lifecycleWorkflowType.statuses.find(
                    s => s.isTerminal,
                );
                return terminal && r.lifeCycleStatusCode === terminal.code;
            });

            if (!allRunsTerminal) {
                this.logger.debug(
                    `Not all ProcessRuns terminal orderProcessId=${run.orderProcessId}`,
                );
                return;
            }

            this.logger.log(
                `ALL_RUNS_COMPLETED emitted orderProcessId=${run.orderProcessId}`,
            );

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'OrderProcess',
                    aggregateId: run.orderProcessId,
                    eventType: 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'ALL_RUNS_COMPLETED' },
                },
            });
        });
    }

    /* =========================================================
     * ORDER PROCESS – LIFECYCLE
     * ========================================================= */

    private async handleOrderProcessLifecycleTransition(event: {
        aggregateId: string;
    }) {
        this.logger.debug(
            `ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED orderProcessId=${event.aggregateId}`,
        );

        await this.prisma.transaction(async tx => {
            const orderProcess = await tx.orderProcess.findUnique({
                where: { id: event.aggregateId },
            });

            if (!orderProcess) {
                this.logger.warn(
                    `OrderProcess not found id=${event.aggregateId}`,
                );
                return;
            }

            const workflow = await tx.workflowType.findUnique({
                where: { id: orderProcess.workflowTypeId },
                include: {
                    statuses: true,
                    transitions: {
                        include: { fromStatus: true, toStatus: true },
                    },
                },
            });

            if (!workflow) return;

            const current = workflow.statuses.find(
                s => s.code === orderProcess.statusCode,
            );
            if (!current) return;

            const transition = workflow.transitions.find(
                t => t.fromStatusId === current.id,
            );
            if (!transition) {
                this.logger.debug(
                    `No OrderProcess transition id=${orderProcess.id}, status=${current.code}`,
                );
                return;
            }

            this.logger.log(
                `OrderProcess transition START id=${orderProcess.id} ${current.code} → ${transition.toStatus.code}`,
            );

            await tx.orderProcess.update({
                where: { id: orderProcess.id },
                data: { statusCode: transition.toStatus.code },
            });

            this.logger.log(
                `OrderProcess transition DONE id=${orderProcess.id} → ${transition.toStatus.code}`,
            );

            const processes = await tx.orderProcess.findMany({
                where: { orderId: orderProcess.orderId },
            });

            const workflows = await tx.workflowType.findMany({
                where: {
                    id: { in: [...new Set(processes.map(p => p.workflowTypeId))] },
                },
                include: { statuses: true },
            });

            const wfById = new Map(workflows.map(w => [w.id, w]));

            const allCompleted = processes.every(p => {
                const wf = wfById.get(p.workflowTypeId);
                const terminal = wf?.statuses.find(s => s.isTerminal);
                return terminal && p.statusCode === terminal.code;
            });

            if (!allCompleted) {
                this.logger.debug(
                    `Not all OrderProcesses terminal orderId=${orderProcess.orderId}`,
                );
                return;
            }

            this.logger.log(
                `Order lifecycle emitted orderId=${orderProcess.orderId}`,
            );

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: orderProcess.orderId,
                    eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: {},
                },
            });
        });
    }

    /* =========================================================
     * ORDER – LIFECYCLE
     * ========================================================= */

    private async handleOrderLifecycleTransition(event: {
        aggregateId: string;
    }) {
        this.logger.debug(
            `ORDER_LIFECYCLE_TRANSITION_REQUESTED orderId=${event.aggregateId}`,
        );

        const order = await this.prisma.order.findUnique({
            where: { id: event.aggregateId },
        });

        if (!order) {
            this.logger.warn(`Order not found id=${event.aggregateId}`);
            return;
        }

        const workflow = await this.prisma.workflowType.findUnique({
            where: { id: order.workflowTypeId },
            include: {
                statuses: true,
                transitions: {
                    include: { fromStatus: true, toStatus: true },
                },
            },
        });

        if (!workflow) return;

        const current = workflow.statuses.find(
            s => s.code === order.statusCode,
        );
        if (!current) return;

        const transition = workflow.transitions.find(
            t => t.fromStatusId === current.id,
        );
        if (!transition) {
            this.logger.debug(
                `No Order transition orderId=${order.id}, status=${current.code}`,
            );
            return;
        }

        this.logger.log(
            `Order transition START orderId=${order.id} ${current.code} → ${transition.toStatus.code}`,
        );

        await this.prisma.transaction(async tx => {
            await tx.order.update({
                where: { id: order.id },
                data: { statusCode: transition.toStatus.code },
            });

            await tx.workflowAuditLog.create({
                data: {
                    workflowTypeId: workflow.id,
                    aggregateType: 'Order',
                    aggregateId: order.id,
                    fromStatus: current.code,
                    toStatus: transition.toStatus.code,
                },
            });
        });

        this.logger.log(
            `Order transition DONE orderId=${order.id} → ${transition.toStatus.code}`,
        );
    }
}
