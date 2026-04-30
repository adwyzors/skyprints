import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEffectiveLocationId } from '../runs/runs.service';

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

                    const effectiveLocId = getEffectiveLocationId(run);
                    if (effectiveLocId) {
                        await this.prisma.locationAnalytics.upsert({
                            where: { locationId: effectiveLocId },
                            update: {
                                totalRuns: { increment: 1 },
                                totalUnits: { increment: order.quantity / (orderProcess.runs.length || 1) },
                                totalRevenue: { increment: revenuePerProcess / (orderProcess.runs.length || 1) }
                            },
                            create: {
                                locationId: effectiveLocId,
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
    async getDashboardStats(period: string = '7d', locationId?: string, customStart?: string, customEnd?: string) {
        const now = new Date();
        let startDate = new Date();

        if (customStart) {
            startDate = new Date(customStart);
        } else {
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
        }

        // Handle custom end date if provided
        const endDateCriteria = customEnd ? { lte: new Date(customEnd) } : {};

        const [daily, topProcesses, topUsers, topLocations, currentWorkload, productionState, lifecycleMatrix] = await Promise.all([
            this.prisma.dailyAnalytics.findMany({
                where: {
                    date: {
                        gte: startDate,
                        ...(customEnd && { lte: new Date(customEnd) })
                    }
                },
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
            this.getLiveProductionState(),
            this.getWorkflowLifecycleMatrix(locationId)
        ]);

        const topCustomers = await this.prisma.orderAnalytics.groupBy({
            by: ['customerId', 'customerName'],
            where: {
                status: 'BILLED',
                billedAt: {
                    gte: startDate,
                    ...(customEnd && { lte: new Date(customEnd) })
                }
            },
            _sum: {
                totalAmount: true,
                totalUnits: true
            },
            _count: {
                orderId: true
            },
            orderBy: {
                _sum: {
                    totalAmount: 'desc'
                }
            },
            take: 10
        });

        return {
            daily,
            topProcesses,
            topUsers,
            topLocations,
            topCustomers: topCustomers.map(c => ({
                customerId: c.customerId,
                customerName: c.customerName,
                totalRevenue: c._sum.totalAmount || 0,
                totalUnits: c._sum.totalUnits || 0,
                totalOrders: c._count.orderId || 0
            })),
            currentWorkload,
            productionState,
            lifecycleMatrix
        };
    }

    /**
     * Calculates the matrix of processes and their lifecycle stages.
     */
    async getWorkflowLifecycleMatrix(locationId?: string) {
        // Rows
        const processes = [
            'Screen Printing',
            'Sublimation',
            'Allover Sublimation',
            'Plotter',
            'DTF',
            'Laser',
            'Spangle',
            'Diamond',
            'Positive'
        ];

        // Columns
        const statuses = [
            'DESIGN',
            'SIZE/COLOR',
            'TRACING',
            'EXPOSING',
            'SAMPLE',
            'RANGE',
            'PRODUCTION',
            'WAITING',
            'CUTTING/WEEDING',
            'CURING',
            'FUSING',
            'QC & COUNTING',
            'Var Kata and Kg',
            'COMPLETE'
        ];

        try {
            // Fetch all active runs with their process and order info
            const activeRuns = await this.prisma.processRun.findMany({
                where: {
                    orderProcess: {
                        order: {
                            deletedAt: null,
                            statusCode: { notIn: ['BILLED', 'GROUP_BILLED'] }
                        }
                    },
                    // If locationId filter is set, match against any of the three location fields
                    ...(locationId && {
                        OR: [
                            { locationId },
                            { preProductionLocationId: locationId },
                            { postProductionLocationId: locationId },
                        ],
                    })
                },
                select: {
                    id: true,
                    lifeCycleStatusCode: true,
                    locationId: true,
                    preProductionLocationId: true,
                    postProductionLocationId: true,
                    fields: true, // Need fields for "Process Name" override and "Estimated Amount"
                    orderProcess: {
                        select: {
                            process: { select: { name: true } },
                            order: {
                                select: {
                                    id: true,
                                    quantity: true,
                                    totalProcesses: true
                                }
                            }
                        }
                    }
                }
            });

            // When locationId filter is active, further filter runs by effective location
            const filteredRuns = locationId
                ? activeRuns.filter(r => getEffectiveLocationId(r) === locationId)
                : activeRuns;

            const matrix: Record<string, Record<string, { count: number, value: number }>> = {};

            // Initialize matrix
            processes.forEach(p => {
                matrix[p] = {};
                statuses.forEach(s => {
                    matrix[p][s] = { count: 0, value: 0 };
                });
            });

            // To make it more accurate, let's fetch approximate values for these orders
            // We'll also try to use "Estimated Amount" from the run fields itself
            const orderIds = [...new Set(activeRuns.map(r => r.orderProcess.order.id))];
            const snapshots = await this.prisma.billingSnapshot.findMany({
                where: {
                    billingContext: {
                        orders: {
                            some: {
                                orderId: { in: orderIds }
                            }
                        }
                    },
                    isLatest: true,
                    intent: 'FINAL'
                },
                select: {
                    result: true,
                    billingContext: {
                        select: {
                            orders: { select: { orderId: true } }
                        }
                    }
                }
            });

            const orderValueMap = new Map<string, number>();
            snapshots.forEach(s => {
                const valuePerOrder = Number(s.result) / (s.billingContext.orders.length || 1);
                s.billingContext.orders.forEach(co => {
                    orderValueMap.set(co.orderId, valuePerOrder);
                });
            });

            filteredRuns.forEach(run => {
                let pName = run.orderProcess.process.name?.trim();
                const dbStatus = run.lifeCycleStatusCode;
                const fields = (run.fields as Record<string, any>) || {};

                // Override name for Embellishment if "Process Name" field exists
                if (pName === 'Embellishment' && fields['Process Name']) {
                    const override = String(fields['Process Name']).trim();
                    // Check if this override exists in our processes list (case-insensitive)
                    const matchedProcess = processes.find(p => p.toLowerCase() === override.toLowerCase());
                    if (matchedProcess) {
                        pName = matchedProcess;
                    }
                }

                // Normalize DTF variants
                if (pName === 'Direct to Film (DTF)') pName = 'DTF';

                // Find matching status label case-insensitively
                // Normalize Variations (e.g. QC&COUNTING -> QC & COUNTING)
                let normalizedStatus = dbStatus?.toUpperCase();
                if (normalizedStatus === 'QC&COUNTING') normalizedStatus = 'QC & COUNTING';

                const matchedStatus = statuses.find(s => s.toUpperCase() === normalizedStatus);

                if (matrix[pName] && matchedStatus) {
                    matrix[pName][matchedStatus].count += 1;

                    // Calculate value similarly to Run Activity Page
                    // 1. Try "Estimated Amount" field first
                    let runValue = 0;
                    const estAmt = fields['Estimated Amount'];
                    if (estAmt !== undefined && estAmt !== null) {
                        const cleanAmt = String(estAmt).replace(/[^\d.-]/g, '');
                        const parsed = parseFloat(cleanAmt);
                        if (!isNaN(parsed)) {
                            runValue = parsed;
                        }
                    }

                    // 2. Fallback to Billing Context distribution if field is empty or zero
                    if (runValue <= 0) {
                        const orderVal = orderValueMap.get(run.orderProcess.order.id) || 0;
                        const processCount = run.orderProcess.order.totalProcesses || 1;
                        runValue = orderVal / processCount;
                    }

                    if (runValue > 0) {
                        matrix[pName][matchedStatus].value += runValue;
                    }
                }
            });

            return matrix;
        } catch (error) {
            this.logger.error(`Error calculating lifecycle matrix: ${error.message}`);
            return {};
        }
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

            const [activeRuns, byReviewer, byExecutor] = await Promise.all([
                this.prisma.processRun.findMany({
                    where: {
                        orderProcess: {
                            order: {
                                statusCode: { in: activeOrderStatuses }
                            }
                        }
                    },
                    select: {
                        locationId: true,
                        preProductionLocationId: true,
                        postProductionLocationId: true,
                        lifeCycleStatusCode: true,
                    }
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
            activeRuns.forEach(run => {
                const locId = getEffectiveLocationId(run);
                if (locId) {
                    locationCountsMap.set(locId, (locationCountsMap.get(locId) || 0) + 1);
                }
            });

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
            const inputs = snapshot.inputs as any;

            for (const contextOrder of snapshot.billingContext.orders) {
                const orderId = contextOrder.orderId;
                let amount = Number(snapshot.result) / (snapshot.billingContext.orders.length || 1);

                // 🔑 Use specific result if available in the group snapshot
                if (inputs?.[orderId] && inputs[orderId]['__ORDER_RESULT__']) {
                    amount = Number(inputs[orderId]['__ORDER_RESULT__']);
                }

                await this.trackOrderFinalized(orderId, amount, snapshot.createdAt);
            }
        }

        this.logger.log('Analytics sync completed.');
        return { processed: snapshots.length };
    }
}
