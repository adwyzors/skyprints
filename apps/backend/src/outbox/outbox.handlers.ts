import { Injectable, Logger } from '@nestjs/common';
import jsonLogic from 'json-logic-js';
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

            case 'PROCESS_RUN_CONFIG_TRANSITION_REQUESTED':
                return this.handleProcessRunConfigTransition(event);

            case 'PROCESS_RUN_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleProcessRunLifecycleTransition(event);

            case 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleOrderProcessLifecycleTransition(event);

            case 'ORDER_LIFECYCLE_TRANSITION_REQUESTED':
                return this.handleOrderLifecycleTransition(event);
        }
    }

    /* =========================================================
     * ORDER CREATED
     * ========================================================= */

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

        const processEntities = await this.prisma.process.findMany({
            where: { id: { in: processes.map(p => p.processId) } },
            include: {
                runDefs: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        runTemplate: {
                            include: {
                                lifecycleWorkflowType: { include: { statuses: true } },
                            },
                        },
                    },
                },
            },
        });

        for (const process of processEntities) {
            const count = processCountMap.get(process.id)!;

            const processWorkflow = await this.prisma.workflowType.findUniqueOrThrow({
                where: { code: 'ORDER_PROCESS' },
            });

            const initialProcessStatus =
                await this.prisma.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowTypeId: processWorkflow.id,
                        isInitial: true,
                    },
                });

            const orderProcess = await this.prisma.orderProcess.create({
                data: {
                    orderId,
                    processId: process.id,
                    workflowTypeId: processWorkflow.id,
                    statusCode: initialProcessStatus.code,
                },
            });

            let runNumber = 1;

            for (let batch = 0; batch < count; batch++) {
                for (const def of process.runDefs) {
                    const template = def.runTemplate;

                    const initialConfigStatus =
                        await this.prisma.workflowStatus.findFirstOrThrow({
                            where: {
                                workflowTypeId: template.configWorkflowTypeId,
                                isInitial: true,
                            },
                        });

                    const initialLifecycleStatus =
                        template.lifecycleWorkflowType.statuses.find(s => s.isInitial)!;

                    await this.prisma.processRun.create({
                        data: {
                            orderProcessId: orderProcess.id,
                            runTemplateId: template.id,
                            runNumber: runNumber++,
                            displayName: `${def.displayName} (${batch + 1})`,
                            configWorkflowTypeId: template.configWorkflowTypeId,
                            lifecycleWorkflowTypeId: template.lifecycleWorkflowTypeId,
                            statusCode: initialConfigStatus.code,
                            lifeCycleStatusCode: initialLifecycleStatus.code,
                            fields: {},
                        },
                    });
                }
            }
        }
    }

    /* =========================================================
     * PROCESS RUN – CONFIG WORKFLOW
     * ========================================================= */

    private async handleProcessRunConfigTransition(event: {
        aggregateId: string;
    }) {
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
                orderProcess: {
                    include: {
                        runs: {
                            include: {
                                runTemplate: {
                                    include: {
                                        configWorkflowType: {
                                            include: { statuses: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!run) return;

        const workflow = run.runTemplate.configWorkflowType;

        const current = workflow.statuses.find(
            s => s.code === run.statusCode,
        );
        if (!current) return;

        const transition = workflow.transitions.find(
            t =>
                t.fromStatusId === current.id &&
                (!t.condition ||
                    jsonLogic.apply(JSON.parse(t.condition), {
                        fields: run.fields,
                    })),
        );
        if (!transition) return;

        await this.prisma.$transaction(async tx => {
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

        const runs = await this.prisma.processRun.findMany({
            where: { orderProcessId: run.orderProcessId },
            include: {
                runTemplate: {
                    include: {
                        configWorkflowType: {
                            include: { statuses: true },
                        },
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

        if (allConfigRunsTerminal) {
            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'OrderProcess',
                    aggregateId: run.orderProcessId,
                    eventType: 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: {},
                },
            });

            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: run.orderProcess.orderId,
                    eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: {},
                },
            });
        }
    }

    /* =========================================================
     * PROCESS RUN – LIFECYCLE
     * ========================================================= */

    private async handleProcessRunLifecycleTransition(event: {
        aggregateId: string;
    }) {
        const run = await this.prisma.processRun.findUnique({
            where: { id: event.aggregateId },
            select: {
                id: true,
                lifeCycleStatusCode: true,
                orderProcessId: true,
                runTemplateId: true,
            },
        });

        if (!run) return;

        const runTemplate = await this.prisma.runTemplate.findUnique({
            where: { id: run.runTemplateId },
            include: {
                lifecycleWorkflowType: {
                    include: {
                        statuses: true,
                        transitions: {
                            include: {
                                fromStatus: true,
                                toStatus: true,
                            },
                        },
                    },
                },
            },
        });

        if (!runTemplate) return;

        const workflow = runTemplate.lifecycleWorkflowType;

        const current = workflow.statuses.find(
            s => s.code === run.lifeCycleStatusCode,
        );
        if (!current) return;

        const transition = workflow.transitions.find(
            t => t.fromStatusId === current.id,
        );
        if (!transition) return;

        await this.prisma.$transaction(
            async tx => {
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
                    select: {
                        lifeCycleStatusCode: true,
                        runTemplateId: true,
                    },
                });

                const runTemplateIds = [
                    ...new Set(runs.map(r => r.runTemplateId)),
                ];

                const templates = await tx.runTemplate.findMany({
                    where: { id: { in: runTemplateIds } },
                    include: {
                        lifecycleWorkflowType: {
                            include: { statuses: true },
                        },
                    },
                });

                const templateById = new Map(
                    templates.map(t => [t.id, t]),
                );

                const allRunsCompleted = runs.every(r => {
                    const template = templateById.get(r.runTemplateId);
                    if (!template) return false;

                    const terminal =
                        template.lifecycleWorkflowType.statuses.find(
                            s => s.isTerminal,
                        );

                    return terminal && r.lifeCycleStatusCode === terminal.code;
                });

                if (allRunsCompleted) {
                    await tx.outboxEvent.create({
                        data: {
                            aggregateType: 'OrderProcess',
                            aggregateId: run.orderProcessId,
                            eventType:
                                'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                            payload: {},
                        },
                    });
                }
            },
            { timeout: 60000 },
        );
    }

    /* =========================================================
     * ORDER PROCESS – LIFECYCLE
     * ========================================================= */

    private async handleOrderProcessLifecycleTransition(event: {
        aggregateId: string;
    }) {
        await this.prisma.$transaction(
            async tx => {
                const orderProcess = await tx.orderProcess.findUnique({
                    where: { id: event.aggregateId },
                    select: {
                        id: true,
                        statusCode: true,
                        workflowTypeId: true,
                        orderId: true,
                    },
                });

                if (!orderProcess) return;

                const workflow = await tx.workflowType.findUnique({
                    where: { id: orderProcess.workflowTypeId },
                    include: {
                        statuses: true,
                        transitions: {
                            include: {
                                fromStatus: true,
                                toStatus: true,
                            },
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
                if (!transition) return;

                await tx.orderProcess.update({
                    where: { id: orderProcess.id },
                    data: { statusCode: transition.toStatus.code },
                });

                const processes = await tx.orderProcess.findMany({
                    where: { orderId: orderProcess.orderId },
                    select: {
                        statusCode: true,
                        workflowTypeId: true,
                    },
                });

                const workflowTypeIds = [
                    ...new Set(processes.map(p => p.workflowTypeId)),
                ];

                const workflows = await tx.workflowType.findMany({
                    where: { id: { in: workflowTypeIds } },
                    include: { statuses: true },
                });

                const workflowById = new Map(
                    workflows.map(wf => [wf.id, wf]),
                );

                const allProcessesCompleted = processes.every(op => {
                    const wf = workflowById.get(op.workflowTypeId);
                    if (!wf) return false;

                    const terminal = wf.statuses.find(s => s.isTerminal);
                    return terminal && op.statusCode === terminal.code;
                });

                if (allProcessesCompleted) {
                    await tx.outboxEvent.create({
                        data: {
                            aggregateType: 'Order',
                            aggregateId: orderProcess.orderId,
                            eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                            payload: {},
                        },
                    });
                }
            },
            { timeout: 60000 },
        );
    }

    /* =========================================================
     * ORDER – LIFECYCLE
     * ========================================================= */

    private async handleOrderLifecycleTransition(event: {
        aggregateId: string;
    }) {
        const order = await this.prisma.order.findUnique({
            where: { id: event.aggregateId },
        });

        if (!order) return;

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
                fromStatus: current.code,
                toStatus: transition.toStatus.code,
            },
        });
    }
}
