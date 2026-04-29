import { BilledOrderReportRow, BilledOrderReportResponse, ReportsQuery } from "../domain/model/reports.model";
import { apiRequestWithHeaders } from "./api.service";

export const getBilledOrdersReport = async (query: ReportsQuery): Promise<BilledOrderReportResponse> => {
    const params = new URLSearchParams();
    if (query.customerId) params.append('customerId', query.customerId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.processId) params.append('processId', query.processId);
    if (query.preProductionLocationId) params.append('preProductionLocationId', query.preProductionLocationId);
    if (query.postProductionLocationId) params.append('postProductionLocationId', query.postProductionLocationId);
    if (query.search) params.append('search', query.search);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const { data, headers } = await apiRequestWithHeaders<BilledOrderReportRow[]>(`/reports/billed-orders?${params.toString()}`);
    
    return {
        data,
        meta: {
            total: parseInt(headers.get('x-total-count') || '0', 10),
            page: parseInt(headers.get('x-page') || (query.page || 1).toString(), 10),
            limit: parseInt(headers.get('x-limit') || (query.limit || 20).toString(), 10),
            totalPages: parseInt(headers.get('x-total-pages') || '1', 10),
            totalAmount: parseFloat(headers.get('x-total-estimated-amount') || '0'),
            totalQty: parseInt(headers.get('x-total-quantity') || '0', 10),
        }
    };
};

export const getExportUrl = (query: ReportsQuery): string => {
    const params = new URLSearchParams();
    if (query.customerId) params.append('customerId', query.customerId);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.processId) params.append('processId', query.processId);
    if (query.preProductionLocationId) params.append('preProductionLocationId', query.preProductionLocationId);
    if (query.postProductionLocationId) params.append('postProductionLocationId', query.postProductionLocationId);
    if (query.search) params.append('search', query.search);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${baseUrl}/reports/billed-orders/export?${params.toString()}`;
};
