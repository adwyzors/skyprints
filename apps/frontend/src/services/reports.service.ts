import { BilledOrderReportRow, BilledOrderReportResponse, ReportsQuery } from "../domain/model/reports.model";
import { apiRequest } from "./api.service";

export const getBilledOrdersReport = async (query: ReportsQuery): Promise<BilledOrderReportResponse> => {
    const params = new URLSearchParams();
    if (query.customerId) params.append('customerId', query.customerId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.processId) params.append('processId', query.processId);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    return apiRequest<BilledOrderReportResponse>(`/reports/billed-orders?${params.toString()}`);
};

export const getExportUrl = (query: ReportsQuery): string => {
    const params = new URLSearchParams();
    if (query.customerId) params.append('customerId', query.customerId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.processId) params.append('processId', query.processId);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${baseUrl}/reports/billed-orders/export?${params.toString()}`;
};
