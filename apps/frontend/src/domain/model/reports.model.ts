export interface BilledOrderReportRow {
    orderCode: string;
    images?: string[];
    processName: string;
    description?: string;
    customerName: string;
    quantity: number;
    rate: string;
    amount: string;
    billNumber: string;
    date: string;
}

export interface ReportsQuery {
    customerId?: string;
    startDate?: string;
    endDate?: string;
    processId?: string;
    page?: number;
    limit?: number;
}

export interface BilledOrderReportResponse {
    data: BilledOrderReportRow[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalAmount: number;
        totalQty: number;
    };
}
