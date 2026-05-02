import { Injectable } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import * as ExcelJS from "exceljs";
import { Response } from "express";
import { ReportsQueryDto } from "./dto/reports.query.dto";

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) { }

    async getBilledOrdersReport(query: ReportsQueryDto) {
        const { customerId, startDate, endDate, processId, preProductionLocationId, postProductionLocationId, search, page, limit } = query;

        const whereClause: any = {
            statusCode: { in: ["BILLED", "GROUP_BILLED"] },
            deletedAt: null,
        };

        if (customerId) {
            whereClause.customerId = customerId;
        }

        const processWhere: any = {};
        if (processId) processWhere.processId = processId;

        if (preProductionLocationId || postProductionLocationId) {
            const runWhere: any = {};
            if (preProductionLocationId) runWhere.preProductionLocationId = preProductionLocationId;
            if (postProductionLocationId) runWhere.postProductionLocationId = postProductionLocationId;
            processWhere.runs = { some: runWhere };
        }

        if (Object.keys(processWhere).length > 0) {
            whereClause.processes = { some: processWhere };
        }

        // Optimized Date Filtering: Find order IDs from analytics first if dates are provided
        if ((startDate && startDate !== '') || (endDate && endDate !== '')) {
            const dateWhere: any = {};
            if (startDate && startDate !== '') {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                dateWhere.billedAt = { gte: s };
            }
            if (endDate && endDate !== '') {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                if (dateWhere.billedAt) dateWhere.billedAt.lte = e;
                else dateWhere.billedAt = { lte: e };
            }

            const analyticsMatches = await this.prisma.orderAnalytics.findMany({
                where: dateWhere,
                select: { orderId: true }
            });
            
            const matchedOrderIds = analyticsMatches.map(a => a.orderId);
            
            if (matchedOrderIds.length > 0) {
                whereClause.id = { in: matchedOrderIds };
            } else if (!search) {
                // If no analytics match and it's not a search, we can return early
                return {
                    data: [],
                    meta: { total: 0, page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20, totalPages: 0, totalAmount: 0, totalQty: 0 }
                };
            }
        }

        const orders = await this.prisma.order.findMany({
            where: whereClause,
            include: {
                customer: true,
                processes: {
                    include: {
                        process: true,
                        runs: {
                            include: {
                                preProductionLocation: true,
                                postProductionLocation: true,
                            },
                        },
                    },
                },
                billingContexts: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        billingContext: {
                            include: {
                                snapshots: {
                                    where: { intent: 'FINAL' },
                                    orderBy: { version: 'desc' },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // 3. Fetch analytics separately (since the relation is not in the schema)
        const orderIds = orders.map(o => o.id);
        const analytics = await this.prisma.orderAnalytics.findMany({
            where: { orderId: { in: orderIds } },
            select: {
                orderId: true,
                totalAmount: true,
                billedAt: true
            }
        });
        const analyticsMap = new Map(analytics.map(a => [a.orderId, a]));

        let reportData: any[] = [];

        // Normalize filter dates
        const start = (startDate && startDate !== '') ? new Date(startDate) : null;
        if (start && isNaN(start.getTime())) {
            // Fallback for invalid date strings
        } else if (start) {
            start.setHours(0, 0, 0, 0);
        }

        const end = (endDate && endDate !== '') ? new Date(endDate) : null;
        if (end && isNaN(end.getTime())) {
        } else if (end) {
            end.setHours(23, 59, 59, 999);
        }

        for (const order of orders) {
            // 1. Prepare a map of all available billing data for this order across all contexts
            const allBillingInputs: any[] = [];
            let primaryBillNumber = "N/A";
            let latestSnapshotDate: Date | null = null;

            // Sort contexts: prefer GROUP for GROUP_BILLED, then by most recent
            const sortedContexts = [...order.billingContexts].sort((a, b) => {
                if (order.statusCode === "GROUP_BILLED") {
                    if (a.billingContext.type === "GROUP" && b.billingContext.type !== "GROUP") return -1;
                    if (b.billingContext.type === "GROUP" && a.billingContext.type !== "GROUP") return 1;
                }
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            for (const bc of sortedContexts) {
                // Only consider the latest snapshot (already ordered by version desc in Prisma)
                const snapshot = bc.billingContext.snapshots[0];
                if (snapshot) {
                    if (!latestSnapshotDate || snapshot.createdAt > latestSnapshotDate) {
                        latestSnapshotDate = snapshot.createdAt;
                    }
                    let inputs = snapshot.inputs as any;
                    let orderResult = null;
                    if (bc.billingContext.type === "GROUP") {
                        orderResult = inputs?.[order.id]?.['__ORDER_RESULT__'];
                        inputs = inputs?.[order.id];
                    }
                    if (inputs) {
                        allBillingInputs.push({
                            inputs,
                            orderResult,
                            billNumber: bc.billingContext.name || bc.billingContext.id,
                            type: bc.billingContext.type,
                            date: snapshot.createdAt
                        });
                        if (primaryBillNumber === "N/A") {
                            primaryBillNumber = bc.billingContext.name || bc.billingContext.id;
                        }
                    }
                }
            }

            // 2. Reference date for the order
            const orderAnalytic = analyticsMap.get(order.id);
            const date = orderAnalytic?.billedAt || latestSnapshotDate || order.createdAt;
            // No need for manual date filtering here anymore as it's handled in Prisma where possible
            // except as a final safety check for records without analytics
            if (startDate && startDate !== '' && date < new Date(startDate)) continue;
            if (endDate && endDate !== '' && date > new Date(endDate)) continue;

            for (const orderProcess of order.processes) {
                if (processId && orderProcess.processId !== processId) continue;

                for (const run of orderProcess.runs) {
                    // Location filtering
                    if (preProductionLocationId || postProductionLocationId) {
                        const preMatch = !preProductionLocationId || run.preProductionLocationId === preProductionLocationId;
                        const postMatch = !postProductionLocationId || run.postProductionLocationId === postProductionLocationId;
                        if (!preMatch || !postMatch) continue;
                    }

                    // Extract run-specific billing data
                    const runFields = run.fields as any;
                    let amount = 0;

                    const getRunQty = (fields: any) => {
                        return fields?.["Total Mtr"] ||
                            fields?.["Total Quantity"] ||
                            fields?.["Total Pieces"] ||
                            fields?.["pcs"] ||
                            fields?.["Quantity"] ||
                            fields?.["quantity"] ||
                            fields?.["qty"] ||
                            fields?.["Qty"];
                    };

                    let numericQuantity = Number(getRunQty(runFields) || order.quantity);
                    let rate = 0;

                    // Search for run-specific billing data in all available snapshots
                    let runBilling: any = null;
                    let runBillNumber = primaryBillNumber;
                    let orderLevelResult: any = null;

                    for (const entry of allBillingInputs) {
                        if (entry.orderResult) orderLevelResult = entry.orderResult;
                        if (entry.inputs && entry.inputs[run.id]) {
                            runBilling = entry.inputs[run.id];
                            runBillNumber = entry.billNumber;
                            break;
                        }
                    }

                    if (runBilling) {
                        // 1. Extract Quantity
                        const inputQty = runBilling["total_mtr"] ||
                            runBilling["total_quantity"] ||
                            runBilling["total_pieces"] ||
                            runBilling["pcs"] ||
                            runBilling["PCS"] ||
                            runBilling["Pcs"] ||
                            runBilling["quantity"] ||
                            runBilling["Quantity"] ||
                            runBilling["qty"] ||
                            runBilling["Qty"];

                        if (inputQty !== undefined) {
                            numericQuantity = Number(inputQty);
                        }

                        // 2. Extract Rate (Prioritize new/final rates, fallback to estimated)
                        rate = Number(
                            runBilling["new_rate"] ||
                            runBilling["finalRate"] ||
                            runBilling["final_rate"] ||
                            runBilling["per_pc_cost"] ||
                            runBilling["rate"] ||
                            runBilling["Rate"] ||
                            runBilling["price"] ||
                            runBilling["Price"] || 
                            runBilling["estimated_rate"] ||
                            runBilling["Estimated Rate"] || 0
                        );

                        // 3. Extract Amount (Prioritize stored totals, fallback to rate * quantity)
                        const storedAmount = Number(
                            runBilling["__RESULT__"] || 
                            runBilling["new_amount"] || 
                            runBilling["New Amount"] ||
                            runBilling["actual_total"] ||
                            runBilling["Actual Total"] ||
                            runBilling["total_amount"] ||
                            runBilling["Total Amount"] ||
                            runBilling["amount"] ||
                            runBilling["Amount"] || 0
                        );

                        if (storedAmount > 0) {
                            amount = storedAmount;
                        } else {
                            amount = rate * numericQuantity;
                        }

                        // 4. Final Rate Fallback: If rate is still 0 but amount exists
                        if (rate === 0 && amount > 0 && numericQuantity > 0) {
                            rate = amount / numericQuantity;
                        }
                    }

                    // FALLBACK: Only if the run was NOT found in any billing snapshot at all
                    if (!runBilling && amount === 0 && (orderLevelResult || orderAnalytic)) {
                        const totalOrderAmount = Number(orderLevelResult || orderAnalytic?.totalAmount || 0);

                        // If it's the only process and only run, we can safely assign the full amount
                        if (order.processes.length === 1 && orderProcess.runs.length === 1) {
                            amount = totalOrderAmount;
                        } else {
                            // Otherwise, estimate it based on the order's estimated amount distribution
                            const totalEstimated = Number(order.estimatedAmount) || 0;
                            const runEstimated = Number(runFields?.estimated_amount || 0);
                            
                            if (totalEstimated > 0) {
                                amount = (runEstimated / totalEstimated) * totalOrderAmount;
                            } else {
                                // If no estimates, distribute equally across all runs in all processes
                                const totalRuns = order.processes.reduce((acc, p) => acc + p.runs.length, 0);
                                amount = totalOrderAmount / (totalRuns || 1);
                            }
                        }

                        if (rate === 0 && amount > 0 && numericQuantity > 0) {
                            rate = amount / numericQuantity;
                        }
                    }

                    const processName = orderProcess.process.name.toLowerCase();
                    const isSublimation = processName.includes("all over sublimation") || processName.includes("allover sublimation");

                    if (isSublimation) {
                        const mtrValue = runFields?.["Total Mtr"] || (runBilling?.["total_mtr"]);
                        if (mtrValue !== undefined) numericQuantity = Number(mtrValue);
                    }

                    let displayQuantity: string | number = numericQuantity;
                    if (isSublimation) {
                        displayQuantity = `${parseFloat(numericQuantity.toFixed(2))} mtr`;
                    }

                    let description = runFields?.particulars || 
                                      runFields?.Particulars ||
                                      runFields?.design || 
                                      runFields?.Design ||
                                      runFields?.designName || 
                                      runFields?.DesignName ||
                                      runFields?.particular || 
                                      runFields?.Particular || "";

                    if (!description && Array.isArray(runFields?.items)) {
                        description = runFields.items
                            .map((item: any) => item.design || item.particulars || item.description || item.designSizes || item.fileSizes)
                            .filter(Boolean)
                            .join(", ");
                    }

                    if (search) {
                        const searchLower = search.toLowerCase();
                        const matchesDescription = description.toLowerCase().includes(searchLower);
                        const matchesOrderCode = order.code.toLowerCase().includes(searchLower);
                        const matchesCustomer = order.customer.name.toLowerCase().includes(searchLower);

                        if (!matchesDescription && !matchesOrderCode && !matchesCustomer) {
                            continue;
                        }
                    }

                    const productionDate = orderProcess.lifecycleCompletedAt || date;

                    reportData.push({
                        orderCode: order.code,
                        images: order.images || [],
                        processName: orderProcess.process.name,
                        runNumbers: run.runNumber.toString(),
                        description: description || "-",
                        customerName: order.customer.name,
                        quantity: displayQuantity,
                        rate: rate.toFixed(2),
                        amount: amount.toFixed(2),
                        billNumber: runBillNumber,
                        date: productionDate.toISOString().split('T')[0],
                        preProductionLocation: run.preProductionLocation?.name || "-",
                        postProductionLocation: run.postProductionLocation?.name || "-",
                    });
                }
            }
        }

        // Calculate metadata for the full filtered set from raw data
        let totalAmount = 0;
        let totalQty = 0;

        for (const row of reportData) {
            // Extract numeric amount (handling string formatting if any)
            const amt = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount).replace(/,/g, ''));
            totalAmount += (isNaN(amt) ? 0 : amt);

            // Extract numeric quantity (handling "mtr" suffix or other strings)
            let qtyStr = String(row.quantity);
            if (qtyStr.includes('mtr')) {
                qtyStr = qtyStr.replace('mtr', '').trim();
            }
            const qty = parseFloat(qtyStr);
            totalQty += (isNaN(qty) ? 0 : qty);
        }

        const total = reportData.length;

        // Apply pagination
        let paginatedData = reportData;
        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : total;

        if (page && limit) {
            const skip = (pageNum - 1) * limitNum;
            paginatedData = reportData.slice(skip, skip + limitNum);
        }

        return {
            data: paginatedData,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
                totalAmount: totalAmount,
                totalQty: totalQty
            }
        };
    }

    async exportBilledOrdersToExcel(query: ReportsQueryDto, res: Response) {
        // Fetch full report without pagination for export
        const report = await this.getBilledOrdersReport({ ...query, page: undefined, limit: undefined });
        const data = (report as any).data;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Billed Orders Report");

        worksheet.columns = [
            { header: "Order Code", key: "orderCode", width: 15 },
            { header: "Process Name", key: "processName", width: 20 },
            { header: "Run No", key: "runNumbers", width: 15 },
            { header: "Description", key: "description", width: 30 },
            { header: "Customer", key: "customerName", width: 25 },
            { header: "Quantity", key: "quantity", width: 10 },
            { header: "Rate", key: "rate", width: 10 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Bill Number", key: "billNumber", width: 20 },
            { header: "Date", key: "date", width: 15 },
            { header: "Pre-Prod Location", key: "preProductionLocation", width: 20 },
            { header: "Post-Prod Location", key: "postProductionLocation", width: 20 },
        ];

        worksheet.addRows(data);

        // Styling headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=billed_orders_report_${new Date().getTime()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }
}
