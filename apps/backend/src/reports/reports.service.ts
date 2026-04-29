import { Injectable } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports.query.dto";
import * as ExcelJS from "exceljs";
import { Response } from "express";

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async getBilledOrdersReport(query: ReportsQueryDto) {
        const { customerId, startDate, endDate, processId, page, limit } = query;

        const whereClause: any = {
            statusCode: { in: ["BILLED", "GROUP_BILLED"] },
            deletedAt: null,
        };

        if (customerId) {
            whereClause.customerId = customerId;
        }

        if (processId) {
            whereClause.processes = {
                some: {
                    processId: processId,
                },
            };
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
                    include: {
                        billingContext: {
                            include: {
                                snapshots: {
                                    where: { isLatest: true },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Fetch OrderAnalytics for billedAt if it exists
        const orderIds = orders.map((o) => o.id);
        const analytics = await this.prisma.orderAnalytics.findMany({
            where: {
                orderId: { in: orderIds },
            },
        });

        const analyticsMap = new Map(analytics.map((a) => [a.orderId, a]));

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
            // Fallback
        } else if (end) {
            end.setHours(23, 59, 59, 999);
        }

        for (const order of orders) {
            const orderAnalytic = analyticsMap.get(order.id);
            const date = orderAnalytic?.billedAt || order.createdAt;

            // Date filtering post-fetch
            if (start && !isNaN(start.getTime()) && date < start) continue;
            if (end && !isNaN(end.getTime()) && date > end) continue;

            // Billing amount and number extraction
            let amount = 0;
            let billNumber = "N/A";

            // Find the most relevant context (prefer GROUP if it's GROUP_BILLED, else ORDER)
            const contextOrder = order.statusCode === "GROUP_BILLED" 
                ? order.billingContexts.find(bc => bc.billingContext.type === "GROUP") || order.billingContexts[0]
                : order.billingContexts.find(bc => bc.billingContext.type === "ORDER") || order.billingContexts[0];

            if (contextOrder) {
                const context = contextOrder.billingContext;
                const snapshot = context.snapshots[0];
                billNumber = context.name || context.id;

                if (snapshot) {
                    if (context.type === "GROUP") {
                        // Extract this order's portion from group inputs
                        const inputs = snapshot.inputs as any;
                        const orderResult = inputs?.[order.id]?.["__ORDER_RESULT__"];
                        amount = orderResult ? Number(orderResult) : Number(snapshot.result); 
                    } else {
                        amount = Number(snapshot.result);
                    }
                }
            }

            for (const orderProcess of order.processes) {
                if (processId && orderProcess.processId !== processId) continue;

                const rate = order.quantity > 0 ? amount / order.quantity : 0;

                const runDescs = orderProcess.runs.map(r => {
                    const values = r.fields as any;
                    const mainDesc = values?.particulars || values?.design || values?.designName || values?.particular;
                    if (mainDesc) return mainDesc;

                    if (Array.isArray(values?.items)) {
                        const itemDescs = values.items
                            .map((item: any) => item.design || item.particulars || item.description || item.designSizes || item.fileSizes)
                            .filter(Boolean);
                        if (itemDescs.length > 0) return itemDescs.join(", ");
                    }
                    return null;
                }).filter(Boolean);

                const description = Array.from(new Set(runDescs)).join("; ");

                const productionDate = orderProcess.lifecycleCompletedAt || date;

                const preProductionLocations = Array.from(new Set(
                    orderProcess.runs
                        .map(r => (r as any).preProductionLocation?.name)
                        .filter(Boolean)
                )).join(", ");

                const postProductionLocations = Array.from(new Set(
                    orderProcess.runs
                        .map(r => (r as any).postProductionLocation?.name)
                        .filter(Boolean)
                )).join(", ");

                reportData.push({
                    orderCode: order.code,
                    images: order.images || [],
                    processName: orderProcess.process.name,
                    description: description || "-",
                    customerName: order.customer.name,
                    quantity: order.quantity,
                    rate: rate.toFixed(2),
                    amount: amount.toFixed(2),
                    billNumber: billNumber,
                    date: productionDate.toISOString().split('T')[0],
                    preProductionLocation: preProductionLocations || "-",
                    postProductionLocation: postProductionLocations || "-",
                });
            }
        }

        // Calculate metadata for the full filtered set
        const totalAmount = reportData.reduce((sum, row) => sum + parseFloat(row.amount), 0);
        const totalQty = reportData.reduce((sum, row) => sum + row.quantity, 0);
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
                totalAmount,
                totalQty
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
