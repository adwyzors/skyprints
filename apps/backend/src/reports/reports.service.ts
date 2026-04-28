import { Injectable } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports.query.dto";
import * as ExcelJS from "exceljs";
import { Response } from "express";

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async getBilledOrdersReport(query: ReportsQueryDto) {
        const { customerId, startDate, endDate, processId } = query;

        const whereClause: any = {
            statusCode: "BILLED",
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

        // Handle date filtering
        // We'll filter on Order.createdAt as fallback, 
        // but the prompt suggests using OrderAnalytics.billedAt if possible.
        // Prisma doesn't support easy filtering on non-relation tables in one go.
        // However, we can use a subquery or just filter orders and then join analytics.
        
        const orders = await this.prisma.order.findMany({
            where: whereClause,
            include: {
                customer: true,
                processes: {
                    include: {
                        process: true,
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

        for (const order of orders) {
            const orderAnalytic = analyticsMap.get(order.id);
            const date = orderAnalytic?.billedAt || order.createdAt;

            // Date filtering post-fetch if analytics used for billedAt
            if (startDate && new Date(date) < new Date(startDate)) continue;
            if (endDate && new Date(date) > new Date(endDate)) continue;

            // Billing amount and number
            const latestSnapshot = order.billingContexts[0]?.billingContext.snapshots[0];
            const amount = latestSnapshot ? Number(latestSnapshot.result) : 0;
            const billNumber = order.billingContexts[0]?.billingContext.name || order.billingContexts[0]?.billingContextId || "N/A";

            for (const orderProcess of order.processes) {
                // If filtering by processId, skip others
                if (processId && orderProcess.processId !== processId) continue;

                const rate = order.quantity > 0 ? amount / order.quantity : 0;

                reportData.push({
                    orderCode: order.code,
                    processName: orderProcess.process.name,
                    customerName: order.customer.name,
                    quantity: order.quantity,
                    rate: rate.toFixed(2),
                    amount: amount.toFixed(2),
                    billNumber: billNumber,
                    date: date.toISOString().split('T')[0],
                });
            }
        }

        return reportData;
    }

    async exportBilledOrdersToExcel(query: ReportsQueryDto, res: Response) {
        const data = await this.getBilledOrdersReport(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Billed Orders Report");

        worksheet.columns = [
            { header: "Order Code", key: "orderCode", width: 15 },
            { header: "Process Name", key: "processName", width: 20 },
            { header: "Customer", key: "customerName", width: 25 },
            { header: "Quantity", key: "quantity", width: 10 },
            { header: "Rate", key: "rate", width: 10 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Bill Number", key: "billNumber", width: 20 },
            { header: "Date", key: "date", width: 15 },
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
