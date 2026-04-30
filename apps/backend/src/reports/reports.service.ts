import { Injectable } from "@nestjs/common";
import { PrismaService } from "apps/backend/prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports.query.dto";
import * as ExcelJS from "exceljs";
import { Response } from "express";

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

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

            // Find the most relevant context (prefer GROUP if it's GROUP_BILLED, else ORDER)
            const contextOrder = order.statusCode === "GROUP_BILLED" 
                ? order.billingContexts.find(bc => bc.billingContext.type === "GROUP") || order.billingContexts[0]
                : order.billingContexts.find(bc => bc.billingContext.type === "ORDER") || order.billingContexts[0];

            let billingInputs: any = null;
            let billNumber = "N/A";
            
            if (contextOrder) {
                const context = contextOrder.billingContext;
                const snapshot = context.snapshots[0];
                billNumber = context.name || context.id;

                if (snapshot) {
                    if (context.type === "GROUP") {
                        // Extract this order's portion from group inputs
                        const inputs = snapshot.inputs as any;
                        billingInputs = inputs?.[order.id];
                    } else {
                        billingInputs = snapshot.inputs;
                    }
                }
            }

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
                    
                    // Comprehensive quantity extraction from run fields
                    const getRunQty = (fields: any) => {
                        return fields?.["Total Mtr"] || 
                               fields?.["Total Quantity"] || 
                               fields?.["Total Pieces"] || 
                               fields?.["Quantity"] || 
                               fields?.["quantity"] || 
                               fields?.["qty"] || 
                               fields?.["Qty"];
                    };

                    let numericQuantity = Number(getRunQty(runFields) || order.quantity);
                    let rate = 0;

                    if (billingInputs && billingInputs[run.id]) {
                        const runBilling = billingInputs[run.id];
                        amount = Number(runBilling["__RESULT__"] || 0);
                        
                        // Try to find quantity in billing inputs (which include normalized run fields)
                        const inputQty = runBilling["total_mtr"] || 
                                         runBilling["total_quantity"] || 
                                         runBilling["total_pieces"] || 
                                         runBilling["quantity"] || 
                                         runBilling["qty"];
                        
                        if (inputQty !== undefined) {
                            numericQuantity = Number(inputQty);
                        }
                        
                        // Use final rate from snapshot if available, otherwise fallback to rate/price or calculated
                        rate = Number(runBilling["finalRate"] || runBilling["final_rate"] || runBilling["rate"] || runBilling["price"] || runBilling["Rate"] || runBilling["Price"] || (numericQuantity > 0 ? amount / numericQuantity : 0));
                    }

                    // For allover sublimation, show mtr
                    const processName = orderProcess.process.name.toLowerCase();
                    const isSublimation = processName.includes("all over sublimation") || processName.includes("allover sublimation");
                    
                    if (isSublimation) {
                        const mtrValue = runFields?.["Total Mtr"] || (billingInputs && billingInputs[run.id]?.["total_mtr"]);
                        if (mtrValue !== undefined) numericQuantity = Number(mtrValue);
                    }

                    let displayQuantity: string | number = numericQuantity;
                    if (isSublimation) {
                        displayQuantity = `${numericQuantity} mtr`;
                    }

                    // Description logic from run fields
                    let description = runFields?.particulars || runFields?.design || runFields?.designName || runFields?.particular || "";
                    
                    if (!description && Array.isArray(runFields?.items)) {
                        description = runFields.items
                            .map((item: any) => item.design || item.particulars || item.description || item.designSizes || item.fileSizes)
                            .filter(Boolean)
                            .join(", ");
                    }

                    // Search filtering
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
                        billNumber: billNumber,
                        date: productionDate.toISOString().split('T')[0],
                        preProductionLocation: run.preProductionLocation?.name || "-",
                        postProductionLocation: run.postProductionLocation?.name || "-",
                    });
                }
            }
        }

        // Calculate metadata for the full filtered set
        const totalAmount = reportData.reduce((sum, row) => {
            const amt = parseFloat(String(row.amount).replace(/,/g, ''));
            return sum + (isNaN(amt) ? 0 : amt);
        }, 0);
        
        const totalQty = reportData.reduce((sum, row) => {
            const qty = parseInt(String(row.quantity), 10);
            return sum + (isNaN(qty) ? 0 : qty);
        }, 0);
        
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
