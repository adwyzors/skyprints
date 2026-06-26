import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';

@Injectable()
export class ImageRetentionService {
  private readonly logger = new Logger(ImageRetentionService.name);

  private readonly CLEANUP_LOCK_KEY = 819273645;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudflare: CloudflareService,
  ) {}

  async cleanup({ limit, dryRun }: { limit?: number; dryRun?: boolean }) {
    const [{ lock_acquired }] = await this.prisma.client.$queryRaw<
      [{ lock_acquired: boolean }]
    >`SELECT pg_try_advisory_lock(${this.CLEANUP_LOCK_KEY}) AS lock_acquired`;

    if (!lock_acquired) {
      return {
        success: false,
        message: 'Cleanup already running',
      };
    }

    const start = Date.now();

    try {
      const batchSize =
        limit ?? parseInt(process.env.MAX_ORDERS_PER_RUN ?? '100', 10);

      const thirtyDaysAgo = new Date();

      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      /**
       * STEP 1
       *
       * Fetch ALL candidate orders older than 30 days.
       *
       * No take() cap here — the work limit is enforced in STEP 2
       * (eligibleOrders stops filling once it reaches batchSize).
       *
       * A cap here would permanently exclude newer orders once the
       * candidate pool exceeds it, because already-cleaned orders
       * (images: []) still match the WHERE clause and consume slots.
       */
      const candidateOrders = await this.prisma.order.findMany({
        where: {
          statusCode: {
            in: ['BILLED', 'GROUP_BILLED'],
          },
          deletedAt: null,
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          code: true,
          images: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      /**
       * STEP 2
       *
       * Keep ONLY orders that still contain images somewhere.
       *
       * Single batched query for run-image check — avoids N+1.
       * Orders without order-level images are collected first, then
       * one findMany resolves which of them have runs with images.
       */
      const ordersWithoutImages = candidateOrders.filter(
        (o) => !Array.isArray(o.images) || o.images.length === 0,
      );

      const orderIdsWithRunImages = new Set<string>();

      if (ordersWithoutImages.length > 0) {
        const runsWithImages = await this.prisma.processRun.findMany({
          where: {
            orderProcess: {
              orderId: { in: ordersWithoutImages.map((o) => o.id) },
            },
            fields: {
              path: ['images'],
              not: Prisma.JsonNull,
            },
          },
          select: {
            orderProcess: { select: { orderId: true } },
          },
        });

        for (const run of runsWithImages) {
          orderIdsWithRunImages.add(run.orderProcess.orderId);
        }
      }

      const eligibleOrders: typeof candidateOrders = [];

      for (const order of candidateOrders) {
        const hasImages =
          (Array.isArray(order.images) && order.images.length > 0) ||
          orderIdsWithRunImages.has(order.id);

        if (hasImages) {
          eligibleOrders.push(order);

          if (eligibleOrders.length >= batchSize) {
            break;
          }
        }
      }

      /**
       * No eligible orders
       */
      if (!eligibleOrders.length) {
        return this._finalResult({
          scannedOrders: candidateOrders.length,
          processedOrders: 0,
          uniqueImagesFound: 0,
          deletedImages: 0,
          failedImages: [],
          skippedImages: [],
          dryRun: !!dryRun,
          durationMs: Date.now() - start,
        });
      }

      const orderIds = eligibleOrders.map((o) => o.id);

      /**
       * STEP 3
       *
       * Fetch all runs for eligible orders
       */
      const runs = await this.prisma.processRun.findMany({
        where: {
          orderProcess: {
            orderId: {
              in: orderIds,
            },
          },
        },
        select: {
          id: true,
          fields: true,
          orderProcess: {
            select: {
              orderId: true,
            },
          },
        },
      });

      /**
       * STEP 4
       *
       * Collect ALL image URLs
       */
      const imageUrlSet = new Set<string>();

      /**
       * Collect order images
       */
      for (const order of eligibleOrders) {
        for (const url of order.images ?? []) {
          if (typeof url === 'string' && url.trim()) {
            imageUrlSet.add(url);
          }
        }
      }

      /**
       * Collect run images
       */
      for (const run of runs) {
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

      /**
       * No images found
       */
      if (!allUrls.length) {
        return this._finalResult({
          scannedOrders: candidateOrders.length,
          processedOrders: eligibleOrders.length,
          uniqueImagesFound: 0,
          deletedImages: 0,
          failedImages: [],
          skippedImages: [],
          dryRun: !!dryRun,
          durationMs: Date.now() - start,
        });
      }

      /**
       * STEP 5
       *
       * Build global reference map
       * from OTHER orders/runs.
       *
       * Avoids N DB queries per image.
       */
      const referencedUrls = new Set<string>();

      /**
       * Other orders
       *
       * Only fetch orders that actually share at least one URL with
       * our candidate set — avoids loading every order in the system.
       */
      const otherOrders = await this.prisma.order.findMany({
        where: {
          id: {
            notIn: orderIds,
          },
          deletedAt: null,
          images: { hasSome: allUrls },
        },
        select: {
          images: true,
        },
      });

      for (const order of otherOrders) {
        for (const url of order.images ?? []) {
          if (typeof url === 'string' && url.trim()) {
            referencedUrls.add(url);
          }
        }
      }

      /**
       * Other runs
       *
       * Only fetch runs that have an images field at all — skips the
       * majority of runs which never had images uploaded.
       */
      const otherRuns = await this.prisma.processRun.findMany({
        where: {
          orderProcess: {
            orderId: {
              notIn: orderIds,
            },
          },
          fields: {
            path: ['images'],
            not: Prisma.JsonNull,
          },
        },
        select: {
          fields: true,
        },
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

      /**
       * STEP 6
       *
       * Determine safe vs unsafe URLs
       */
      const safeUrls: string[] = [];

      const unsafeUrls: string[] = [];

      for (const url of allUrls) {
        if (referencedUrls.has(url)) {
          unsafeUrls.push(url);
        } else {
          safeUrls.push(url);
        }
      }

      /**
       * STEP 7
       *
       * Delete safe URLs in chunks
       */
      const deletedImages: string[] = [];

      const failedImages: Array<{
        url: string;
        error: unknown;
      }> = [];

      const concurrency = 5;

      const chunks = this._chunkArray(safeUrls, concurrency);

      for (const chunk of chunks) {
        const promises = chunk.map(async (url) => {
          try {
            /**
             * DRY RUN
             */
            if (dryRun) {
              this.logger.log(`[DRY_RUN] Would delete ${url}`);

              return;
            }

            const key = this._extractR2KeyFromUrl(url);

            if (!key) {
              unsafeUrls.push(url);

              this.logger.warn(`[CLEANUP] Invalid R2 URL: ${url}`);

              return;
            }

            await this.cloudflare.deleteObject(key);

            deletedImages.push(url);
          } catch (error) {
            failedImages.push({
              url,
              error,
            });

            this.logger.error(
              `[CLEANUP] Failed deleting ${url}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        });

        await Promise.allSettled(promises);
      }

      /**
       * STEP 8
       *
       * Remove deleted image references from DB
       */
      if (!dryRun && deletedImages.length) {
        await this.prisma.transaction(async (tx) => {
          /**
           * Update order images
           */
          for (const orderId of orderIds) {
            const order = await tx.order.findUnique({
              where: {
                id: orderId,
              },
              select: {
                images: true,
              },
            });

            if (!order) {
              continue;
            }

            const remainingImages = (order.images ?? []).filter(
              (url) => !deletedImages.includes(url),
            );

            await tx.order.update({
              where: {
                id: orderId,
              },
              data: {
                images: remainingImages,
              },
            });
          }

          /**
           * Update run fields JSON
           */
          for (const run of runs) {
            const fields = run.fields as Record<string, any>;

            if (!fields?.images || !Array.isArray(fields.images)) {
              continue;
            }

            const remainingImages = fields.images.filter(
              (url: string) => !deletedImages.includes(url),
            );

            /**
             * Skip unnecessary updates
             */
            if (remainingImages.length === fields.images.length) {
              continue;
            }

            await tx.processRun.update({
              where: {
                id: run.id,
              },
              data: {
                fields: {
                  ...fields,
                  images: remainingImages,
                },
              },
            });
          }
        });
      }

      /**
       * Final response
       */
      return this._finalResult({
        scannedOrders: candidateOrders.length,
        processedOrders: eligibleOrders.length,
        uniqueImagesFound: allUrls.length,
        deletedImages: deletedImages.length,
        failedImages,
        skippedImages: unsafeUrls,
        dryRun: !!dryRun,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      this.logger.error(
        '[CLEANUP] Cleanup failed',
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    } finally {
      await this.prisma.client
        .$executeRaw`SELECT pg_advisory_unlock(${this.CLEANUP_LOCK_KEY})`;
    }
  }

  /**
   * Extract object key from R2 URL
   *
   * Example:
   * https://pub-xxx.r2.dev/orders/file.webp
   *
   * =>
   * orders/file.webp
   */
  private _extractR2KeyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      return parsed.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  }

  /**
   * Chunk helper
   */
  private _chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }

    return chunks;
  }

  private _finalResult(payload: any) {
    return {
      success: true,
      ...payload,
    };
  }
}
