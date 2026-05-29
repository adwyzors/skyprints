import type { CreateBillingContextDto } from "@app/contracts";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { ContextLogger } from "../../common/logger/context.logger";
import { generateFiscalCode } from "../../common/utils/fiscal-year.utils";
import { BillingSnapshotService } from "./billing-snapshot.service";
import { BillingCalculatorService } from "./billing-calculator.service";

@Injectable()
export class BillingContextService {
    private readonly logger = new ContextLogger(BillingContextService.name);

    constructor(private readonly prisma: PrismaService,
        private readonly billingSnapshotService: BillingSnapshotService,
        private readonly calculator: BillingCalculatorService
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
                // Determine tax status from the first order (if any) to decide the prefix.
                let taxEnabled = true; // default to true (R) if we can't determine.
                if (orderIds.length > 0) {
                    const firstOrder = await tx.order.findFirst({
                        where: { id: orderIds[0] },
                        select: { customer: { select: { tax: true } } },
                    });
                    taxEnabled = firstOrder?.customer?.tax ?? true;
                }
                const prefix = dto.isTest ? "TESTR" : taxEnabled ? "R" : "D";
                name = await generateFiscalCode(tx, prefix);
            }

            const context = await tx.billingContext.create({
                data: {
                    ...contextData,
                    isTest: dto.isTest ?? false,
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
        search = "",
        isTest = false,
        isTaxEnabled?: boolean
    ) {
        this.logger.log(`Fetching billing contexts page=${page} limit=${limit} search=${search} isTaxEnabled=${isTaxEnabled}`);

        const skip = (page - 1) * limit;

        const where: any = {
            type: "GROUP",
            isTest: isTest,
            ...(isTaxEnabled !== undefined && {
                snapshots: {
                    some: {
                        isLatest: true,
                        taxEnabled: isTaxEnabled
                    }
                }
            }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    {
                        orders: {
                            some: {
                                order: {
                                    OR: [
                                        { code: { contains: search, mode: 'insensitive' } },
                                        { jobCode: { contains: search, mode: 'insensitive' } },
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
                        where: { intent: 'FINAL' },
                        orderBy: { version: 'desc' },
                        take: 1,
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
                        taxEnabled: snapshot.taxEnabled,
                        subTotalAmount: snapshot.subTotalAmount.toString(),
                        taxPercentage: snapshot.taxPercentage.toString(),
                        taxAmount: snapshot.taxAmount.toString(),
                        finalAmount: snapshot.finalAmount.toString(),
                        tdsEnabled: (() => {
                            const meta = (snapshot.inputs as any)?.__TDS_METADATA__;
                            if (meta?.tdsEnabled) return true;
                            const diff = snapshot.subTotalAmount.plus(snapshot.taxAmount).minus(snapshot.finalAmount);
                            return diff.greaterThan(0.01);
                        })(),
                        tdsPercentage: (() => {
                            const meta = (snapshot.inputs as any)?.__TDS_METADATA__;
                            if (meta?.tdsPercentage) return String(meta.tdsPercentage);
                            const diff = snapshot.subTotalAmount.plus(snapshot.taxAmount).minus(snapshot.finalAmount);
                            if (diff.greaterThan(0.01) && snapshot.subTotalAmount.greaterThan(0)) {
                                return diff.div(snapshot.subTotalAmount).mul(100).toFixed(2);
                            }
                            return "0";
                        })(),
                        tdsAmount: (() => {
                            const meta = (snapshot.inputs as any)?.__TDS_METADATA__;
                            if (meta?.tdsAmount) return String(meta.tdsAmount);
                            const diff = snapshot.subTotalAmount.plus(snapshot.taxAmount).minus(snapshot.finalAmount);
                            if (diff.greaterThan(0.01)) {
                                return diff.toFixed(2);
                            }
                            return "0";
                        })(),
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

            orders: await Promise.all(context.orders.map(async ({ order }) => {
                const groupInputs = groupSnapshot?.inputs as any;
                const orderSnapshot = order.billingContexts[0]?.billingContext?.snapshots[0];

                let snapshotResult = orderSnapshot?.result?.toString() || '0';

                // 🔑 IF Group Context, prioritize the result from the group snapshot
                if (context.type === 'GROUP' && groupSnapshot && groupInputs?.[order.id]) {
                    const storedResult = groupInputs[order.id]['__ORDER_RESULT__'];
                    if (storedResult) {
                        snapshotResult = storedResult;
                    } else {
                        // Fallback: Recalculate using order-specific inputs from the group snapshot
                        try {
                            const calc = await this.calculator.calculateForOrder(order.id, groupInputs[order.id]);
                            if (calc) {
                                snapshotResult = calc.result.toString();
                            }
                        } catch (e) {
                            this.logger.error(`Recalculation fallback failed for order ${order.id}: ${e.message}`);
                        }
                    }
                }

                // Resolve customer details from the snapshot if available, otherwise fall back to live customer data.
                const snapshotCustomerMeta = (groupSnapshot?.inputs as any)?.__CUSTOMER_METADATA__
                    || (orderSnapshot?.inputs as any)?.__CUSTOMER_METADATA__;

                let customerInfo = {
                    name: order.customer.name,
                    code: order.customer.code,
                    gstno: order.customer.gstno,
                    tax: order.customer.tax,
                    tds: order.customer.tds,
                    tdsno: order.customer.tdsno,
                    address: order.customer.address
                };

                if (snapshotCustomerMeta) {
                    customerInfo = {
                        name: snapshotCustomerMeta.name || customerInfo.name,
                        code: snapshotCustomerMeta.code || customerInfo.code,
                        gstno: snapshotCustomerMeta.gstno || customerInfo.gstno,
                        tax: snapshotCustomerMeta.tax !== undefined ? snapshotCustomerMeta.tax : customerInfo.tax,
                        tds: snapshotCustomerMeta.tds !== undefined ? snapshotCustomerMeta.tds : customerInfo.tds,
                        tdsno: snapshotCustomerMeta.tdsno !== undefined ? snapshotCustomerMeta.tdsno : customerInfo.tdsno,
                        address: snapshotCustomerMeta.address || customerInfo.address
                    };
                }

                return {
                    id: order.id,
                    code: order.code,
                    jobCode: order.jobCode,
                    status: order.statusCode,
                    quantity: order.quantity,
                    customer: {
                        name: customerInfo.name,
                        code: customerInfo.code,
                        gstno: customerInfo.gstno,
                        tax: customerInfo.tax,
                        tds: customerInfo.tds,
                        tdsno: customerInfo.tdsno,
                        address: customerInfo.address
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
                    billing: {
                        id: orderSnapshot?.id || 'group-context',
                        result: snapshotResult,
                        currency: orderSnapshot?.currency || 'INR',
                        inputs: groupInputs?.[order.id] || orderSnapshot?.inputs || {} // Prefer group inputs if available
                    }
                };
            })),

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

                    taxEnabled: groupSnapshot.taxEnabled,
                    subTotalAmount: groupSnapshot.subTotalAmount.toString(),
                    taxPercentage: groupSnapshot.taxPercentage.toString(),
                    taxAmount: groupSnapshot.taxAmount.toString(),
                    finalAmount: groupSnapshot.finalAmount.toString(),
                    tdsEnabled: (() => {
                        const meta = (groupSnapshot.inputs as any)?.__TDS_METADATA__;
                        if (meta?.tdsEnabled) return true;
                        const diff = groupSnapshot.subTotalAmount.plus(groupSnapshot.taxAmount).minus(groupSnapshot.finalAmount);
                        return diff.greaterThan(0.01);
                    })(),
                    tdsPercentage: (() => {
                        const meta = (groupSnapshot.inputs as any)?.__TDS_METADATA__;
                        if (meta?.tdsPercentage) return String(meta.tdsPercentage);
                        const diff = groupSnapshot.subTotalAmount.plus(groupSnapshot.taxAmount).minus(groupSnapshot.finalAmount);
                        if (diff.greaterThan(0.01) && groupSnapshot.subTotalAmount.greaterThan(0)) {
                            return diff.div(groupSnapshot.subTotalAmount).mul(100).toFixed(2);
                        }
                        return "0";
                    })(),
                    tdsAmount: (() => {
                        const meta = (groupSnapshot.inputs as any)?.__TDS_METADATA__;
                        if (meta?.tdsAmount) return String(meta.tdsAmount);
                        const diff = groupSnapshot.subTotalAmount.plus(groupSnapshot.taxAmount).minus(groupSnapshot.finalAmount);
                        if (diff.greaterThan(0.01)) {
                            return diff.toFixed(2);
                        }
                        return "0";
                    })(),
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
