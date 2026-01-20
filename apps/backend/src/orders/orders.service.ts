import type { CreateOrderDto } from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersQueryDto } from '../dto/orders.query.dto';
import { toOrderSummary } from '../mappers/order.mapper';
import { OutboxService } from '../outbox/outbox.service';

const SYSTEM_USER_ID = 'a98afcd6-e0d9-4948-afb8-11fb4d18185a';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly outbox: OutboxService,
    ) { }

    /* ========================== QUERY ========================== */

    async getAll(query: OrdersQueryDto) {
        const {
            page = 1,
            limit = 20,
            status,
            customerId,
            search,
            fromDate,
            toDate,
        } = query;

        const skip = (page - 1) * limit;

        /* ==========================
         * DATE NORMALIZATION
         * ========================== */
        let from: Date | undefined;
        let to: Date | undefined;

        if (fromDate) {
            from = new Date(fromDate);
            if (isNaN(from.getTime())) {
                throw new BadRequestException('Invalid fromDate');
            }
            from.setHours(0, 0, 0, 0);
        }

        if (toDate) {
            to = new Date(toDate);
            if (isNaN(to.getTime())) {
                throw new BadRequestException('Invalid toDate');
            }
            to.setHours(23, 59, 59, 999);
        }

        /* ==========================
         * STATUS NORMALIZATION (KEY FIX)
         * ========================== */
        const statusCodes = status
            ? status
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            : undefined;

        if (statusCodes?.length) {
            this.logger.debug(
                `Filtering orders by statusCodes=[${statusCodes.join(', ')}]`,
            );
        }

        /* ==========================
         * WHERE CLAUSE
         * ========================== */
        const where: Prisma.OrderWhereInput = {
            deletedAt: null,

            ...(statusCodes?.length === 1 && {
                statusCode: statusCodes[0],
            }),

            ...(statusCodes && statusCodes.length > 1 && {
                statusCode: { in: statusCodes },
            }),

            ...(customerId && { customerId }),

            ...(search && {
                code: {
                    contains: search,
                    mode: 'insensitive',
                },
            }),

            ...((from || to) && {
                createdAt: {
                    ...(from && { gte: from }),
                    ...(to && { lte: to }),
                },
            }),
        };

        const [total, orders] = await this.prisma.$transaction([
            this.prisma.order.count({ where }),

            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },

                include: {
                    customer: {
                        select: { id: true, code: true, name: true },
                    },
                    processes: {
                        include: {
                            process: {
                                select: { id: true, name: true },
                            },
                            runs: {
                                orderBy: { runNumber: 'asc' },
                                include: {
                                    runTemplate: {
                                        select: {
                                            id: true,
                                            name: true,
                                            fields: true,
                                            lifecycleWorkflowType: {
                                                include: {
                                                    statuses: {
                                                        orderBy: { createdAt: 'asc' },
                                                        select: {
                                                            code: true,
                                                            isInitial: true,
                                                            isTerminal: true,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        return {
            data: orders.map(toOrderSummary),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /* ========================== GET BY ID ========================== */

    async getById(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId, deletedAt: null },
            include: {
                customer: {
                    select: { id: true, code: true, name: true },
                },
                processes: {
                    include: {
                        process: {
                            select: { id: true, name: true },
                        },
                        runs: {
                            orderBy: { runNumber: 'asc' },
                            include: {
                                runTemplate: {
                                    select: {
                                        id: true,
                                        name: true,
                                        fields: true,
                                        lifecycleWorkflowType: {
                                            include: {
                                                statuses: {
                                                    orderBy: { createdAt: 'asc' },
                                                    select: {
                                                        code: true,
                                                        isInitial: true,
                                                        isTerminal: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return toOrderSummary(order);
    }

    /* ========================== CREATE ========================== */

    private async generateOrderCode(
        tx: Prisma.TransactionClient,
    ): Promise<string> {
        const seq = await tx.orderSequence.update({
            where: { id: 1 },
            data: { nextValue: { increment: 1 } },
            select: { nextValue: true },
        });

        const value = seq.nextValue - 1;
        const code = `ORDER-${value}`;

        this.logger.debug(`Generated order code=${code}`);
        return code;
    }

    async create(dto: CreateOrderDto) {
        return this.prisma.$transaction(async (tx) => {
            const processIds = dto.processes.map(p => p.processId);

            const processes = await tx.process.findMany({
                where: { id: { in: processIds }, isEnabled: true },
                select: { id: true },
            });

            if (processes.length !== processIds.length) {
                throw new BadRequestException(
                    'One or more processes are disabled or invalid',
                );
            }

            const workflow = await tx.workflowType.findUniqueOrThrow({
                where: { code: 'ORDER' },
            });

            const initialStatus = await tx.workflowStatus.findFirstOrThrow({
                where: {
                    workflowTypeId: workflow.id,
                    isInitial: true,
                },
            });

            const code = await this.generateOrderCode(tx);

            const order = await tx.order.create({
                data: {
                    code,
                    customerId: dto.customerId,
                    quantity: dto.quantity,
                    workflowTypeId: workflow.id,
                    statusCode: initialStatus.code,
                    createdById: SYSTEM_USER_ID,
                    totalProcesses: dto.processes.length,
                    completedProcesses: 0,
                    jobCode: dto.jobCode,
                },
            });

            const orderId = order.id;

            this.logger.log(
                `ORDER_CREATED start orderId=${orderId}, processes=${dto.processes.length}`,
            );

            const processCountMap = new Map(
                dto.processes.map(p => [p.processId, p.count]),
            );

            const processEntities = await tx.process.findMany({
                where: { id: { in: processIds } },
                include: {
                    runDefs: {
                        orderBy: { sortOrder: 'asc' },
                        include: {
                            runTemplate: {
                                include: {
                                    lifecycleWorkflowType: {
                                        include: { statuses: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            const processWorkflow = await tx.workflowType.findUniqueOrThrow({
                where: { code: 'ORDER_PROCESS' },
            });

            const initialProcessStatus =
                await tx.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowTypeId: processWorkflow.id,
                        isInitial: true,
                    },
                });

            for (const process of processEntities) {
                const count = processCountMap.get(process.id)!;
                const totalRuns = count * process.runDefs.length;

                const orderProcess = await tx.orderProcess.upsert({
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
                        totalRuns,
                        configCompletedRuns: 0,
                        lifecycleCompletedRuns: 0,
                    },
                    update: {},
                });

                const existingRuns = await tx.processRun.count({
                    where: { orderProcessId: orderProcess.id },
                });

                if (existingRuns > 0) {
                    this.logger.warn(
                        `ProcessRuns already exist, skipping creation orderProcessId=${orderProcess.id}`,
                    );
                    continue;
                }

                let runNumber = 1;

                for (let batch = 0; batch < count; batch++) {
                    for (const def of process.runDefs) {
                        const template = def.runTemplate;

                        const initialConfigStatus =
                            await tx.workflowStatus.findFirstOrThrow({
                                where: {
                                    workflowTypeId:
                                        template.configWorkflowTypeId,
                                    isInitial: true,
                                },
                            });

                        const initialLifecycleStatus =
                            template.lifecycleWorkflowType.statuses.find(
                                s => s.isInitial,
                            )!;

                        await tx.processRun.create({
                            data: {
                                orderProcessId: orderProcess.id,
                                runTemplateId: template.id,
                                runNumber: runNumber++,
                                displayName: `${def.displayName} (${batch + 1})`,
                                configWorkflowTypeId:
                                    template.configWorkflowTypeId,
                                lifecycleWorkflowTypeId:
                                    template.lifecycleWorkflowTypeId,
                                statusCode: initialConfigStatus.code,
                                lifeCycleStatusCode:
                                    initialLifecycleStatus.code,
                                fields: {},
                            },
                        });
                    }
                }
            }

            this.logger.log(`Order created id=${orderId}, code=${code}`);

            return { id: orderId, code };
        });
    }


    /* =========================================================
     * ORDER TRANSITION
     * ========================================================= */

    public async transitionOrderById(
        tx: Prisma.TransactionClient,
        orderId: string,
    ): Promise<void> {
        const order = await tx.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                workflowTypeId: true,
                statusCode: true,
            },
        });

        if (!order) {
            this.logger.error(`[ORDER][NOT_FOUND] order=${orderId}`);
            return;
        }

        await this.transitionOrder(tx, order);
    }

    public async transitionOrder(
        tx: Prisma.TransactionClient,
        order: {
            id: string;
            workflowTypeId: string;
            statusCode: string;
        },
    ): Promise<string> {

        const wf = await tx.workflowType.findUnique({
            where: { id: order.workflowTypeId },
            select: {
                id: true,
                statuses: { select: { id: true, code: true } },
                transitions: { select: { fromStatusId: true, toStatusId: true } },
            },
        });

        if (!wf) {
            throw new BadRequestException('Order workflow missing');
        }

        const current = wf.statuses.find(s => s.code === order.statusCode);
        if (!current) {
            throw new BadRequestException('Invalid order status');
        }

        const transition = wf.transitions.find(
            t => t.fromStatusId === current.id,
        );
        if (!transition) {
            this.logger.log(
                `[ORDER][NO_TRANSITION] order=${order.id} status=${current.code}`,
            );
            return "";
        }

        const toStatus = wf.statuses.find(
            s => s.id === transition.toStatusId,
        );
        if (!toStatus) {
            throw new BadRequestException('Invalid order transition target');
        }

        this.logger.log(
            `[ORDER][TRANSITION] order=${order.id} ${current.code} → ${toStatus.code}`,
        );

        await tx.order.updateMany({
            where: {
                id: order.id,
                statusCode: order.statusCode,
            },
            data: { statusCode: toStatus.code },
        });
        return toStatus.code;
    }

}