import type { CreateOrderDto, UpdateOrderDto } from '@app/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderProcessStatus,
  OrderStatus,
  Prisma,
  ProcessRunStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';
import { RequestContextStore } from '../common/context/request-context.store';
import { ContextLogger } from '../common/logger/context.logger';
import { generateFiscalCode } from '../common/utils/fiscal-year.utils';
import { OrdersQueryDto } from '../dto/orders.query.dto';
import { toOrderSummary } from '../mappers/order.mapper';
import { BillingCalculatorService } from '../billing/services/billing-calculator.service';
import { recomputeOrderEstimate } from './utils/order-estimate.util';

@Injectable()
export class OrdersService {
  private readonly logger = new ContextLogger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareService,
    private readonly billingCalculator: BillingCalculatorService,
  ) {}

  public async validateCreditLimit(
    tx: any,
    customerId: string,
    additionalAmount: number = 0,
    excludeOrderId?: string,
  ) {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const creditLimit = Number(customer.creditLimit || 0);
    if (creditLimit <= 0) return;

    const activeOrders = await tx.order.findMany({
      where: {
        customerId,
        deletedAt: null,
        isTest: false,
        id: excludeOrderId ? { not: excludeOrderId } : undefined,
        statusCode: {
          // Only count orders in CONFIGURE status as "active/estimated"
          // because orders in PRODUCTION_READY/IN_PRODUCTION/COMPLETE are now in outstandingAmount
          in: [OrderStatus.CONFIGURE],
        },
      },
      select: {
        estimatedAmount: true,
      },
    });

    const activeAmount = activeOrders.reduce(
      (sum, o) => sum + Number(o.estimatedAmount || 0),
      0,
    );

    const exposure =
      Math.max(Number(customer.outstandingAmount || 0), 0) +
      activeAmount +
      additionalAmount;

    if (exposure >= creditLimit) {
      throw new BadRequestException('Credit limit reached');
    }
  }

  /* ========================== HELPERS ========================== */

  // B1: Shared where-clause builder for getAll and getOrderCards
  // B6: Includes OR across locationId, preProductionLocationId, postProductionLocationId
  private buildOrderWhere(query: OrdersQueryDto): {
    where: Prisma.OrderWhereInput;
  } {
    const { status, customerId, search, fromDate, toDate } = query;

    let from: Date | undefined;
    let to: Date | undefined;

    if (fromDate) {
      from = new Date(fromDate);
      if (isNaN(from.getTime()))
        throw new BadRequestException('Invalid fromDate');
      from.setHours(0, 0, 0, 0);
    }

    if (toDate) {
      to = new Date(toDate);
      if (isNaN(to.getTime())) throw new BadRequestException('Invalid toDate');
      to.setHours(23, 59, 59, 999);
    }

    const statusCodes: OrderStatus[] | undefined = status
      ? status
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is OrderStatus =>
            Object.values(OrderStatus).includes(s as OrderStatus),
          )
      : undefined;

    if (status && !statusCodes?.length) {
      throw new BadRequestException('Invalid status value');
    }

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      isTest: query.isTest !== undefined ? Boolean(query.isTest) : false,

      ...(statusCodes?.length && {
        statusCode: { in: statusCodes },
      }),

      ...(customerId && { customerId }),

      ...(search && {
        OR: [
          {
            code: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            jobCode: {
              contains: search,
              mode: 'insensitive' as Prisma.QueryMode,
            },
          },
          {
            customer: {
              name: {
                contains: search,
                mode: 'insensitive' as Prisma.QueryMode,
              },
            },
          },
          (() => {
            const matchingStatuses = Object.values(OrderStatus).filter((s) =>
              s.toLowerCase().includes(search.toLowerCase()),
            );
            return matchingStatuses.length > 0
              ? {
                  statusCode: { in: matchingStatuses },
                }
              : {};
          })(),
        ].filter((condition) => Object.keys(condition).length > 0),
      }),

      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),

      // B6: check all three location fields so pre/post-production locations are included
      ...(query.locationId && {
        processes: {
          some: {
            runs: {
              some: {
                OR: [
                  { locationId: query.locationId },
                  { preProductionLocationId: query.locationId },
                  { postProductionLocationId: query.locationId },
                ],
              },
            },
          },
        },
      }),
    };

    return { where };
  }

  // B3: createMany + batch lifecycle history instead of per-run create loop
  private async createRunsBatch(
    tx: any,
    runsToCreate: Prisma.ProcessRunCreateManyInput[],
  ): Promise<void> {
    if (!runsToCreate.length) return;

    await tx.processRun.createMany({ data: runsToCreate });

    const runsNeedingHistory = runsToCreate.filter(
      (r) => r.lifeCycleStatusCode,
    );
    if (!runsNeedingHistory.length) return;

    // Find back created runs using the deterministic orderProcessId + runNumber key
    const created = await tx.processRun.findMany({
      where: {
        OR: runsNeedingHistory.map((r) => ({
          orderProcessId: r.orderProcessId,
          runNumber: r.runNumber,
        })),
      },
      select: { id: true, lifeCycleStatusCode: true },
    });

    if (created.length) {
      await tx.processRunLifecycleHistory.createMany({
        data: created.map((run: any) => ({
          processRunId: run.id,
          statusCode: run.lifeCycleStatusCode,
          expectedDate: new Date(),
        })),
      });
    }
  }

  /* ========================== QUERY ========================== */

  // B1: extracted where builder; B2: aggregate estimatedAmount instead of fetching all run fields
  async getAll(query: OrdersQueryDto) {
    const { page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;
    const { where } = this.buildOrderWhere(query);

    const [total, orders, totalsAgg, estimatedAgg] =
      await this.prisma.transaction([
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
                        billingFormula: true,
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
                    lifecycleHistories: {
                      orderBy: { createdAt: 'desc' },
                    },
                    executor: {
                      select: { id: true, name: true },
                    },
                    reviewer: {
                      select: { id: true, name: true },
                    },
                    location: {
                      select: { id: true, name: true, code: true },
                    },
                    preProductionLocation: {
                      select: { id: true, name: true, code: true },
                    },
                    postProductionLocation: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
            },
          },
        }),

        this.prisma.order.aggregate({
          where,
          _sum: { quantity: true },
        }),

        // B2: use stored estimatedAmount instead of fetching all run fields
        this.prisma.order.aggregate({
          where,
          _sum: { estimatedAmount: true },
        }),
      ]);

    return {
      data: orders.map(toOrderSummary),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalQuantity: totalsAgg._sum.quantity || 0,
        totalEstimatedAmount: Number(estimatedAgg._sum.estimatedAmount ?? 0),
      },
    };
  }

  // B1: extracted where builder; B2: aggregate estimatedAmount instead of fetching all run fields
  async getOrderCards(query: OrdersQueryDto) {
    const { page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;
    const { where } = this.buildOrderWhere(query);

    const [total, orders, totalsAgg, estimatedAgg] =
      await this.prisma.transaction([
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

        this.prisma.order.aggregate({
          where,
          _sum: { quantity: true },
        }),

        // B2: use stored estimatedAmount instead of fetching all run fields
        this.prisma.order.aggregate({
          where,
          _sum: { estimatedAmount: true },
        }),
      ]);

    const mappedOrders = orders.map((order) => ({
      id: order.id,
      code: order.code,
      quantity: order.quantity,
      status: order.statusCode,
      jobCode: order.jobCode,
      createdAt: order.createdAt,
      images: order.images,
      customer: order.customer,
      totalRuns: order.processes.reduce((sum, p) => sum + p.totalRuns, 0),
    }));

    return {
      data: mappedOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalQuantity: totalsAgg._sum.quantity || 0,
        totalEstimatedAmount: Number(estimatedAgg._sum.estimatedAmount ?? 0),
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
                    billingFormula: true,
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
                lifecycleHistories: {
                  orderBy: { createdAt: 'desc' },
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
                location: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
                preProductionLocation: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
                postProductionLocation: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
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

  async create(dto: CreateOrderDto) {
    const ctx = RequestContextStore.getStore();
    if (!ctx?.user) {
      throw new BadRequestException('User context missing');
    }

    const ctxuser = ctx.user;
    const orderId = randomUUID();
    const uploadedImageUrls = dto.images ?? [];

    if (
      uploadedImageUrls.some((url) => !this.cloudflare.isValidImageUrl(url))
    ) {
      throw new BadRequestException('Invalid image URLs provided');
    }

    const processIds = dto.processes.map((p) => p.processId);
    const processCountMap = new Map(
      dto.processes.map((p) => [p.processId, p.count]),
    );

    try {
      return await this.prisma.transaction(async (tx) => {
        /* =====================================================
         * CREDIT LIMIT CHECK
         * ===================================================== */
        await this.validateCreditLimit(tx, dto.customerId);

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

        const code = await generateFiscalCode(
          tx,
          dto.isTest ? 'TESTORD' : 'ORD',
        );

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
            isTest: dto.isTest ?? false,
            createdById: ctxuser.id,
            totalProcesses: dto.processes.length,
            completedProcesses: 0,
            images: uploadedImageUrls,
            useOrderImageForRuns: dto.useOrderImageForRuns ?? false,
            ...(dto.jobCode && { jobCode: dto.jobCode }),
          },
        });

        /* =====================================================
         * CREATE ORDER PROCESSES (BATCH)
         * ===================================================== */
        const orderProcessesData = processes.map((p) => {
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
          orderProcesses.map((op) => [op.processId, op.id]),
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
              const statuses = def.runTemplate.lifecycleWorkflowType.statuses;
              const initialStatus = statuses.length > 0 ? statuses[0].code : '';

              runsToCreate.push({
                orderProcessId,
                runTemplateId: def.runTemplate.id,
                runNumber: runNumber++,
                displayName: `${def.displayName} (${batch + 1})`,
                configWorkflowTypeId: def.runTemplate.configWorkflowTypeId,
                lifecycleWorkflowTypeId:
                  def.runTemplate.lifecycleWorkflowTypeId,
                statusCode: ProcessRunStatus.CONFIGURE,
                lifeCycleStatusCode: initialStatus,
                fields: {},
              });
            }
          }
        }

        // B3: batch createMany + lifecycle history instead of per-run create loop
        if (runsToCreate.length) {
          await this.createRunsBatch(tx, runsToCreate);
          await recomputeOrderEstimate(tx, orderId, this.billingCalculator);
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

  async reorder(sourceOrderId: string) {
    const ctx = RequestContextStore.getStore();
    if (!ctx?.user) {
      throw new BadRequestException('User context missing');
    }

    const ctxuser = ctx.user;

    const newOrderId = randomUUID();

    return this.prisma.transaction(async (tx) => {
      /* =====================================================
       * 1️⃣ Load source order (LEAN BUT COMPLETE)
       * ===================================================== */
      const sourceOrder = await tx.order.findUnique({
        where: { id: sourceOrderId, deletedAt: null },
        include: {
          customer: true,
          processes: {
            include: {
              process: true,
              runs: {
                orderBy: { runNumber: 'asc' },
                include: {
                  runTemplate: {
                    include: {
                      lifecycleWorkflowType: {
                        include: {
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
          },
        },
      });

      if (!sourceOrder) {
        throw new NotFoundException('Source order not found');
      }

      /* =====================================================
       * CREDIT LIMIT CHECK
       * ===================================================== */
      await this.validateCreditLimit(tx, sourceOrder.customerId);

      /* =====================================================
       * 2️⃣ Generate NEW order code
       * ===================================================== */
      const newCode = await generateFiscalCode(
        tx,
        sourceOrder.isTest ? 'TESTORD' : 'ORD',
      );

      /* =====================================================
       * 3️⃣ Create new order (RESET FIELDS)
       * ===================================================== */
      await tx.order.create({
        data: {
          id: newOrderId,
          code: newCode,
          customerId: sourceOrder.customerId,
          quantity: sourceOrder.quantity,
          statusCode: OrderStatus.CONFIGURE,
          isTest: sourceOrder.isTest,
          createdById: ctxuser.id,
          totalProcesses: sourceOrder.totalProcesses,
          completedProcesses: 0,
          images: [],
        },
      });

      /* =====================================================
       * 4️⃣ Create OrderProcesses
       * ===================================================== */
      const orderProcessMap = new Map<string, string>();

      for (const op of sourceOrder.processes) {
        const newOp = await tx.orderProcess.create({
          data: {
            orderId: newOrderId,
            processId: op.processId,
            statusCode: OrderProcessStatus.CONFIGURE,
            totalRuns: op.totalRuns,
            configCompletedRuns: 0,
            lifecycleCompletedRuns: 0,
            remainingRuns: op.totalRuns,
          },
        });

        orderProcessMap.set(op.id, newOp.id);
      }

      /* =====================================================
       * 5️⃣ Clone ProcessRuns (RESET STATE)
       * ===================================================== */
      const runsToCreate: Prisma.ProcessRunCreateManyInput[] = [];

      for (const op of sourceOrder.processes) {
        const newOrderProcessId = orderProcessMap.get(op.id)!;

        for (const run of op.runs) {
          const statuses = run.runTemplate.lifecycleWorkflowType.statuses;

          const initialStatus = statuses.length > 0 ? statuses[0].code : '';

          runsToCreate.push({
            orderProcessId: newOrderProcessId,
            runTemplateId: run.runTemplateId,
            runNumber: run.runNumber,
            displayName: run.displayName,
            configWorkflowTypeId: run.configWorkflowTypeId,
            lifecycleWorkflowTypeId: run.lifecycleWorkflowTypeId,
            statusCode: ProcessRunStatus.CONFIGURE,
            lifeCycleStatusCode: initialStatus,
            fields: run.fields ?? {},
            executorId: null,
            reviewerId: null,
          });
        }
      }

      // B3: batch createMany + lifecycle history instead of per-run create loop
      if (runsToCreate.length) {
        await this.createRunsBatch(tx, runsToCreate);
      }

      this.logger.log(
        `[REORDER_SUCCESS] source=${sourceOrderId} newOrder=${newOrderId} code=${newCode}`,
      );

      return {
        id: newOrderId,
        code: newCode,
      };
    });
  }

  async updateBasicDetails(orderId: string, dto: UpdateOrderDto) {
    const ctx = RequestContextStore.getStore();
    if (!ctx?.user) {
      throw new BadRequestException('User context missing');
    }

    // 1️⃣ Validate incoming images
    if (
      dto.images &&
      dto.images.some((url) => !this.cloudflare.isValidImageUrl(url))
    ) {
      throw new BadRequestException('Invalid image URLs provided');
    }

    let oldImages: string[] = [];

    try {
      return await this.prisma.transaction(async (tx) => {
        /* =====================================================
         * LOAD ORDER (WITH EXISTING IMAGES)
         * ===================================================== */
        const order = await tx.order.findFirst({
          where: { id: orderId, deletedAt: null },
          select: {
            id: true,
            statusCode: true,
            images: true,
          },
        });

        if (!order) {
          throw new BadRequestException('Order not found');
        }

        // Capture old images for cleanup AFTER commit
        if (dto.images) {
          oldImages = order.images ?? [];
        }

        /* =====================================================
         * UPDATE ORDER
         * ===================================================== */
        await tx.order.update({
          where: { id: orderId },
          data: {
            ...(dto.customerId && { customerId: dto.customerId }),
            ...(dto.quantity && { quantity: dto.quantity }),
            ...(dto.jobCode !== undefined && { jobCode: dto.jobCode }),

            // 🔑 replace images entirely
            ...(dto.images && { images: dto.images }),

            // 🔑 If it's PRODUCTION_READY, move it back to CONFIGURE for re-verification.
            // But don't touch status for IN_PRODUCTION, COMPLETE, or BILLED/GROUP_BILLED
            // as they are further along and resetting would be destructive.
            ...(order.statusCode === OrderStatus.PRODUCTION_READY && {
              statusCode: OrderStatus.CONFIGURE,
              completedProcesses: 0,
            }),
          },
        });

        // 🔑 SUBTRACT FROM OUTSTANDING IF MOVING BACK TO CONFIGURE
        if (
          order.statusCode === OrderStatus.PRODUCTION_READY &&
          dto.customerId === undefined
        ) {
          const amount = new Prisma.Decimal(
            (dto.quantity
              ? (order as any).estimatedAmount
              : (order as any).estimatedAmount
            ).toString(),
          );
          // Wait, I need to be careful with estimates here.
          // To be safe, I'll just reload the order's estimated amount.
          const currentOrder = await tx.order.findUnique({
            where: { id: orderId },
            select: { estimatedAmount: true, customerId: true },
          });
          if (currentOrder && !currentOrder.estimatedAmount.isZero()) {
            await tx.customer.update({
              where: { id: currentOrder.customerId },
              data: {
                outstandingAmount: { decrement: currentOrder.estimatedAmount },
              },
            });
            this.logger.log(
              `[OUTSTANDING] Subtracted ${currentOrder.estimatedAmount} from customer ${currentOrder.customerId} (Reverting to CONFIGURE)`,
            );
          }
        }

        return { success: true };
      });
    } catch (err) {
      // 🔥 DB failed → delete newly uploaded images
      if (dto.images?.length) {
        await this.cloudflare.deleteFiles(dto.images);
      }
      throw err;
    } finally {
      // 🧹 DB success → delete old images
      if (oldImages.length) {
        await this.cloudflare.deleteFiles(oldImages);
      }
    }
  }

  async addProcessToOrder(
    orderId: string,
    dto: { processId: string; count: number },
  ) {
    const ctx = RequestContextStore.getStore();
    if (!ctx?.user) {
      throw new BadRequestException('User context missing');
    }

    const { processId, count } = dto;

    if (count <= 0) {
      throw new BadRequestException('Process count must be greater than zero');
    }

    return this.prisma.transaction(async (tx) => {
      /* =====================================================
       * LOAD ORDER
       * ===================================================== */
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        select: { id: true, statusCode: true },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      /* =====================================================
       * PREVENT DUPLICATE PROCESS
       * ===================================================== */
      const existing = await tx.orderProcess.findFirst({
        where: { orderId, processId },
      });

      if (existing) {
        throw new BadRequestException('Process already exists on this order');
      }

      /* =====================================================
       * LOAD PROCESS (LEAN, SAME AS CREATE)
       * ===================================================== */
      const process = await tx.process.findFirst({
        where: { id: processId, isEnabled: true },
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

      if (!process) {
        throw new BadRequestException('Process not found or disabled');
      }

      /* =====================================================
       * CREATE ORDER PROCESS
       * ===================================================== */
      const orderProcess = await tx.orderProcess.create({
        data: {
          orderId,
          processId: process.id,
          statusCode: OrderProcessStatus.CONFIGURE,
          totalRuns: count * process.runDefs.length,
          configCompletedRuns: 0,
          lifecycleCompletedRuns: 0,
          remainingRuns: count * process.runDefs.length,
        },
        select: { id: true },
      });

      /* =====================================================
       * CREATE RUNS (IN MEMORY, SAME PATTERN)
       * ===================================================== */
      const runsToCreate: Prisma.ProcessRunCreateManyInput[] = [];

      let runNumber = 1;

      for (let batch = 0; batch < count; batch++) {
        for (const def of process.runDefs) {
          const statuses = def.runTemplate.lifecycleWorkflowType.statuses;

          const initialStatus = statuses.length > 0 ? statuses[0].code : '';

          runsToCreate.push({
            orderProcessId: orderProcess.id,
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

      // B3: batch createMany + lifecycle history instead of per-run create loop
      if (runsToCreate.length) {
        await this.createRunsBatch(tx, runsToCreate);
      }

      /* =====================================================
       * UPDATE ORDER
       * ===================================================== */
      if (
        (
          [
            OrderStatus.PRODUCTION_READY,
            OrderStatus.IN_PRODUCTION,
            OrderStatus.COMPLETE,
          ] as OrderStatus[]
        ).includes(order.statusCode)
      ) {
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { estimatedAmount: true, customerId: true },
        });
        if (currentOrder && !currentOrder.estimatedAmount.isZero()) {
          await tx.customer.update({
            where: { id: currentOrder.customerId },
            data: {
              outstandingAmount: { decrement: currentOrder.estimatedAmount },
            },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          totalProcesses: { increment: 1 },
          statusCode: OrderStatus.CONFIGURE,
          completedProcesses: 0,
        },
      });

      return {
        orderId,
        processId,
        totalRuns: runsToCreate.length,
      };
    });
  }

  /* ========================== PRODUCTION READY ========================== */
  async setProductionReady(orderId: string) {
    return this.prisma.transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          processes: {
            include: { runs: true },
          },
        },
      });

      if (!order) throw new NotFoundException('Order not found');

      /* =====================================================
       * 🔄 RECOMPUTE ESTIMATE (ENSURE ACCURACY)
       * ===================================================== */
      await recomputeOrderEstimate(tx, orderId, this.billingCalculator);

      // Reload to get the fresh amount
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { estimatedAmount: true, customerId: true, statusCode: true },
      });

      if (!freshOrder) throw new NotFoundException('Order lost during update');

      // 🔑 ADD TO OUTSTANDING AMOUNT AT RATE CONFIG DONE
      const amount = new Prisma.Decimal(freshOrder.estimatedAmount.toString());
      if (!amount.isZero()) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { outstandingAmount: { increment: amount } },
        });
        this.logger.log(
          `[OUTSTANDING] Added ${amount} to customer ${order.customerId} for order ${orderId} (Rate Config Done)`,
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { statusCode: OrderStatus.PRODUCTION_READY },
      });

      await tx.orderProcess.updateMany({
        where: { orderId },
        data: { statusCode: OrderProcessStatus.COMPLETE },
      });

      return { success: true };
    });
  }

  async startProduction(orderId: string) {
    return this.prisma.transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new NotFoundException('Order not found');

      await tx.order.update({
        where: { id: orderId },
        data: { statusCode: OrderStatus.IN_PRODUCTION },
      });

      return { success: true };
    });
  }

  async completeProduction(orderId: string) {
    return this.prisma.transaction(async (tx) => {
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
        throw new BadRequestException('Order is not in production state');
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
        processes.map((p) =>
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

  /* ========================== DELETE ========================== */

  async delete(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.prisma.transaction(async (tx) => {
      // 🔑 SUBTRACT FROM OUTSTANDING IF IT WAS ALREADY ADDED
      if (
        (
          [
            OrderStatus.PRODUCTION_READY,
            OrderStatus.IN_PRODUCTION,
            OrderStatus.COMPLETE,
          ] as OrderStatus[]
        ).includes(order.statusCode)
      ) {
        const amount = new Prisma.Decimal(order.estimatedAmount.toString());
        if (!amount.isZero()) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { outstandingAmount: { decrement: amount } },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { deletedAt: new Date() },
      });
    });

    this.logger.log(`[ORDER][DELETE] order=${orderId}`);

    return { success: true };
  }

  // B9: handle outstandingAmount adjustment for billed orders on bulk delete
  async deleteBulk(orderIds: string[]) {
    if (!orderIds.length) return { success: true, count: 0 };

    return this.prisma.transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { id: { in: orderIds }, deletedAt: null },
        select: {
          id: true,
          statusCode: true,
          estimatedAmount: true,
          customerId: true,
        },
      });

      const billableStatuses = new Set<OrderStatus>([
        OrderStatus.PRODUCTION_READY,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.COMPLETE,
      ]);

      const customerDecrements = new Map<string, Prisma.Decimal>();
      for (const order of orders) {
        if (
          billableStatuses.has(order.statusCode) &&
          !order.estimatedAmount.isZero()
        ) {
          const current =
            customerDecrements.get(order.customerId) ?? new Prisma.Decimal(0);
          customerDecrements.set(
            order.customerId,
            current.add(order.estimatedAmount),
          );
        }
      }

      const result = await tx.order.updateMany({
        where: { id: { in: orderIds }, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await Promise.all(
        [...customerDecrements.entries()].map(([customerId, amount]) =>
          tx.customer.update({
            where: { id: customerId },
            data: { outstandingAmount: { decrement: amount } },
          }),
        ),
      );

      this.logger.log(
        `[ORDER][BULK_DELETE] count=${result.count} ids=${orderIds.join(',')}`,
      );

      return { success: true, count: result.count };
    });
  }

  /* ========================== IMAGE UPLOAD ========================== */

  async uploadImages(orderId: string, files: Express.Multer.File[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, deletedAt: null },
      select: { id: true, code: true, images: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const fileBuffers = files.map((file) => file.buffer);
    const filenames = files.map((file) => file.originalname);

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

    this.logger.log(
      `Successfully uploaded ${imageUrls.length} images for order ${order.code}`,
    );

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

    const fileBuffers = files.map((file) => file.buffer);
    const filenames = files.map((file) => file.originalname);

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

  async addRunToProcess(
    orderId: string,
    orderProcessId: string,
    countParam: any = 1,
  ) {
    const count = parseInt(countParam?.toString() || '1', 10);

    if (isNaN(count) || count <= 0) {
      throw new BadRequestException('Run count must be a positive number');
    }

    return this.prisma.transaction(async (tx) => {
      const orderProcess = await tx.orderProcess.findFirst({
        where: {
          id: orderProcessId,
          orderId,
        },
      });

      if (!orderProcess) {
        throw new NotFoundException('Order process not found');
      }

      const process = await tx.process.findUnique({
        where: { id: orderProcess.processId },
        include: {
          runDefs: {
            orderBy: { sortOrder: 'asc' },
            include: {
              runTemplate: {
                include: {
                  lifecycleWorkflowType: {
                    include: {
                      statuses: {
                        where: { isInitial: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!process) {
        throw new NotFoundException('Process template not found');
      }

      if (!process.runDefs || process.runDefs.length === 0) {
        throw new BadRequestException(
          `Process '${process.name}' has no run templates defined. Cannot add runs.`,
        );
      }

      // Find current max runNumber
      const maxRun = await tx.processRun.findFirst({
        where: { orderProcessId: orderProcess.id },
        orderBy: { runNumber: 'desc' },
      });

      let nextRunNumber = (maxRun?.runNumber ?? 0) + 1;

      const runsToCreateData: Prisma.ProcessRunCreateManyInput[] = [];

      for (let i = 0; i < count; i++) {
        const currentTotalRuns =
          orderProcess.totalRuns + i * process.runDefs.length;
        const batchIndex =
          Math.floor(currentTotalRuns / process.runDefs.length) + 1;

        for (const def of process.runDefs) {
          const statuses = def.runTemplate.lifecycleWorkflowType.statuses;
          const initialStatus = statuses.length > 0 ? statuses[0].code : '';

          runsToCreateData.push({
            orderProcessId: orderProcess.id,
            runTemplateId: def.runTemplateId,
            runNumber: nextRunNumber++,
            displayName: `${def.displayName} (${batchIndex})`,
            configWorkflowTypeId: def.runTemplate.configWorkflowTypeId,
            lifecycleWorkflowTypeId: def.runTemplate.lifecycleWorkflowTypeId,
            statusCode: ProcessRunStatus.CONFIGURE,
            lifeCycleStatusCode: initialStatus,
            fields: {},
          });
        }
      }

      // B3: batch createMany + lifecycle history instead of per-run create loop
      if (runsToCreateData.length > 0) {
        await this.createRunsBatch(tx, runsToCreateData);
      }
      const totalNewRuns = runsToCreateData.length;

      // Update stats
      await tx.orderProcess.update({
        where: { id: orderProcess.id },
        data: {
          totalRuns: { increment: totalNewRuns },
          remainingRuns: { increment: totalNewRuns },
          statusCode: OrderProcessStatus.CONFIGURE,
        },
      });

      // Also update Order status to CONFIGURE
      await tx.order.update({
        where: { id: orderId },
        data: {
          statusCode: OrderStatus.CONFIGURE,
          completedProcesses: 0, // Reset completion count
        },
      });

      return { success: true, added: totalNewRuns };
    });
  }

  async deleteRunFromProcess(
    orderId: string,
    processId: string,
    runId: string,
  ) {
    return this.prisma.transaction(async (tx) => {
      const orderProcess = await tx.orderProcess.findFirst({
        where: {
          id: processId,
          orderId,
        },
      });

      if (!orderProcess) {
        throw new NotFoundException('Order process not found');
      }

      // B10: include workflow statuses to check isTerminal instead of hardcoded 'COMPLETE'
      const run = await tx.processRun.findFirst({
        where: { id: runId, orderProcessId: orderProcess.id },
        include: {
          runTemplate: {
            select: {
              lifecycleWorkflowType: {
                select: {
                  statuses: { select: { code: true, isTerminal: true } },
                },
              },
            },
          },
        },
      });

      if (!run) {
        throw new NotFoundException('Run not found');
      }

      // Cleanup images if any
      const values = run.fields as Record<string, any>;
      if (
        values?.images &&
        Array.isArray(values.images) &&
        values.images.length > 0
      ) {
        try {
          await this.cloudflare.deleteFiles(values.images);
        } catch (error) {
          this.logger.error(`Failed to delete images for run ${runId}`, error);
        }
      }

      await tx.processRun.delete({
        where: { id: runId },
      });

      // Update stats
      const wasConfigComplete = run.statusCode === ProcessRunStatus.COMPLETE;

      // B10: use isTerminal from workflow definition instead of hardcoded string
      const terminalCodes = new Set(
        (run as any).runTemplate?.lifecycleWorkflowType?.statuses
          .filter((s: any) => s.isTerminal)
          .map((s: any) => s.code) ?? [],
      );
      const wasLifecycleComplete =
        !!run.lifeCycleStatusCode && terminalCodes.has(run.lifeCycleStatusCode);

      await tx.orderProcess.update({
        where: { id: orderProcess.id },
        data: {
          totalRuns: { decrement: 1 },
          remainingRuns: { decrement: 1 },
          ...(wasConfigComplete && { configCompletedRuns: { decrement: 1 } }),
          ...(wasLifecycleComplete && {
            lifecycleCompletedRuns: { decrement: 1 },
          }),
        },
      });

      return { success: true };
    });
  }

  async deleteProcessFromOrder(orderId: string, processId: string) {
    return this.prisma.transaction(async (tx) => {
      const orderProcess = await tx.orderProcess.findFirst({
        where: {
          id: processId,
          orderId,
        },
        include: {
          runs: true,
        },
      });

      if (!orderProcess) {
        throw new NotFoundException('Order process not found');
      }

      // Cleanup images for all runs in this process if they were any
      for (const run of orderProcess.runs) {
        const values = run.fields as Record<string, any>;
        if (
          values?.images &&
          Array.isArray(values.images) &&
          values.images.length > 0
        ) {
          try {
            await this.cloudflare.deleteFiles(values.images);
          } catch (error) {
            this.logger.error(
              `Failed to delete images for run ${run.id}`,
              error,
            );
          }
        }
      }

      await tx.orderProcess.delete({
        where: { id: orderProcess.id },
      });

      const wasCompleted =
        orderProcess.statusCode === OrderProcessStatus.COMPLETE;

      await tx.order.update({
        where: { id: orderId },
        data: {
          totalProcesses: { decrement: 1 },
          ...(wasCompleted && { completedProcesses: { decrement: 1 } }),
        },
      });

      return { success: true };
    });
  }
}
