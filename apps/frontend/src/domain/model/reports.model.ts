export interface BilledOrderReportRow {
    orderCode: string;
    processName: string;
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
