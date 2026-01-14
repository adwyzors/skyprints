import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from '../../../packages/contracts/dist/order.contract';
import { PrismaService } from '../../prisma/prisma.service';
import { toOrderSummary } from '../mappers/order.mapper';
import { OutboxService } from '../outbox/outbox.service';


@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly outbox: OutboxService,
    ) { }

    async getAll() {
  const orders = await this.prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
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
            },
          },
        },
      },
    },
  });

  return orders.map(toOrderSummary);
}



    async getById(orderId: string) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: {
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



    /* -------------------- CREATE ORDER -------------------- */

    async create(dto: CreateOrderDto) {
        return this.prisma.$transaction(async tx => {
            /* ---------------- VALIDATE PROCESSES ---------------- */

            const processIds = dto.processes.map(p => p.processId);

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

            /* ---------------- ORDER INITIAL STATUS ---------------- */

            const orderWorkflow = await tx.workflowType.findUniqueOrThrow({
                where: { code: 'ORDER' },
            });

            const initialOrderStatus =
                await tx.workflowStatus.findFirstOrThrow({
                    where: {
                        workflowTypeId: orderWorkflow.id,
                        isInitial: true,
                    },
                });

            /* ---------------- CREATE ORDER ---------------- */

            const order = await tx.order.create({
                data: {
                    customerId: dto.customerId,
                    quantity: dto.quantity,
                    workflowTypeId: orderWorkflow.id,
                    statusCode: initialOrderStatus.code,
                    createdById: 'a98afcd6-e0d9-4948-afb8-11fb4d18185a',
                },
            });


            /* ---------------- OUTBOX EVENT ---------------- */

            await tx.outboxEvent.create({
                data: {
                    aggregateType: 'ORDER',
                    aggregateId: order.id,
                    eventType: 'ORDER_CREATED',
                    payload: {
                        orderId: order.id,
                        processes: dto.processes,
                    },
                },
            });

            this.logger.log(`Order created: ${order.id}`);

            return {
                id: order.id,
                status: 'CREATED',
            };
        });
    }
}