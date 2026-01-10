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
                        runs: {},
                    },
                }
            }
        });
    }

    async getById(orderId: string) {
        return this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                processes: {
                    include: {
                        runs: {},
                    },
                },
            },
        });
    }

    /* -------------------- CREATE ORDER -------------------- */

    async create(dto: CreateOrderDto) {
        return this.prisma.$transaction(async tx => {
            const processIds = dto.processes.map(p => p.processId);

            /* ---- validate processes ---- */
            const validCount = await tx.process.count({
                where: {
                    id: { in: processIds },
                    isEnabled: true,
                },
            });

            if (validCount !== processIds.length) {
                throw new BadRequestException(
                    'One or more processes are disabled or invalid',
                );
            }

            /* ---- initial ORDER status ---- */
            const orderStatus = await tx.workflowStatus.findFirstOrThrow({
                where: {
                    workflowType: { code: 'ORDER' },
                    isInitial: true,
                },
            });

            /* ---- create order ---- */
            const order = await tx.order.create({
                data: {
                    orderCode: `ORD-${Date.now()}`,
                    customerId: dto.customerId,
                    quantity: dto.quantity,
                    statusCode: orderStatus.code,
                },
            });

            /* ---- outbox event ---- */
            await this.outbox.add({
                aggregateType: 'ORDER',
                aggregateId: order.id,
                eventType: 'ORDER_CREATED',
                payload: {
                    orderId: order.id,
                    processes: dto.processes,
                },
            });

            this.logger.log(`Order created: ${order.id}`);
            return order;
        });
    }
}
