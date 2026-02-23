import type { CreateBillingContextDto } from "@app/contracts";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { ContextLogger } from "../../common/logger/context.logger";
import { generateFiscalCode } from "../../common/utils/fiscal-year.utils";
import { BillingSnapshotService } from "./billing-snapshot.service";

@Injectable()
export class BillingContextService {
    private readonly logger = new ContextLogger(BillingContextService.name);

    constructor(private readonly prisma: PrismaService,
        private readonly billingSnapshotService: BillingSnapshotService
    ) { }

    async create(dto: CreateBillingContextDto) {
        this.logger.log(
            `Creating billing context type=${dto.type}`
        );

        const { orderIds = [], ...contextData } = dto;

        const result = await this.prisma.transaction(async (tx) => {

            if (orderIds.length > 0) {
                const validOrders = await tx.order.findMany({
                    where: {
                        id: { in: orderIds },
                        deletedAt: null
                    },
                    select: { id: true }
                });

                if (validOrders.length !== orderIds.length) {
                    throw new BadRequestException(
                        "Invalid orderIds provided"
                    );
                }
            }

            // 🔑 INTERNAL NAME GENERATION FOR GROUP
            let name = contextData.name;

            if (dto.type === "GROUP") {
                name = await generateFiscalCode(tx, "R");
            }

            const context = await tx.billingContext.create({
                data: {
                    ...contextData,
                    name: name!, // guaranteed by logic above
                    orders: orderIds.length
                        ? {
                            createMany: {
                                data: orderIds.map(orderId => ({ orderId })),
                                skipDuplicates: true
                            }
                        }
                        : undefined
                }
            });

            this.logger.log(
                `Billing context created id=${context.id} name=${context.name}`
            );

            return {
                context,
                shouldCreateGroupSnapshot:
                    context.type === "GROUP" &&
                    orderIds.length > 0
            };
        });

        if (result.shouldCreateGroupSnapshot) {
            this.logger.log(
                `Creating GROUP snapshot outside transaction context=${result.context.id}`
            );

            await this.billingSnapshotService.createGroupSnapshot(
                result.context.id
            );
        }

        return result.context;
    }




