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
        const start = startDate ? new Date(startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        for (const order of orders) {
            const orderAnalytic = analyticsMap.get(order.id);
            const date = orderAnalytic?.billedAt || order.createdAt;

            // Date filtering post-fetch
            if (start && date < start) continue;
            if (end && date > end) continue;

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
                        // fallback to snapshot.result if __ORDER_RESULT__ missing (though it shouldn't be)
                    } else {
                        amount = Number(snapshot.result);
                    }
                }
            }

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
