import type { CreateBillingContextDto } from '@app/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ContextLogger } from '../../common/logger/context.logger';
import { generateFiscalCode } from '../../common/utils/fiscal-year.utils';
import { BillingCalculatorService } from './billing-calculator.service';
import { BillingSnapshotService } from './billing-snapshot.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { CloudflareService } from '../../common/cloudflare.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingContextService {
  private readonly logger = new ContextLogger(BillingContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingSnapshotService: BillingSnapshotService,
    private readonly calculator: BillingCalculatorService,
    private readonly analyticsService: AnalyticsService,
    private readonly cloudflare: CloudflareService,
  ) {}

  async create(dto: CreateBillingContextDto) {
    this.logger.log(`Creating billing context type=${dto.type}`);

    const { orderIds = [], ...contextData } = dto;

    const result = await this.prisma.transaction(async (tx) => {
      if (orderIds.length > 0) {
        const validOrders = await tx.order.findMany({
          where: {
            id: { in: orderIds },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (validOrders.length !== orderIds.length) {
          throw new BadRequestException('Invalid orderIds provided');
        }
      }

      // 🔑 INTERNAL NAME GENERATION FOR GROUP
      let name = contextData.name;

      if (dto.type === 'GROUP') {
        if (dto.isTest) {
          name = await generateFiscalCode(tx, 'TESTR');
        } else {
          // Detect customer tax setting from the first order to choose R vs RC series
          const firstOrder = await tx.order.findFirst({
            where: { id: { in: orderIds } },
            select: { customer: { select: { tax: true } } },
            orderBy: { createdAt: 'asc' },
          });
          const isTaxCustomer = firstOrder?.customer?.tax ?? false;
          // R series = Tax Invoice (tax-enabled customers)
          // RC series = Delivery Challan (non-tax customers)
          const prefix = isTaxCustomer ? 'R' : 'RC';
          name = await generateFiscalCode(tx, prefix);
        }
      }

      const context = await tx.billingContext.create({
        data: {
          ...contextData,
          isTest: dto.isTest ?? false,
          name: name!, // guaranteed by logic above
          orders: orderIds.length
            ? {
                createMany: {
                  data: orderIds.map((orderId) => ({ orderId })),
                  skipDuplicates: true,
                },
              }
            : undefined,
        },
      });

      this.logger.log(
        `Billing context created id=${context.id} name=${context.name}`,
      );

      return {
        context,
        shouldCreateGroupSnapshot:
          context.type === 'GROUP' && orderIds.length > 0,
      };
    });

    if (result.shouldCreateGroupSnapshot) {
      this.logger.log(
        `Creating GROUP snapshot outside transaction context=${result.context.id}`,
      );

      await this.billingSnapshotService.createGroupSnapshot(result.context.id);
    }

    return result.context;
  }

  async getAllContexts(
    page = 1,
    limit = 12,
    search = '',
    isTest = false,
    isTaxEnabled?: boolean,
  ) {
    this.logger.log(
      `Fetching billing contexts page=${page} limit=${limit} search=${search} isTaxEnabled=${isTaxEnabled}`,
    );

    const skip = (page - 1) * limit;

    const where: any = {
      type: 'GROUP',
      isTest: isTest,
      ...(isTaxEnabled !== undefined && {
        snapshots: {
          some: {
            isLatest: true,
            taxEnabled: isTaxEnabled,
          },
        },
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
                    {
                      customer: {
                        name: { contains: search, mode: 'insensitive' },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
    };

    const [total, contexts, totalsAgg] = await Promise.all([
      this.prisma.billingContext.count({ where }),
      this.prisma.billingContext.findMany({
        skip,
        take: limit,
        where,
        include: {
          _count: {
            select: { orders: true },
          },
          orders: {
            include: {
              order: {
                include: {
                  customer: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          snapshots: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Calculate totals for all matching contexts
      this.prisma.billingContext.findMany({
        where,
        select: {
          orders: {
            select: {
              order: {
                select: { quantity: true },
              },
            },
          },
          snapshots: {
            where: { intent: 'FINAL' },
            orderBy: { version: 'desc' },
            take: 1,
            select: { result: true },
          },
        },
      }),
    ]);

    let totalQuantity = 0;
    let totalEstimatedAmount = 0;

    totalsAgg.forEach((ctx) => {
      // Group total quantity is sum of its orders
      ctx.orders.forEach((o) => {
        totalQuantity += o.order.quantity;
      });
      // Group total amount is its latest snapshot result
      if (ctx.snapshots[0]) {
        totalEstimatedAmount += Number(ctx.snapshots[0].result);
      }
    });

    const data = contexts.map((ctx) => {
      const snapshot = ctx.snapshots[0];
      const uniqueCustomers = Array.from(
        new Set(ctx.orders.map((o) => o.order.customer.name)),
      ).join(', ');
      const uniqueJobCodes = Array.from(
        new Set(ctx.orders.map((o) => o.order.jobCode).filter(Boolean)),
      ).join(', ');

      return {
        id: ctx.id,
        type: ctx.type,
        name: ctx.name,
        description: ctx.description,
        ordersCount: ctx._count.orders,
        customerNames: uniqueCustomers,
        jobCodes: uniqueJobCodes,
        createdAt: ctx.createdAt,
        latestSnapshot: snapshot
          ? {
              id: snapshot.id,
              version: snapshot.version,
              intent: snapshot.intent,
              isDraft: snapshot.intent === 'DRAFT',
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
                const diff = snapshot.subTotalAmount
                  .plus(snapshot.taxAmount)
                  .minus(snapshot.finalAmount);
                return diff.greaterThan(0.01);
              })(),
              tdsPercentage: (() => {
                const meta = (snapshot.inputs as any)?.__TDS_METADATA__;
                if (meta?.tdsPercentage) return String(meta.tdsPercentage);
                const diff = snapshot.subTotalAmount
                  .plus(snapshot.taxAmount)
                  .minus(snapshot.finalAmount);
                if (
                  diff.greaterThan(0.01) &&
                  snapshot.subTotalAmount.greaterThan(0)
                ) {
                  return diff.div(snapshot.subTotalAmount).mul(100).toFixed(2);
                }
                return '0';
              })(),
              tdsAmount: (() => {
                const meta = (snapshot.inputs as any)?.__TDS_METADATA__;
                if (meta?.tdsAmount) return String(meta.tdsAmount);
                const diff = snapshot.subTotalAmount
                  .plus(snapshot.taxAmount)
                  .minus(snapshot.finalAmount);
                if (diff.greaterThan(0.01)) {
                  return diff.toFixed(2);
                }
                return '0';
              })(),
              createdAt: snapshot.createdAt,
            }
          : null,
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
        totalEstimatedAmount,
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
                        runTemplate: true,
                      },
                    },
                  },
                },
                billingContexts: {
                  where: {
                    billingContext: {
                      type: 'ORDER',
                    },
                  },
                  take: 1,
                  orderBy: {
                    createdAt: 'desc',
                  },
                  include: {
                    billingContext: {
                      include: {
                        snapshots: {
                          orderBy: {
                            createdAt: 'desc',
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        snapshots: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!context) {
      throw new BadRequestException(`Billing context not found: ${contextId}`);
    }

    const groupSnapshot = context.snapshots[0];

    return {
      id: context.id,
      type: context.type,
      name: context.name,
      description: context.description,
      createdAt: context.createdAt,

      orders: await Promise.all(
        context.orders.map(async ({ order }) => {
          const groupInputs = groupSnapshot?.inputs as any;
          const orderSnapshot =
            order.billingContexts[0]?.billingContext?.snapshots[0];

          let snapshotResult = orderSnapshot?.result?.toString() || '0';

          // 🔑 IF Group Context, prioritize the result from the group snapshot
          if (
            context.type === 'GROUP' &&
            groupSnapshot &&
            groupInputs?.[order.id]
          ) {
            const storedResult = groupInputs[order.id]['__ORDER_RESULT__'];
            if (storedResult) {
              snapshotResult = storedResult;
            } else {
              // Fallback: Recalculate using order-specific inputs from the group snapshot
              try {
                const calc = await this.calculator.calculateForOrder(
                  order.id,
                  groupInputs[order.id],
                );
                if (calc) {
                  snapshotResult = calc.result.toString();
                }
              } catch (e) {
                this.logger.error(
                  `Recalculation fallback failed for order ${order.id}: ${e.message}`,
                );
              }
            }
          }

          // Resolve customer details from the snapshot if available, otherwise fall back to live customer data.
          const snapshotCustomerMeta =
            (groupSnapshot?.inputs as any)?.__CUSTOMER_METADATA__ ||
            (orderSnapshot?.inputs as any)?.__CUSTOMER_METADATA__;

          let customerInfo = {
            name: order.customer.name,
            code: order.customer.code,
            gstno: order.customer.gstno,
            tax: order.customer.tax,
            tds: order.customer.tds,
            tdsno: order.customer.tdsno,
            address: order.customer.address,
          };

          if (snapshotCustomerMeta) {
            customerInfo = {
              name: snapshotCustomerMeta.name || customerInfo.name,
              code: snapshotCustomerMeta.code || customerInfo.code,
              gstno: snapshotCustomerMeta.gstno || customerInfo.gstno,
              tax:
                snapshotCustomerMeta.tax !== undefined
                  ? snapshotCustomerMeta.tax
                  : customerInfo.tax,
              tds:
                snapshotCustomerMeta.tds !== undefined
                  ? snapshotCustomerMeta.tds
                  : customerInfo.tds,
              tdsno:
                snapshotCustomerMeta.tdsno !== undefined
                  ? snapshotCustomerMeta.tdsno
                  : customerInfo.tdsno,
              address: snapshotCustomerMeta.address || customerInfo.address,
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
              address: customerInfo.address,
            },
            processes: order.processes.map((p) => ({
              id: p.id,
              name: p.process.name,
              runs: p.runs.map((r) => ({
                id: r.id,
                name: r.displayName || r.runTemplate.name,
                configStatus: r.statusCode,
                values: r.fields as Record<string, any>,
                runTemplate: r.runTemplate,
              })),
            })),
            billing: {
              id: orderSnapshot?.id || 'group-context',
              result: snapshotResult,
              currency: orderSnapshot?.currency || 'INR',
              inputs: groupInputs?.[order.id] || orderSnapshot?.inputs || {}, // Prefer group inputs if available
            },
          };
        }),
      ),

      latestSnapshot: groupSnapshot
        ? {
            id: groupSnapshot.id,
            version: groupSnapshot.version,
            intent: groupSnapshot.intent,
            isDraft: groupSnapshot.intent === 'DRAFT',

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
              const diff = groupSnapshot.subTotalAmount
                .plus(groupSnapshot.taxAmount)
                .minus(groupSnapshot.finalAmount);
              return diff.greaterThan(0.01);
            })(),
            tdsPercentage: (() => {
              const meta = (groupSnapshot.inputs as any)?.__TDS_METADATA__;
              if (meta?.tdsPercentage) return String(meta.tdsPercentage);
              const diff = groupSnapshot.subTotalAmount
                .plus(groupSnapshot.taxAmount)
                .minus(groupSnapshot.finalAmount);
              if (
                diff.greaterThan(0.01) &&
                groupSnapshot.subTotalAmount.greaterThan(0)
              ) {
                return diff
                  .div(groupSnapshot.subTotalAmount)
                  .mul(100)
                  .toFixed(2);
              }
              return '0';
            })(),
            tdsAmount: (() => {
              const meta = (groupSnapshot.inputs as any)?.__TDS_METADATA__;
              if (meta?.tdsAmount) return String(meta.tdsAmount);
              const diff = groupSnapshot.subTotalAmount
                .plus(groupSnapshot.taxAmount)
                .minus(groupSnapshot.finalAmount);
              if (diff.greaterThan(0.01)) {
                return diff.toFixed(2);
              }
              return '0';
            })(),
            createdAt: groupSnapshot.createdAt,
          }
        : null,
    };
  }

  removeOrder(contextId: string, orderId: string) {
    this.logger.log(`Removing order=${orderId} from context=${contextId}`);

    return this.prisma.billingContextOrder.delete({
      where: {
        billingContextId_orderId: {
          billingContextId: contextId,
          orderId,
        },
      },
    });
  }

  async addOrders(contextId: string, orderIds: string[]) {
    this.logger.log(`Adding ${orderIds.length} orders to context=${contextId}`);

    const uniqueOrderIds = [...new Set(orderIds)];

    return this.prisma.transaction(async (tx) => {
      const existing = await tx.billingContextOrder.findMany({
        where: {
          billingContextId: contextId,
          orderId: { in: uniqueOrderIds },
        },
        select: { orderId: true },
      });

      const existingIds = new Set(existing.map((e) => e.orderId));

      const toInsert = uniqueOrderIds
        .filter((id) => !existingIds.has(id))
        .map((orderId) => ({
          billingContextId: contextId,
          orderId,
        }));

      if (!toInsert.length) {
        this.logger.log(`No new orders to add for context=${contextId}`);
        return { added: 0 };
      }

      const result = await tx.billingContextOrder.createMany({
        data: toInsert,
        skipDuplicates: true,
      });

      this.logger.log(`Added ${result.count} orders to context=${contextId}`);

      return { added: result.count };
    });
  }

  async getContextsInRange(startDateStr: string, endDateStr: string) {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const contexts = await this.prisma.billingContext.findMany({
      where: {
        type: 'GROUP',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          include: {
            order: {
              include: {
                customer: {
                  select: { name: true },
                },
              },
            },
          },
        },
        snapshots: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contexts.map((ctx) => {
      const snapshot = ctx.snapshots[0];
      const uniqueCustomers = Array.from(
        new Set(ctx.orders.map((o) => o.order.customer.name)),
      ).join(', ');

      return {
        id: ctx.id,
        type: ctx.type,
        name: ctx.name,
        description: ctx.description,
        ordersCount: ctx._count.orders,
        customerNames: uniqueCustomers,
        createdAt: ctx.createdAt,
        latestSnapshot: snapshot
          ? {
              id: snapshot.id,
              version: snapshot.version,
              intent: snapshot.intent,
              result: snapshot.result.toString(),
              taxEnabled: snapshot.taxEnabled,
              subTotalAmount: snapshot.subTotalAmount.toString(),
              taxPercentage: snapshot.taxPercentage.toString(),
              taxAmount: snapshot.taxAmount.toString(),
              finalAmount: snapshot.finalAmount.toString(),
              createdAt: snapshot.createdAt,
            }
          : null,
      };
    });
  }

  async deleteContextsInRange(startDateStr: string, endDateStr: string) {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    // 1. Get all contexts in the range
    const contexts = await this.prisma.billingContext.findMany({
      where: {
        type: 'GROUP',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        orders: {
          include: {
            order: {
              select: {
                id: true,
                images: true,
              },
            },
          },
        },
      },
    });

    if (contexts.length === 0) {
      return { success: true, count: 0 };
    }

    const contextIds = contexts.map((c) => c.id);
    const orderIds = contexts.flatMap((c) => c.orders.map((o) => o.order.id));

    // Get images from the orders to delete
    const ordersWithImages = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, images: true },
    });

    // Get the process runs for these orders
    const runsWithImages = await this.prisma.processRun.findMany({
      where: {
        orderProcess: {
          orderId: { in: orderIds },
        },
      },
      select: { fields: true },
    });

    // Collect all image URLs
    const imageUrlSet = new Set<string>();
    for (const order of ordersWithImages) {
      for (const url of order.images ?? []) {
        if (typeof url === 'string' && url.trim()) {
          imageUrlSet.add(url);
        }
      }
    }
    for (const run of runsWithImages) {
      const fields = run.fields as Record<string, any>;
      if (fields?.images && Array.isArray(fields.images)) {
        for (const url of fields.images) {
          if (typeof url === 'string' && url.trim()) {
            imageUrlSet.add(url);
          }
        }
      }
    }

    const allUrls = Array.from(imageUrlSet);

    // 2. Perform soft-delete of orders and delete of billing records in a transaction
    await this.prisma.transaction(async (tx) => {
      // Soft-delete all associated orders (deletedAt: new Date()) without touching outstanding amount
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { deletedAt: new Date() },
      });

      // Delete billing snapshots for these contexts
      await tx.billingSnapshot.deleteMany({
        where: {
          billingContextId: { in: contextIds },
        },
      });

      // Delete billing context order mappings
      await tx.billingContextOrder.deleteMany({
        where: {
          billingContextId: { in: contextIds },
        },
      });

      // Delete billing contexts
      await tx.billingContext.deleteMany({
        where: {
          id: { in: contextIds },
        },
      });
    });

    this.logger.log(
      `Deleted ${contexts.length} billing contexts and soft-deleted ${orderIds.length} orders in range ${startDateStr} to ${endDateStr}`,
    );

    // 3. Delete files from Cloudflare R2 in the background to avoid blocking the REST request
    if (allUrls.length > 0) {
      this.cleanupImagesBackground(allUrls, orderIds).catch((err) => {
        this.logger.error('Failed to perform background image deletion', err);
      });
    }

    // 4. Trigger asynchronous analytics resync
    this.analyticsService.syncExistingData().catch((err) => {
      this.logger.error(
        'Failed to trigger analytics resync after deletion',
        err,
      );
    });

    return { success: true, count: contexts.length };
  }

  private async cleanupImagesBackground(
    allUrls: string[],
    deletedOrderIds: string[],
  ) {
    this.logger.log(
      `Starting background image cleanup for ${allUrls.length} image URLs...`,
    );

    // Check which URLs are referenced by other active orders
    const otherOrders = await this.prisma.order.findMany({
      where: {
        id: { notIn: deletedOrderIds },
        deletedAt: null,
        images: { hasSome: allUrls },
      },
      select: { images: true },
    });

    const referencedUrls = new Set<string>();
    for (const order of otherOrders) {
      for (const url of order.images ?? []) {
        if (typeof url === 'string' && url.trim()) {
          referencedUrls.add(url);
        }
      }
    }

    // Check which URLs are referenced by other active runs
    const otherRuns = await this.prisma.processRun.findMany({
      where: {
        orderProcess: {
          order: {
            id: { notIn: deletedOrderIds },
            deletedAt: null,
          },
        },
        fields: {
          path: ['images'],
          not: Prisma.JsonNull,
        },
      },
      select: { fields: true },
    });

    for (const run of otherRuns) {
      const fields = run.fields as Record<string, any>;
      if (fields?.images && Array.isArray(fields.images)) {
        for (const url of fields.images) {
          if (typeof url === 'string' && url.trim()) {
            referencedUrls.add(url);
          }
        }
      }
    }

    // Delete URLs that are NOT referenced
    let deletedCount = 0;
    for (const url of allUrls) {
      if (!referencedUrls.has(url)) {
        try {
          await this.cloudflare.deleteFileByUrl(url);
          deletedCount++;
        } catch (err) {
          this.logger.error(
            `Failed to delete file from Cloudflare R2: ${url}`,
            err,
          );
        }
      }
    }

    this.logger.log(
      `Background image cleanup finished. Deleted ${deletedCount} of ${allUrls.length} images.`,
    );
  }
}