    async getAllContexts(
        page = 1,
        limit = 12,
        search = ""
    ) {
        this.logger.log(`Fetching billing contexts page=${page} limit=${limit} search=${search}`);

        const skip = (page - 1) * limit;

        const where: any = {
            type: "GROUP",
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    {
                        orders: {
                            some: {
                                order: {
                                    OR: [
                                        { code: { contains: search, mode: 'insensitive' } },
                                        { customer: { name: { contains: search, mode: 'insensitive' } } }
                                    ]
                                }
                            }
                        }
                    }
                ]
            })
        };

        const [total, contexts, totalsAgg] = await Promise.all([
            this.prisma.billingContext.count({ where }),
            this.prisma.billingContext.findMany({
                skip,
                take: limit,
                where,
                include: {
                    _count: {
                        select: { orders: true }
                    },
                    orders: {
                        include: {
                            order: {
                                include: {
                                    customer: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    },
                    snapshots: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 1
                    }
                },
                orderBy: { createdAt: "desc" }
            }),
            // Calculate totals for all matching contexts
            this.prisma.billingContext.findMany({
                where,
                select: {
                    orders: {
                        select: {
                            order: {
                                select: { quantity: true }
                            }
                        }
                    },
                    snapshots: {
                        where: { isLatest: true },
                        select: { result: true }
                    }
                }
            })
        ]);

        let totalQuantity = 0;
        let totalEstimatedAmount = 0;

        totalsAgg.forEach(ctx => {
            // Group total quantity is sum of its orders
            ctx.orders.forEach(o => {
                totalQuantity += o.order.quantity;
            });
            // Group total amount is its latest snapshot result
            if (ctx.snapshots[0]) {
                totalEstimatedAmount += Number(ctx.snapshots[0].result);
            }
        });

        const data = contexts.map(ctx => {
            const snapshot = ctx.snapshots[0];
            const uniqueCustomers = Array.from(new Set(ctx.orders.map(o => o.order.customer.name))).join(', ');
            const uniqueJobCodes = Array.from(new Set(ctx.orders.map(o => o.order.jobCode).filter(Boolean))).join(', ');

            return {
                id: ctx.id,
                type: ctx.type,
                name: ctx.name,
                description: ctx.description,
                ordersCount: ctx._count.orders,
                customerNames: uniqueCustomers,
                jobCodes: uniqueJobCodes,
                latestSnapshot: snapshot
                    ? {
                        id: snapshot.id,
                        version: snapshot.version,
                        intent: snapshot.intent,
                        isDraft: snapshot.intent === "DRAFT",
                        result: snapshot.result.toString(),
                        currency: snapshot.currency,
                        calculationType: snapshot.calculationType,
                        createdAt: snapshot.createdAt
                    }
                    : null
            };
        });

        return {
            res: { data },
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                totalQuantity,
                totalEstimatedAmount
            },
        };
    }

    async getContextById(contextId: string) {
        this.logger.log(`Fetching billing context id=${contextId}`);

        const context = await this.prisma.billingContext.findUnique({
            where: { id: contextId },
            include: {
                orders: {
                    include: {
                        order: {
                            include: {
                                customer: true,
                                processes: {
                                    include: {
                                        process: true,
                                        runs: {
                                            include: {
                                                runTemplate: true
                                            }
                                        }
                                    }
                                },
                                billingContexts: {
                                    where: {
                                        billingContext: {
                                            type: "ORDER"
                                        }
                                    },
                                    take: 1,
                                    orderBy: {
                                        createdAt: 'desc'
                                    },
                                    include: {
                                        billingContext: {
                                            include: {
                                                snapshots: {
                                                    orderBy: {
                                                        createdAt: 'desc'
                                                    },
                                                    take: 1
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                snapshots: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });

        if (!context) {
            throw new BadRequestException(
                `Billing context not found: ${contextId}`
            );
        }

        const groupSnapshot = context.snapshots[0];

        return {
            id: context.id,
            type: context.type,
            name: context.name,
            description: context.description,

            orders: context.orders.map(({ order }) => {
                const orderSnapshot = order.billingContexts[0]?.billingContext?.snapshots[0];
                return {
                    id: order.id,
                    code: order.code,
                    jobCode: order.jobCode,
                    status: order.statusCode,
                    quantity: order.quantity,
                    customer: {
                        name: order.customer.name,
                        code: order.customer.code,
                        gstno: order.customer.gstno,
                        tax: order.customer.tax,
                        tds: order.customer.tds,
                        tdsno: order.customer.tdsno
                    },
                    processes: order.processes.map(p => ({
                        id: p.id,
                        name: p.process.name,
                        runs: p.runs.map(r => ({
                            id: r.id,
                            name: r.displayName || r.runTemplate.name,
                            configStatus: r.statusCode,
                            values: r.fields as Record<string, any>,
                            runTemplate: r.runTemplate
                        }))
                    })),
                    billing: orderSnapshot ? {
                        id: orderSnapshot.id,
                        result: orderSnapshot.result.toString(), // Decimal to string
                        currency: orderSnapshot.currency,
                        inputs: orderSnapshot.inputs // Contains the run-wise rates
                    } : null
                };
            }),

            latestSnapshot: groupSnapshot
                ? {
                    id: groupSnapshot.id,
                    version: groupSnapshot.version,
                    intent: groupSnapshot.intent,
                    isDraft: groupSnapshot.intent === "DRAFT",

                    inputs: groupSnapshot.inputs,
                    result: groupSnapshot.result.toString(),
                    currency: groupSnapshot.currency,

                    calculationType: groupSnapshot.calculationType,
                    reason: groupSnapshot.reason,

                    createdAt: groupSnapshot.createdAt
                }
                : null
        };
    }

    removeOrder(contextId: string, orderId: string) {
        this.logger.log(
            `Removing order=${orderId} from context=${contextId}`
        );

        return this.prisma.billingContextOrder.delete({
            where: {
                billingContextId_orderId: {
                    billingContextId: contextId,
                    orderId
                }
            }
        });
    }

    async addOrders(
        contextId: string,
        orderIds: string[]
    ) {
        this.logger.log(
            `Adding ${orderIds.length} orders to context=${contextId}`
        );

        const uniqueOrderIds = [...new Set(orderIds)];

        return this.prisma.transaction(async (tx) => {
            const existing = await tx.billingContextOrder.findMany({
                where: {
                    billingContextId: contextId,
                    orderId: { in: uniqueOrderIds }
                },
                select: { orderId: true }
            });

            const existingIds = new Set(existing.map(e => e.orderId));

            const toInsert = uniqueOrderIds
                .filter(id => !existingIds.has(id))
                .map(orderId => ({
                    billingContextId: contextId,
                    orderId
                }));

            if (!toInsert.length) {
                this.logger.log(
                    `No new orders to add for context=${contextId}`
                );
                return { added: 0 };
            }

            const result = await tx.billingContextOrder.createMany({
                data: toInsert,
                skipDuplicates: true
            });

            this.logger.log(
                `Added ${result.count} orders to context=${contextId}`
            );

            return { added: result.count };
        });
    }

}
