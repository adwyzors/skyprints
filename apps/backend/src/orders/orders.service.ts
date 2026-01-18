import type { CreateOrderDto } from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toOrderSummary } from '../mappers/order.mapper';
import { OutboxService } from '../outbox/outbox.service';
import { OrdersQueryDto } from '../dto/orders.query.dto';

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

        /**
         * ==========================
         * DATE NORMALIZATION (CRITICAL)
         * ==========================
         *
         * - fromDate: start of day (00:00:00.000)
         * - toDate:   end of day   (23:59:59.999)
         *
         * Prevents:
         * - timezone drift
         * - missing records
         * - off-by-one-day bugs
         */
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

        const where: Prisma.OrderWhereInput = {
            deletedAt: null,

            ...(status && { statusCode: status }),

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

                /**
                 * ALWAYS latest first
                 */
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
            const processIds = dto.processes.map((p) => p.processId);

            const validCount = await tx.process.count({
                where: { id: { in: processIds }, isEnabled: true },
            });

            if (validCount !== processIds.length) {
                throw new BadRequestException(
                    'One or more processes are disabled or invalid',
                );
            }

            const workflow = await tx.workflowType.findUniqueOrThrow({
                where: { code: 'ORDER' },
            });

            const initialStatus = await tx.workflowStatus.findFirstOrThrow({
                where: { workflowTypeId: workflow.id, isInitial: true },
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
                },
            });

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'ORDER',
                    aggregateId: order.id,
                    eventType: 'ORDER_CREATED',
                    payload: {
                        orderId: order.id,
                        orderCode: code,
                        processes: dto.processes,
                    },
                },
            });

            this.logger.log(`Order created id=${order.id}, code=${code}`);

            return { id: order.id, code };
        });
    }
}
