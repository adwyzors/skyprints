import {
    ConfigureProcessRunDto,
    CreateProcessDto,
    RunTemplateField,
} from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toProcessSummary } from '../mappers/process.mapper';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AdminProcessService {
    private readonly logger = new Logger(AdminProcessService.name);

    constructor(private readonly prisma: PrismaService, private readonly orderService: OrdersService) { }

    /* =========================================================
     * PROCESS CRUD
     * ========================================================= */

    async create(dto: CreateProcessDto) {
        this.logger.log(`[PROCESS][CREATE] name=${dto.name}`);

        return this.prisma.$transaction(async tx => {
            const process = await tx.process.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    isEnabled: dto.isEnabled,
                },
            });

            await tx.processRunDefinition.createMany({
                data: dto.runs.map(r => ({
                    processId: process.id,
                    runTemplateId: r.runTemplateId,
                    displayName: r.displayName,
                    sortOrder: r.sortOrder,
                })),
            });

            this.logger.log(`[PROCESS][CREATED] processId=${process.id}`);
            return process;
        });
    }

    async getById(id: string) {
        const process = await this.prisma.process.findUnique({
            where: { id },
            include: { runDefs: true },
        });
        if (!process) throw new BadRequestException('Process not found');
        return process;
    }

    async getAll() {
        const processes = await this.prisma.process.findMany({
            include: { runDefs: true },
            orderBy: { name: 'asc' },
        });
        return processes.map(toProcessSummary);
    }

    /* =========================================================
     * CONFIGURE RUN (SYNC)
     * ========================================================= */

    async configure(
        orderProcessId: string,
        processRunId: string,
        dto: ConfigureProcessRunDto,
    ) {
        this.logger.log(
            `[CONFIG][START] orderProcessId=${orderProcessId} processRunId=${processRunId}`,
        );

        return this.prisma.$transaction(async tx => {

            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    statusCode: true,
                    fields: true,
                    orderProcessId: true,
                    runTemplate: {
                        select: {
                            fields: true,
                            configWorkflowType: {
                                select: {
                                    id: true,
                                    statuses: {
                                        select: { id: true, code: true, isInitial: true },
                                    },
                                    transitions: {
                                        select: { fromStatusId: true, toStatusId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!run) {
                this.logger.error('[CONFIG][INVALID_RUN]');
                throw new BadRequestException('Invalid process run');
            }

            this.validateFields(
                run.runTemplate.fields as RunTemplateField[],
                dto.fields,
            );

            const wf = run.runTemplate.configWorkflowType;
            if (!wf) {
                throw new BadRequestException('Config workflow missing');
            }

            const current = wf.statuses.find(s => s.code === run.statusCode);
            if (!current || !current.isInitial) {
                throw new BadRequestException('Invalid config state');
            }

            const transition = wf.transitions.find(
                t => t.fromStatusId === current.id,
            );
            if (!transition) {
                throw new BadRequestException('No config transition');
            }

            const toStatus = wf.statuses.find(
                s => s.id === transition.toStatusId,
            );
            if (!toStatus) {
                throw new BadRequestException('Invalid config transition target');
            }

            this.logger.log(
                `[CONFIG][RUN_TRANSITION] run=${run.id} ${current.code} → ${toStatus.code}`,
            );

            await tx.processRun.update({
                where: { id: run.id },
                data: {
                    fields: dto.fields,
                    statusCode: toStatus.code,
                },
            });

            const op = await tx.orderProcess.update({
                where: { id: run.orderProcessId },
                data: { configCompletedRuns: { increment: 1 } },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    configCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            this.logger.log(
                `[CONFIG][ORDER_PROCESS_PROGRESS] orderProcess=${op.id} ${op.configCompletedRuns}/${op.totalRuns}`,
            );

            const finalized = await tx.orderProcess.updateMany({
                where: {
                    id: op.id,
                    configCompletedRuns: op.totalRuns,
                    configCompletedAt: null,
                },
                data: { configCompletedAt: new Date() },
            });

            if (finalized.count === 1) {
                this.logger.log(
                    `[CONFIG][ORDER_PROCESS_COMPLETED] orderProcess=${op.id}`,
                );
                await this.transitionOrderProcess(tx, op);
                /* ============================================================
 * 6️⃣ CHECK IF ALL ORDER PROCESSES ARE CONFIG COMPLETED
 * ============================================================ */

                /**
                 * If ANY order process still has incomplete config → stop
                 */
                const remaining = await tx.orderProcess.count({
                    where: {
                        orderId: op.orderId,
                        configCompletedAt: null,
                    },
                });

                if (remaining > 0) {
                    this.logger.log(
                        `[CONFIG][ORDER_NOT_READY] order=${op.orderId} remainingProcesses=${remaining}`,
                    );
                    return { success: true };
                }

                this.logger.log(
                    `[CONFIG][ALL_ORDER_PROCESSES_CONFIGURED] order=${op.orderId}`,
                );



                /**
                 * Transition order (guarded inside transitionOrder)
                 */
                await this.orderService.transitionOrderById(tx, op.orderId);
            }

            return { success: true };
        });
    }

    /* =========================================================
     * ORDER PROCESS TRANSITION
     * ========================================================= */

    private async transitionOrderProcess(
        tx: Prisma.TransactionClient,
        op: {
            id: string;
            workflowTypeId: string;
            statusCode: string;
        },
    ) {
        const wf = await tx.workflowType.findUnique({
            where: { id: op.workflowTypeId },
            select: {
                id: true,
                statuses: { select: { id: true, code: true } },
                transitions: { select: { fromStatusId: true, toStatusId: true } },
            },
        });

        if (!wf) {
            throw new BadRequestException('OrderProcess workflow missing');
        }

        const current = wf.statuses.find(s => s.code === op.statusCode);
        if (!current) {
            throw new BadRequestException('Invalid OrderProcess status');
        }

        const transition = wf.transitions.find(
            t => t.fromStatusId === current.id,
        );
        if (!transition) {
            this.logger.log(
                `[ORDER_PROCESS][NO_TRANSITION] orderProcess=${op.id}`,
            );
            return;
        }

        const toStatus = wf.statuses.find(
            s => s.id === transition.toStatusId,
        );
        if (!toStatus) {
            throw new BadRequestException('Invalid OrderProcess transition target');
        }

        this.logger.log(
            `[ORDER_PROCESS][TRANSITION] orderProcess=${op.id} ${current.code} → ${toStatus.code}`,
        );

        await tx.orderProcess.updateMany({
            where: {
                id: op.id,
                statusCode: op.statusCode,
            },
            data: {
                statusCode: toStatus.code,
            },
        });
    }

    /* =========================================================
     * RUN LIFECYCLE TRANSITION
     * ========================================================= */

    async transition(orderProcessId: string, processRunId: string) {
        this.logger.log(
            `[LIFECYCLE][START] orderProcessId=${orderProcessId} processRunId=${processRunId}`,
        );

        return this.prisma.$transaction(async tx => {
            const run = await tx.processRun.findFirst({
                where: { id: processRunId, orderProcessId },
                select: {
                    id: true,
                    orderProcessId: true,
                    lifeCycleStatusCode: true,
                    runTemplate: {
                        select: {
                            lifecycleWorkflowType: {
                                select: {
                                    id: true,
                                    statuses: {
                                        select: { id: true, code: true, isTerminal: true },
                                    },
                                    transitions: {
                                        select: { fromStatusId: true, toStatusId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!run) {
                throw new BadRequestException('Invalid process run');
            }

            const wf = run.runTemplate.lifecycleWorkflowType;
            if (!wf) {
                throw new BadRequestException('Lifecycle workflow missing');
            }

            const current = wf.statuses.find(
                s => s.code === run.lifeCycleStatusCode,
            );
            if (!current) {
                throw new BadRequestException('Invalid lifecycle state');
            }

            const transition = wf.transitions.find(
                t => t.fromStatusId === current.id,
            );
            if (!transition) {
                throw new BadRequestException('No lifecycle transition');
            }

            const toStatus = wf.statuses.find(
                s => s.id === transition.toStatusId,
            );
            if (!toStatus) {
                throw new BadRequestException('Invalid lifecycle transition target');
            }

            this.logger.log(
                `[LIFECYCLE][RUN_TRANSITION] run=${run.id} ${current.code} → ${toStatus.code}`,
            );

            await tx.processRun.update({
                where: { id: run.id },
                data: { lifeCycleStatusCode: toStatus.code },
            });

            const orderProcess = await tx.orderProcess.findUnique({
                where: { id: run.orderProcessId },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    lifecycleCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            if (!orderProcess) {
                throw new BadRequestException('Invalid order process');
            }

            const orderSnapshot = await tx.order.findUnique({
                where: { id: orderProcess.orderId },
                select: {
                    id: true,
                    lifecycleStartedAt: true,
                    statusCode: true,
                },
            });

            if (!orderSnapshot) {
                throw new BadRequestException('Invalid order');
            }

            /**
             * Start order lifecycle exactly once
             */
            this.logger.log(orderSnapshot.lifecycleStartedAt);
            this.logger.log('----------');

            let orderStatus: string = orderSnapshot.statusCode;

            if (!orderSnapshot.lifecycleStartedAt) {
                const started = await tx.order.updateMany({
                    where: {
                        id: orderSnapshot.id,
                        lifecycleStartedAt: null,
                    },
                    data: { lifecycleStartedAt: new Date() },
                });

                this.logger.log(started.count);
                this.logger.log('----------');

                if (started.count === 1) {
                    this.logger.log(
                        `[ORDER][LIFECYCLE_STARTED] order=${orderSnapshot.id}`,
                    );

                    const orderForTransition = await tx.order.findUniqueOrThrow({
                        where: { id: orderSnapshot.id },
                        select: {
                            id: true,
                            workflowTypeId: true,
                            statusCode: true,
                        },
                    });

                    orderStatus = await this.orderService.transitionOrder(tx, orderForTransition);
                }
            }

            if (!toStatus.isTerminal) {
                return { success: true, status: orderStatus };
            }

            const updatedOrderProcess = await tx.orderProcess.update({
                where: { id: run.orderProcessId },
                data: { lifecycleCompletedRuns: { increment: 1 } },
                select: {
                    id: true,
                    orderId: true,
                    totalRuns: true,
                    lifecycleCompletedRuns: true,
                    workflowTypeId: true,
                    statusCode: true,
                },
            });

            const finalized = await tx.orderProcess.updateMany({
                where: {
                    id: updatedOrderProcess.id,
                    lifecycleCompletedRuns: updatedOrderProcess.totalRuns,
                    lifecycleCompletedAt: null,
                },
                data: { lifecycleCompletedAt: new Date() },
            });

            if (finalized.count === 1) {
                this.logger.log(
                    `[LIFECYCLE][ORDER_PROCESS_COMPLETED] orderProcess=${updatedOrderProcess.id}`,
                );

                await this.transitionOrderProcess(tx, updatedOrderProcess);

                const updatedOrder = await tx.order.update({
                    where: { id: updatedOrderProcess.orderId },
                    data: { completedProcesses: { increment: 1 } },
                    select: {
                        id: true,
                        workflowTypeId: true,
                        statusCode: true,
                        totalProcesses: true,
                        completedProcesses: true,
                    },
                });

                this.logger.log(
                    `[ORDER][PROGRESS] order=${updatedOrder.id} ${updatedOrder.completedProcesses}/${updatedOrder.totalProcesses}`,
                );

                if (
                    updatedOrder.completedProcesses ===
                    updatedOrder.totalProcesses
                ) {
                    orderStatus = await this.orderService.transitionOrder(tx, updatedOrder);
                }
            }

            return { success: true, status: orderStatus };
        });
    }



    /* =========================================================
     * FIELD VALIDATION
     * ========================================================= */

    private validateFields(
        templateFields: RunTemplateField[],
        inputFields: Record<string, any>,
    ) {
        const map = new Map(templateFields.map(f => [f.key, f]));

        for (const f of templateFields) {
            if (f.required && !(f.key in inputFields)) {
                throw new BadRequestException(`Missing field ${f.key}`);
            }
        }

        for (const [k, v] of Object.entries(inputFields)) {
            const expected = map.get(k);
            if (!expected) {
                throw new BadRequestException(`Unknown field ${k}`);
            }
            if (typeof v !== expected.type) {
                throw new BadRequestException(
                    `Invalid type for ${k}, expected ${expected.type}`,
                );
            }
        }
    }
}
