import type { CreateOrderDto } from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { OrderProcessStatus, OrderStatus, Prisma, ProcessRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';
import { RequestContextStore } from '../common/context/request-context.store';
import { ContextLogger } from '../common/logger/context.logger';
import { OrdersQueryDto } from '../dto/orders.query.dto';
import { toOrderSummary } from '../mappers/order.mapper';


const SYSTEM_USER_ID = 'a98afcd6-e0d9-4948-afb8-11fb4d18185a';

@Injectable()
export class OrdersService {
    private readonly logger = new ContextLogger(OrdersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloudflare: CloudflareService,
    ) { }

    /* ========================== QUERY ========================== */
    async getAll(query: OrdersQueryDto) {
        const {
            page = 1,
            limit = 12,
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
         * STATUS NORMALIZATION (FIXED)
         * ========================== */
        const statusCodes: OrderStatus[] | undefined = status
            ? status
                .split(',')
                .map(s => s.trim())
                .filter((s): s is OrderStatus =>
                    Object.values(OrderStatus).includes(s as OrderStatus),
                )
            : undefined;

        if (status && !statusCodes?.length) {
            throw new BadRequestException('Invalid status value');
        }

        /* ==========================
         * WHERE CLAUSE
         * ========================== */
        const where: Prisma.OrderWhereInput = {
            deletedAt: null,

            ...(statusCodes?.length && {
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

        const [total, orders] = await this.prisma.transaction([
            this.prisma.order.count({ where }),

            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },

                include: {
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },

                    customer: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },

                    processes: {
                        include: {
                            process: {
                                select: {
                                    id: true,
                                    name: true,
                                },
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
                                    executor: {
                                        select: { id: true, name: true },
                                    },
                                    reviewer: {
                                        select: { id: true, name: true },
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

    async getOrderCards(query: OrdersQueryDto) {
        const {
            page = 1,
            limit = 12,
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
         * STATUS NORMALIZATION (FIXED)
         * ========================== */
        const statusCodes: OrderStatus[] | undefined = status
            ? status
                .split(',')
                .map(s => s.trim())
                .filter((s): s is OrderStatus =>
                    Object.values(OrderStatus).includes(s as OrderStatus),
                )
            : undefined;

        if (status && !statusCodes?.length) {
            throw new BadRequestException('Invalid status value');
        }

        /* ==========================
         * WHERE CLAUSE
         * ========================== */
        const where: Prisma.OrderWhereInput = {
            deletedAt: null,

            ...(statusCodes?.length && {
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

        const [total, orders] = await this.prisma.transaction([
            this.prisma.order.count({ where }),

            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },

                select: {
                    id: true,
                    code: true,
                    quantity: true,
                    statusCode: true,
                    jobCode: true,
                    createdAt: true,
                    images: true,

                    customer: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },

                    processes: {
                        select: {
                            totalRuns: true,
                        },
                    },
                },
            }),
        ]);

        const mappedOrders = orders.map(order => ({
            id: order.id,
            code: order.code,
            quantity: order.quantity,
            status: order.statusCode,
            jobCode: order.jobCode,
            createdAt: order.createdAt,
            images: order.images,
            customer: order.customer,
            totalRuns: order.processes.reduce(
                (sum, p) => sum + p.totalRuns,
                0,
            ),
        }));

        return {
            data: mappedOrders,
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
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },

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
                                executor: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                                reviewer: {
                                    select: {
                                        id: true,
                                        name: true,
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
        const ctx = RequestContextStore.getStore();
        if (!ctx?.user) {
            throw new BadRequestException('User context missing');
        }

        const ctxuser = ctx.user;
        const orderId = randomUUID();
        const uploadedImageUrls = dto.images ?? [];

        if (uploadedImageUrls.some(url => !this.cloudflare.isValidImageUrl(url))) {
            throw new BadRequestException('Invalid image URLs provided');
        }

        const processIds = dto.processes.map(p => p.processId);
        const processCountMap = new Map(
            dto.processes.map(p => [p.processId, p.count]),
        );

        try {
            return await this.prisma.transaction(async tx => {

                /* =====================================================
                 * LOAD PROCESSES (LEANER)
                 * ===================================================== */
                const processes = await tx.process.findMany({
                    where: { id: { in: processIds }, isEnabled: true },
                    select: {
                        id: true,
                        runDefs: {
                            orderBy: { sortOrder: 'asc' },
                            select: {
                                displayName: true,
                                runTemplate: {
                                    select: {
                                        id: true,
                                        configWorkflowTypeId: true,
                                        lifecycleWorkflowTypeId: true,
                                        lifecycleWorkflowType: {
                                            select: {
                                                statuses: {
                                                    where: { isInitial: true },
                                                    select: { code: true },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });

                if (processes.length !== processIds.length) {
                    throw new BadRequestException(
                        'One or more processes are disabled or invalid',
                    );
                }

                const code = await this.generateOrderCode(tx);

                /* =====================================================
                 * CREATE ORDER
                 * ===================================================== */
                await tx.order.create({
                    data: {
                        id: orderId,
                        code,
                        customerId: dto.customerId,
                        quantity: dto.quantity,
                        statusCode: OrderStatus.CONFIGURE,
                        createdById: ctxuser.id,
                        totalProcesses: dto.processes.length,
                        completedProcesses: 0,
                        images: uploadedImageUrls,
                        ...(dto.jobCode && { jobCode: dto.jobCode }),
                    },
                });

                /* =====================================================
                 * CREATE ORDER PROCESSES (BATCH)
                 * ===================================================== */
                const orderProcessesData = processes.map(p => {
                    const count = processCountMap.get(p.id)!;
                    return {
                        orderId,
                        processId: p.id,
                        statusCode: OrderProcessStatus.CONFIGURE,
                        totalRuns: count * p.runDefs.length,
                        configCompletedRuns: 0,
                        lifecycleCompletedRuns: 0,
                    };
                });

                await tx.orderProcess.createMany({
                    data: orderProcessesData,
                });

                const orderProcesses = await tx.orderProcess.findMany({
                    where: { orderId },
                    select: { id: true, processId: true },
                });

                const orderProcessMap = new Map(
                    orderProcesses.map(op => [op.processId, op.id]),
                );

                /* =====================================================
                 * CREATE RUNS (IN MEMORY)
                 * ===================================================== */
                const runsToCreate: Prisma.ProcessRunCreateManyInput[] = [];

                for (const process of processes) {
                    const count = processCountMap.get(process.id)!;
                    const orderProcessId = orderProcessMap.get(process.id)!;

                    let runNumber = 1;

                    for (let batch = 0; batch < count; batch++) {
                        for (const def of process.runDefs) {

                            const statuses =
                                def.runTemplate.lifecycleWorkflowType.statuses;
                            let initialStatus = '';


                            if (statuses.length === 0) {
                                initialStatus = '';
                            } else {
                                initialStatus = statuses[0].code;
                            }

                            runsToCreate.push({
                                orderProcessId,
                                runTemplateId: def.runTemplate.id,
                                runNumber: runNumber++,
                                displayName: `${def.displayName} (${batch + 1})`,
                                configWorkflowTypeId: def.runTemplate.configWorkflowTypeId,
                                lifecycleWorkflowTypeId: def.runTemplate.lifecycleWorkflowTypeId,
                                statusCode: ProcessRunStatus.CONFIGURE,
                                lifeCycleStatusCode: initialStatus,
                                fields: {},
                            });
                        }
                    }
                }

                if (runsToCreate.length) {
                    await tx.processRun.createMany({ data: runsToCreate });
                }

                return { id: orderId, code };
            });
        } catch (err) {
            if (uploadedImageUrls.length) {
                await this.cloudflare.deleteFiles(uploadedImageUrls);
            }
            throw err;
        }
    }

    /* ========================== PRODUCTION READY ========================== */
    async setProductionReady(orderId: string) {
        return this.prisma.transaction(async tx => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    processes: {
                        include: { runs: true }
                    }
                }
            });

            if (!order) throw new NotFoundException('Order not found');

            await tx.order.update({
                where: { id: orderId },
                data: { statusCode: OrderStatus.PRODUCTION_READY }
            });

            await tx.orderProcess.updateMany({
                where: { orderId },
                data: { statusCode: OrderProcessStatus.COMPLETE }
            });

            return { success: true };
        });
    }

    async startProduction(orderId: string) {
        return this.prisma.transaction(async tx => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
            });

            if (!order) throw new NotFoundException('Order not found');

            await tx.order.update({
                where: { id: orderId },
                data: { statusCode: OrderStatus.IN_PRODUCTION }
            });

            return { success: true };
        });
    }

    async completeProduction(orderId: string) {
        return this.prisma.transaction(async tx => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    statusCode: true,
                    totalProcesses: true,
                },
            });

            if (!order) {
                throw new NotFoundException('Order not found');
            }

            if (order.statusCode !== OrderStatus.IN_PRODUCTION) {
                throw new BadRequestException(
                    'Order is not in production state',
                );
            }

            /* =====================================
             * LOAD PROCESSES (ONCE)
             * ===================================== */
            const processes = await tx.orderProcess.findMany({
                where: { orderId },
                select: {
                    id: true,
                    totalRuns: true,
                },
            });

            /* =====================================
             * COMPLETE ALL PROCESSES
             * ===================================== */
            await Promise.all(
                processes.map(p =>
                    tx.orderProcess.update({
                        where: { id: p.id },
                        data: {
                            statusCode: OrderProcessStatus.COMPLETE,
                            lifecycleCompletedRuns: p.totalRuns,
                            lifecycleCompletedAt: new Date(),
                        },
                    }),
                ),
            );

            /* =====================================
             * COMPLETE ORDER
             * ===================================== */
            await tx.order.update({
                where: { id: orderId },
                data: {
                    statusCode: OrderStatus.COMPLETE,
                    completedProcesses: order.totalProcesses,
                },
            });

            return { success: true };
        });
    }

    /* =========================================================
     * ORDER TRANSITION
     * ========================================================= */

    //public async transitionOrderById(
    //    tx: Prisma.TransactionClient,
    //    orderId: string,
    //): Promise<void> {
    //    const order = await tx.order.findUnique({
    //        where: { id: orderId },
    //        select: {
    //            id: true,
    //            statusCode: true,
    //        },
    //    });

    //    if (!order) {
    //        this.logger.error(`[ORDER][NOT_FOUND] order=${orderId}`);
    //        return;
    //    }

    //    await this.transitionOrder(tx, order);
    //}

    //public async transitionOrder(
    //    tx: Prisma.TransactionClient,
    //    order: {
    //        id: string;
    //        workflowTypeId: string;
    //        statusCode: string;
    //    },
    //): Promise<string> {

    //    const wf = await tx.workflowType.findUnique({
    //        where: { id: order.workflowTypeId },
    //        select: {
    //            id: true,
    //            statuses: { select: { id: true, code: true } },
    //            transitions: { select: { fromStatusId: true, toStatusId: true } },
    //        },
    //    });

    //    if (!wf) {
    //        throw new BadRequestException('Order workflow missing');
    //    }

    //    const current = wf.statuses.find(s => s.code === order.statusCode);
    //    if (!current) {
    //        throw new BadRequestException('Invalid order status');
    //    }

    //    const transition = wf.transitions.find(
    //        t => t.fromStatusId === current.id,
    //    );
    //    if (!transition) {
    //        this.logger.log(
    //            `[ORDER][NO_TRANSITION] order=${order.id} status=${current.code}`,
    //        );
    //        return "";
    //    }

    //    const toStatus = wf.statuses.find(
    //        s => s.id === transition.toStatusId,
    //    );
    //    if (!toStatus) {
    //        throw new BadRequestException('Invalid order transition target');
    //    }

    //    this.logger.log(
    //        `[ORDER][TRANSITION] order=${order.id} ${current.code} → ${toStatus.code}`,
    //    );

    //    await tx.order.updateMany({
    //        where: {
    //            id: order.id,
    //            statusCode: order.statusCode,
    //        },
    //        data: { statusCode: toStatus.code },
    //    });
    //    return toStatus.code;
    //}

    /* ========================== IMAGE UPLOAD ========================== */

    async uploadImages(orderId: string, files: Express.Multer.File[]) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId, deletedAt: null },
            select: { id: true, code: true, images: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const fileBuffers = files.map(file => file.buffer);
        const filenames = files.map(file => file.originalname);

        this.logger.log(`Uploading ${files.length} images for order ${order.code}`);

        const imageUrls = await this.cloudflare.uploadFiles(
            fileBuffers,
            filenames,
            `orders/${orderId}`,
        );

        const updatedImages = [...order.images, ...imageUrls];

        await this.prisma.order.update({
            where: { id: orderId },
            data: { images: updatedImages },
        });

        this.logger.log(`Successfully uploaded ${imageUrls.length} images for order ${order.code}`);

        return {
            orderId: order.id,
            orderCode: order.code,
            uploadedImages: imageUrls,
            totalImages: updatedImages.length,
        };
    }

    async uploadImagesWithTx(
        prisma: Prisma.TransactionClient,
        orderId: string,
        files: Express.Multer.File[],
    ) {
        const order = await prisma.order.findUnique({
            where: { id: orderId, deletedAt: null },
            select: { id: true, code: true, images: true },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const fileBuffers = files.map(file => file.buffer);
        const filenames = files.map(file => file.originalname);

        this.logger.log(`Uploading ${files.length} images for order ${order.code}`);

        const imageUrls = await this.cloudflare.uploadFiles(
            fileBuffers,
            filenames,
            `orders/${orderId}`,
        );

        const updatedImages = [...order.images, ...imageUrls];

        await prisma.order.update({
            where: { id: orderId },
            data: { images: updatedImages },
        });

        return {
            orderId: order.id,
            orderCode: order.code,
            uploadedImages: imageUrls,
            totalImages: updatedImages.length,
        };
    }


}