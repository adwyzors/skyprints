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
}
