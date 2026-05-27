import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudflareService } from '../common/cloudflare.service';

@Injectable()
export class ImageRetentionService {
    private readonly logger = new Logger(ImageRetentionService.name);

    /**
     * Prevent overlapping executions in same serverless instance.
     */
    private cleaning = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloudflare: CloudflareService,
    ) { }

    async cleanup({
        limit,
        dryRun,
    }: {
        limit?: number;
        dryRun?: boolean;
    }) {
        if (this.cleaning) {
            return {
                success: false,
                message: 'Cleanup already running',
            };
        }

        this.cleaning = true;

        const start = Date.now();

        try {
            const batchSize =
                limit ??
                parseInt(process.env.MAX_ORDERS_PER_RUN ?? '15', 10);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            /**
             * STEP 1
             * Fetch eligible billed orders
             */
            const eligibleOrders = await this.prisma.order.findMany({
                where: {
                    statusCode: {
                        in: ['BILLED', 'GROUP_BILLED'],
                    },
                    deletedAt: null,
                    createdAt: {
                        lt: thirtyDaysAgo,
                    },
                    images: {
                        isEmpty: false,
                    },
                },
                select: {
                    id: true,
                    code: true,
                    images: true,
                    createdAt: true,
                },
                take: batchSize,
                orderBy: {
                    createdAt: 'asc',
                },
            });

            if (!eligibleOrders.length) {
                return this._finalResult({
                    scannedOrders: 0,
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
             * STEP 2
             * Collect ALL image URLs
             */
            const imageUrlSet = new Set<string>();

            /**
             * Collect order images
             */
            for (const order of eligibleOrders) {
                for (const url of order.images ?? []) {
                    if (url?.trim()) {
                        imageUrlSet.add(url);
                    }
                }
            }

            /**
             * Fetch process runs
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
             * Collect run images
             */
            for (const run of runs) {
                const fields = run.fields as Record<string, any>;

                if (
                    fields?.images &&
                    Array.isArray(fields.images)
                ) {
                    for (const url of fields.images) {
                        if (typeof url === 'string' && url.trim()) {
                            imageUrlSet.add(url);
                        }
                    }
                }
            }

            const allUrls = Array.from(imageUrlSet);

            /**
             * STEP 3
             * Build global reference map
             *
             * MUCH faster than N queries per image
             */

            const referencedUrls = new Set<string>();

            /**
             * Other orders
             */
            const otherOrders = await this.prisma.order.findMany({
                where: {
                    id: {
                        notIn: orderIds,
                    },
                    deletedAt: null,
                },
                select: {
                    images: true,
                },
            });

            for (const order of otherOrders) {
                for (const url of order.images ?? []) {
                    if (url?.trim()) {
                        referencedUrls.add(url);
                    }
                }
            }

            /**
             * Other runs
             */
            const otherRuns = await this.prisma.processRun.findMany({
                where: {
                    orderProcess: {
                        orderId: {
                            notIn: orderIds,
                        },
                    },
                },
                select: {
                    fields: true,
                },
            });

            for (const run of otherRuns) {
                const fields = run.fields as Record<string, any>;

                if (
                    fields?.images &&
                    Array.isArray(fields.images)
                ) {
                    for (const url of fields.images) {
                        if (typeof url === 'string' && url.trim()) {
                            referencedUrls.add(url);
                        }
                    }
                }
            }

            /**
             * STEP 4
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
             * STEP 5
             * Delete safe URLs in chunks
             */
            const deletedImages: string[] = [];

            const failedImages: Array<{
                url: string;
                error: unknown;
            }> = [];

            const concurrency = 5;

            const chunks = this._chunkArray(
                safeUrls,
                concurrency,
            );

            for (const chunk of chunks) {
                const promises = chunk.map(async (url) => {
                    try {
                        if (dryRun) {
                            this.logger.log(
                                `[DRY_RUN] Would delete ${url}`,
                            );

                            return;
                        }

                        const key =
                            this._extractR2KeyFromUrl(url);

                        if (!key) {
                            unsafeUrls.push(url);

                            this.logger.warn(
                                `[CLEANUP] Invalid R2 URL: ${url}`,
                            );

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
                            error instanceof Error
                                ? error.stack
                                : undefined,
                        );
                    }
                });

                await Promise.allSettled(promises);
            }

            /**
             * STEP 6
             * Remove references from DB
             */
            if (!dryRun && deletedImages.length) {
                await this.prisma.transaction(async (tx) => {
                    /**
                     * Update orders
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

                        const remainingImages =
                            (order.images ?? []).filter(
                                (url) =>
                                    !deletedImages.includes(url),
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
                     * Update runs
                     */
                    for (const run of runs) {
                        const fields = run.fields as Record<
                            string,
                            any
                        >;

                        if (
                            !fields?.images ||
                            !Array.isArray(fields.images)
                        ) {
                            continue;
                        }

                        const remainingImages =
                            fields.images.filter(
                                (url: string) =>
                                    !deletedImages.includes(url),
                            );

                        /**
                         * Skip unnecessary update
                         */
                        if (
                            remainingImages.length ===
                            fields.images.length
                        ) {
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

            return this._finalResult({
                scannedOrders: eligibleOrders.length,
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
                error instanceof Error
                    ? error.stack
                    : undefined,
            );

            throw error;
        } finally {
            this.cleaning = false;
        }
    }

    /**
     * Extract object key from public R2 URL
     */
    private _extractR2KeyFromUrl(
        url: string,
    ): string | null {
        try {
            const parsed = new URL(url);

            return parsed.pathname.replace(/^\//, '');
        } catch {
            return null;
        }
    }

    /**
     * Split into chunks
     */
    private _chunkArray<T>(
        arr: T[],
        size: number,
    ): T[][] {
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