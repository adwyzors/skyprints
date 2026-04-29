export interface BilledOrderReportRow {
    orderCode: string;
    images?: string[];
    processName: string;
    runNumbers?: string;
    description?: string;
    customerName: string;
    quantity: number;
    rate: string;
    amount: string;
    billNumber: string;
    date: string;
    preProductionLocation?: string;
    postProductionLocation?: string;
}

export interface ReportsQuery {
    customerId?: string;
    startDate?: string;
    endDate?: string;
    processId?: string;
    preProductionLocationId?: string;
    postProductionLocationId?: string;
    search?: string;
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
