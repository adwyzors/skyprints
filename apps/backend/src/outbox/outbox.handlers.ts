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
        this.logger.debug(
            `Handling eventType=${event.eventType}, aggregateId=${event.aggregateId}`,
        );

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
            default:
                this.logger.warn(`Unhandled eventType=${event.eventType}`);
        }
    }

    /* =========================================================
     * ORDER CREATED (IDEMPOTENT)
     * ========================================================= */

    private async handleOrderCreated(event: {
        payload: {
            orderId: string;
            processes: { processId: string; count: number }[];
        };
    }) {
        const { orderId, processes } = event.payload;

        this.logger.log(
            `ORDER_CREATED start orderId=${orderId}, processes=${processes.length}`,
        );

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

        for (const process of processEntities) {
            const count = processCountMap.get(process.id)!;

            const orderProcess = await this.prisma.orderProcess.upsert({
                where: {
                    orderId_processId: {
                        orderId,
                        processId: process.id,
                    },
                },
                create: {
                    orderId,
                    processId: process.id,
                    workflowTypeId: processWorkflow.id,
                    statusCode: initialProcessStatus.code,
                },
                update: {},
            });

            const existingRuns = await this.prisma.processRun.count({
                where: { orderProcessId: orderProcess.id },
            });

            if (existingRuns > 0) {
                this.logger.warn(
                    `ProcessRuns already exist for orderProcessId=${orderProcess.id}, skipping`,
                );
                continue;
            }

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
                        template.lifecycleWorkflowType.statuses.find(
                            s => s.isInitial,
                        )!;

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

        this.logger.log(`ORDER_CREATED completed orderId=${orderId}`);
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

        this.logger.log(
            `Config transition START runId=${run.id} ${current.code} → ${transition.toStatus.code}`,
        );

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

        this.logger.log(
            `Config transition DONE runId=${run.id} → ${transition.toStatus.code}`,
        );

        /**
         * ✅ CONFIG COMPLETE → REQUEST WORKFLOW TRANSITIONS
         * ❌ NO lifecycle triggers here
         */
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

        if (allConfigRunsTerminal) {
            this.logger.log(
                `All config runs terminal → requesting OrderProcess & Order workflow transitions`,
            );

            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'OrderProcess',
                    aggregateId: run.orderProcessId,
                    eventType: 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'CONFIG_COMPLETE' },
                },
            });

            await this.prisma.outboxEvent.create({
                data: {
                    aggregateType: 'Order',
                    aggregateId: run.orderProcess.orderId,
                    eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'CONFIG_COMPLETE' },
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
            orderProcess: true,
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

    await this.prisma.$transaction(async tx => {
        // 1️⃣ Transition ProcessRun lifecycle
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

        // 2️⃣ Check if ALL ProcessRuns in this OrderProcess are terminal
        const runs = await tx.processRun.findMany({
            where: { orderProcessId: run.orderProcessId },
            include: {
                runTemplate: {
                    include: {
                        lifecycleWorkflowType: {
                            include: { statuses: true },
                        },
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

        // 3️⃣ If yes → trigger OrderProcess lifecycle transition
        if (allRunsTerminal) {
            this.logger.log(
                `All ProcessRuns terminal → requesting OrderProcess lifecycle transition orderProcessId=${run.orderProcessId}`,
            );

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'OrderProcess',
                    aggregateId: run.orderProcessId,
                    eventType: 'ORDER_PROCESS_LIFECYCLE_TRANSITION_REQUESTED',
                    payload: { reason: 'ALL_RUNS_COMPLETED' },
                },
            });
        }
    });

    this.logger.log(
        `Lifecycle transition DONE runId=${run.id} → ${transition.toStatus.code}`,
    );
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

        await this.prisma.$transaction(async tx => {
            const orderProcess = await tx.orderProcess.findUnique({
                where: { id: event.aggregateId },
                select: {
                    id: true,
                    statusCode: true,
                    workflowTypeId: true,
                    orderId: true,
                },
            });

            if (!orderProcess) {
                this.logger.warn(`OrderProcess not found id=${event.aggregateId}`);
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
                this.logger.log(
                    `All OrderProcesses terminal, triggering Order transition orderId=${orderProcess.orderId}`,
                );

                await tx.outboxEvent.create({
                    data: {
                        aggregateType: 'Order',
                        aggregateId: orderProcess.orderId,
                        eventType: 'ORDER_LIFECYCLE_TRANSITION_REQUESTED',
                        payload: {},
                    },
                });
            }
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

        this.logger.log(
            `Order transition DONE orderId=${order.id} → ${transition.toStatus.code}`,
        );
    }
}
