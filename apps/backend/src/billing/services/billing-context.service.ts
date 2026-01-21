import type { CreateBillingContextDto } from "@app/contracts";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { BillingSnapshotService } from "./billing-snapshot.service";

@Injectable()
export class BillingContextService {
    private readonly logger = new Logger(BillingContextService.name);

    constructor(private readonly prisma: PrismaService,
        private readonly billingSnapshotService: BillingSnapshotService
    ) { }

    async create(dto: CreateBillingContextDto) {
        this.logger.log(
            `Creating billing context type=${dto.type} name=${dto.name}`
        );

        const { orderIds = [], ...contextData } = dto;

        if (dto.type === "GROUP" && dto.name) {
            const existing = await this.prisma.billingContext.findFirst({
                where: {
                    type: "GROUP",
                    name: dto.name
                }
            });

            if (existing) {
                throw new BadRequestException(
                    `Billing group with name '${dto.name}' already exists`
                );
            }
        }

        const result = await this.prisma.$transaction(async (tx) => {
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

            const context = await tx.billingContext.create({
                data: {
                    ...contextData,
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
                `Billing context created id=${context.id}`
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



    async getAllContexts() {
        this.logger.log("Fetching all billing contexts");

        const contexts = await this.prisma.billingContext.findMany({
            include: {
                _count: {
                    select: { orders: true }
                },
                snapshots: {
                    where: { isLatest: true },
                    take: 1
                }
            },
            orderBy: { createdAt: "desc" },
            where: { type: "GROUP" }
        });

        return contexts.map(ctx => {
            const snapshot = ctx.snapshots[0];

            return {
                id: ctx.id,
                type: ctx.type,
                name: ctx.name,
                description: ctx.description,
                ordersCount: ctx._count.orders,

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
    }

    async getContextById(contextId: string) {
        this.logger.log(`Fetching billing context id=${contextId}`);

        const context = await this.prisma.billingContext.findUnique({
            where: { id: contextId },
            include: {
                orders: {
                    select: {
                        orderId: true
                    }
                },
                snapshots: {
                    where: { isLatest: true },
                    take: 1
                }
            }
        });

        if (!context) {
            throw new BadRequestException(
                `Billing context not found: ${contextId}`
            );
        }

        const snapshot = context.snapshots[0];

        return {
            id: context.id,
            type: context.type,
            name: context.name,
            description: context.description,

            orderIds: context.orders.map(o => o.orderId),

            latestSnapshot: snapshot
                ? {
                    id: snapshot.id,
                    version: snapshot.version,
                    intent: snapshot.intent,
                    isDraft: snapshot.intent === "DRAFT",

                    inputs: snapshot.inputs,
                    result: snapshot.result.toString(),
                    currency: snapshot.currency,

                    calculationType: snapshot.calculationType,
                    reason: snapshot.reason,

                    createdAt: snapshot.createdAt
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

        return this.prisma.$transaction(async (tx) => {
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
