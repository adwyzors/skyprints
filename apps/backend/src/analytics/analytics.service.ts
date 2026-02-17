import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Tracks an order when it is finalized and billed.
     * Updates daily revenue, process volumes, and user performance.
     */
    async trackOrderFinalized(orderId: string, totalAmount: number, timestamp?: Date) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    customer: true,
                    processes: {
                        include: {
                            process: true,
                            runs: {
                                include: {
                                    executor: true,
                                    reviewer: true,
                                    location: true
                                }
                            }
                        }
                    }
                }
            });

            if (!order) return;

            const date = timestamp ? new Date(timestamp) : new Date();
            date.setHours(0, 0, 0, 0);

            // 1. Update Daily Analytics
            await this.prisma.dailyAnalytics.upsert({
                where: { date },
                update: {
                    billedRevenue: { increment: totalAmount },
                    billedOrders: { increment: 1 },
                    totalOrders: { increment: 1 },
                    totalUnits: { increment: order.quantity }
                },
                create: {
                    date,
                    billedRevenue: totalAmount,
                    billedOrders: 1,
                    totalOrders: 1,
                    totalUnits: order.quantity
                }
            });

            // 2. Update Order Analytics
            const finalizedDate = timestamp ? new Date(timestamp) : new Date();
            const creationDate = new Date(order.createdAt);
            const cycleTimeHours = (finalizedDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60);

            await this.prisma.orderAnalytics.upsert({
                where: { orderId: order.id },
                update: {
                    totalAmount,
                    status: 'BILLED',
                    billedAt: finalizedDate,
                    cycleTimeHours
                },
                create: {
                    orderId: order.id,
                    orderCode: order.code,
                    customerId: order.customerId,
                    customerName: order.customer.name,
                    totalAmount,
                    totalUnits: order.quantity,
                    status: 'BILLED',
                    billedAt: finalizedDate,
                    cycleTimeHours,
                    createdAt: order.createdAt
                }
            });

            // 3. Update Process & User Analytics based on the finalized order
            const totalProcessesCount = order.totalProcesses || 1;
            const revenuePerProcess = totalAmount / totalProcessesCount;

            for (const orderProcess of order.processes) {
                // Approximate revenue distribution per process
                await this.prisma.processAnalytics.upsert({
                    where: { processId: orderProcess.processId },
                    update: {
                        totalRuns: { increment: orderProcess.runs.length },
                        totalUnits: { increment: order.quantity },
                        totalRevenue: { increment: revenuePerProcess }
                    },
                    create: {
                        processId: orderProcess.processId,
                        processName: orderProcess.process.name,
                        totalRuns: orderProcess.runs.length,
                        totalUnits: order.quantity,
                        totalRevenue: revenuePerProcess
                    }
                });

                // User performance (Managers/Executors/Reviewers)
                for (const run of orderProcess.runs) {
                    const contribution = revenuePerProcess / (orderProcess.runs.length || 1);
                    const userWork = new Map<string, { isReviewer: boolean, isExecutor: boolean, user: any }>();

                    if (run.reviewerId) {
                        userWork.set(run.reviewerId, { isReviewer: true, isExecutor: false, user: run.reviewer });
                    }
                    if (run.executorId) {
                        const existing = userWork.get(run.executorId);
                        if (existing) {
                            existing.isExecutor = true;
                        } else {
                            userWork.set(run.executorId, { isReviewer: false, isExecutor: true, user: run.executor });
                        }
                    }

                    for (const [userId, work] of userWork.entries()) {
                        await this.prisma.userPerformance.upsert({
                            where: { userId },
                            update: {
                                runsReviewed: work.isReviewer ? { increment: 1 } : undefined,
                                runsExecuted: work.isExecutor ? { increment: 1 } : undefined,
                                totalBilledVolume: { increment: contribution },
                                lastActiveAt: finalizedDate,
                                userName: work.user?.name || 'Unknown',
                                role: work.user?.role || 'USER'
                            },
                            create: {
                                userId,
                                userName: work.user?.name || 'Unknown',
                                role: work.user?.role || 'USER',
                                runsReviewed: work.isReviewer ? 1 : 0,
                                runsExecuted: work.isExecutor ? 1 : 0,
                                totalBilledVolume: contribution,
                                lastActiveAt: finalizedDate
                            }
                        });
                    }

                    if (run.locationId) {
                        await this.prisma.locationAnalytics.upsert({
                            where: { locationId: run.locationId },
                            update: {
                                totalRuns: { increment: 1 },
                                totalUnits: { increment: order.quantity / (orderProcess.runs.length || 1) },
                                totalRevenue: { increment: revenuePerProcess / (orderProcess.runs.length || 1) }
                            },
                            create: {
                                locationId: run.locationId,
                                locationName: run.location?.name || 'Unknown',
                                totalRuns: 1,
                                totalUnits: order.quantity / (orderProcess.runs.length || 1),
                                totalRevenue: revenuePerProcess / (orderProcess.runs.length || 1)
                            }
                        });
                    }
                }
            }

        } catch (error) {
            this.logger.error(`Error tracking finalized order ${orderId}: ${error.message}`, error.stack);
        }
    }

    /**
     * Dashboard Data Query methods
     */
    async getDashboardStats(period: string = '7d') {
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '6m':
                startDate.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'all':
                startDate = new Date(0); // Beginning of time
                break;
            default:
                startDate.setDate(now.getDate() - 7);
        }

        const [daily, topProcesses, topUsers, topLocations, currentWorkload, productionState] = await Promise.all([
            this.prisma.dailyAnalytics.findMany({
                where: { date: { gte: startDate } },
                orderBy: { date: 'asc' }, // Changed to ASC for charts
            }),
            this.prisma.processAnalytics.findMany({
                orderBy: { totalRevenue: 'desc' },
                take: 10
            }),
            this.prisma.userPerformance.findMany({
                orderBy: { totalBilledVolume: 'desc' },
                take: 10
            }),
            this.prisma.locationAnalytics.findMany({
                orderBy: { totalRevenue: 'desc' },
                take: 10
            }),
            this.getActiveWorkload(),
            this.getLiveProductionState()
        ]);

        return {
            daily,
            topProcesses,
            topUsers,
            topLocations,
            currentWorkload,
            productionState
        };
    }

    /**
     * Get live state of orders and pending work.
     */
    async getLiveProductionState() {
        try {
            const [orderCounts, pendingRuns] = await Promise.all([
                this.prisma.order.groupBy({
                    by: ['statusCode'],
                    where: { deletedAt: null },
                    _count: { _all: true }
                }),
                this.prisma.processRun.count({
                    where: { statusCode: { in: ['CONFIGURE', 'IN_PROGRESS'] } }
                })
            ]);

            const states: Record<string, number> = {};
            orderCounts.forEach(c => {
                states[c.statusCode] = c._count._all;
            });

            return {
                inConfig: states['CONFIGURE'] || 0,
                ready: states['PRODUCTION_READY'] || 0,
                active: states['IN_PRODUCTION'] || 0,
                toBeBilled: states['COMPLETE'] || 0,
                toBeInvoiced: states['BILLED'] || 0,
                pendingRuns
            };
        } catch (error) {
            this.logger.error(`Error fetching live production state: ${error.message}`);
            return null;
        }
    }

    /**
     * Get current active workload (non-completed runs) grouped by location and manager.
     */
    async getActiveWorkload() {
        try {
            const activeOrderStatuses: OrderStatus[] = [
                OrderStatus.CONFIGURE,
                OrderStatus.PRODUCTION_READY,
                OrderStatus.IN_PRODUCTION,
                OrderStatus.COMPLETE
            ];

            const [byLocation, byReviewer, byExecutor] = await Promise.all([
                this.prisma.processRun.groupBy({
                    by: ['locationId'],
                    where: {
                        locationId: { not: null },
                        orderProcess: {
                            order: {
                                statusCode: { in: activeOrderStatuses }
                            }
                        }
                    },
                    _count: { _all: true }
                }),
                this.prisma.processRun.groupBy({
                    by: ['reviewerId'],
                    where: {
                        reviewerId: { not: null },
                        orderProcess: {
                            order: {
                                statusCode: { in: activeOrderStatuses }
                            }
                        }
                    },
                    _count: { _all: true }
                }),
                this.prisma.processRun.groupBy({
                    by: ['executorId'],
                    where: {
                        executorId: { not: null },
                        orderProcess: {
                            order: {
                                statusCode: { in: activeOrderStatuses }
                            }
                        }
                    },
                    _count: { _all: true }
                })
            ]);

            // Fetch ALL active locations and relevant managers to ensure 0-counts are shown
            const [allLocations, allManagers] = await Promise.all([
                this.prisma.location.findMany({
                    where: { isActive: true },
                    select: { id: true, name: true }
                }),
                this.prisma.user.findMany({
                    where: {
                        isActive: true,
                        deletedAt: null,
                        role: 'MANAGER'
                    },
                    select: { id: true, name: true }
                })
            ]);

            const locationMap = new Map(allLocations.map(l => [l.id, l.name]));
            const managerMap = new Map(allManagers.map(m => [m.id, m.name]));

            // Maps for fast lookup of counts
            const locationCountsMap = new Map<string, number>();
            byLocation.forEach(l => locationCountsMap.set(l.locationId!, l._count._all));

            const managerCountsMap = new Map<string, number>();
            byReviewer.forEach(r => {
                managerCountsMap.set(r.reviewerId!, (managerCountsMap.get(r.reviewerId!) || 0) + r._count._all);
            });
            byExecutor.forEach(e => {
                managerCountsMap.set(e.executorId!, (managerCountsMap.get(e.executorId!) || 0) + e._count._all);
            });

            return {
                byLocation: allLocations.map(l => ({
                    id: l.id,
                    name: l.name,
                    count: locationCountsMap.get(l.id) || 0
                })),
                byManager: allManagers.map(m => ({
                    id: m.id,
                    name: m.name,
                    count: managerCountsMap.get(m.id) || 0
                })).sort((a, b) => b.count - a.count)
            };
        } catch (error) {
            this.logger.error(`Error fetching active workload: ${error.message}`);
            return { byLocation: [], byManager: [] };
        }
    }

    /**
     * One-time sync to populate analytics from existing historical data.
     */
    async syncExistingData() {
        this.logger.log('Starting analytics historical data sync...');

        // 1. Clear existing analytics to avoid duplicates during sync
        await this.prisma.transaction([
            this.prisma.dailyAnalytics.deleteMany(),
            this.prisma.processAnalytics.deleteMany(),
            this.prisma.userPerformance.deleteMany(),
            this.prisma.orderAnalytics.deleteMany(),
            this.prisma.locationAnalytics.deleteMany()
        ]);

        // 2. Fetch all FINAL snapshots for GROUP contexts only (as requested)
        const snapshots = await this.prisma.billingSnapshot.findMany({
            where: {
                intent: 'FINAL',
                isLatest: true,
                billingContext: {
                    type: 'GROUP'
                }
            },
            include: {
                billingContext: {
                    include: {
                        orders: {
                            include: {
                                order: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        this.logger.log(`Found ${snapshots.length} final snapshots to process.`);

        for (const snapshot of snapshots) {
            // Process each order in the context
            const ordersCount = snapshot.billingContext.orders.length;
            const amountPerOrder = Number(snapshot.result) / (ordersCount || 1);

            for (const contextOrder of snapshot.billingContext.orders) {
                await this.trackOrderFinalized(contextOrder.orderId, amountPerOrder, snapshot.createdAt);
            }
        }

        this.logger.log('Analytics sync completed.');
        return { processed: snapshots.length };
    }
}
