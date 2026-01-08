import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly outbox: OutboxService,
    ) { }

    /* -------------------- QUERIES -------------------- */

    async getAll() {
        return this.prisma.order.findMany({
            include: {
                processes: {
                    include: {
                        runs: {
                            include: { runTemplate: true },
                        },
                    },
                },
            },
        });
    }

    async getById(orderId: string) {
        return this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                processes: {
                    include: {
                        runs: {
                            include: { runTemplate: true },
                        },
                    },
                },
            },
        });
    }

    /* -------------------- CREATE ORDER -------------------- */

    async create(dto: CreateOrderDto) {
        return this.prisma.$transaction(async (tx) => {
            /* ---- validate process IDs ---- */
            const validCount = await tx.process.count({
                where: {
                    id: { in: dto.processIds },
                    isEnabled: true,
                },
            });

            if (validCount !== dto.processIds.length) {
                throw new BadRequestException(
                    'One or more processes are disabled or invalid',
                );
            }

            /* ---- get initial ORDER status ---- */
            const orderStatus =
                await tx.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowType: { code: 'ORDER' },
                        isInitial: true,
                    },
                });

            /* ---- create order ---- */
            const order = await tx.order.create({
                data: {
                    orderCode: `ORD-${Date.now()}`,
                    customerName: dto.customerName,
                    quantity: dto.quantity,
                    statusCode: orderStatus.code,
                },
            });

            /* ---- outbox event (atomic with order) ---- */
            await this.outbox.add({
                aggregateType: 'ORDER',
                aggregateId: order.id,
                eventType: 'ORDER_CREATED', // CREATE ENUMS
                payload: {
                    orderId: order.id,
                    processIds: dto.processIds,
                },
            });

            this.logger.log(`Order created: ${order.id}`);
            return order;
        });
    }
}
