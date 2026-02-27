import { apiRequest, apiRequestWithHeaders } from "./api.service";

export async function configureRun(
    orderId: string,
    processId: string,
    runId: string,
    fields: Record<string, any>,
    images?: string[],
    executorId?: string,
    reviewerId?: string,
    locationId?: string
) {
    const payload: any = {
        fields,
    };

    if (images && images.length > 0) {
        payload.images = images;
    }

    if (executorId) {
        payload.executorId = executorId;
    }

    if (reviewerId) {
        payload.reviewerId = reviewerId;
    }

    if (locationId) {
        payload.locationId = locationId;
    }

    // Using specialized endpoint for process run configuration
    const res = await apiRequest<{ success: boolean }>(
        `/process/${processId}/runs/${runId}/configure`,
        {
            method: "POST",
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    return res;
}

export async function transitionLifeCycle(
    orderId: string,
    processId: string,
    runId: string,
    fields: Record<string, any>
) {
    return apiRequest<{ success: boolean }>(
        `/process/${processId}/runs/${runId}/transition`,
        {
            method: "POST",
            body: JSON.stringify(fields),
        }
    );
}

export interface GetRunsParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string | string[];
    lifeCycleStatusCode?: string | string[];
    priority?: string | string[];
    executorUserId?: string;
    reviewerUserId?: string;
    assignedUserId?: string;
    createdFrom?: string;
    createdTo?: string;
    customerId?: string;
    processId?: string;
    locationId?: string;
    orderStatus?: string | string[];
}

export interface GetRunsResponse {
    runs: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalEstimatedAmount?: number;
    totalQuantity?: number;
}

export async function getRuns(params: GetRunsParams = {}): Promise<GetRunsResponse> {
    const queryParams = new URLSearchParams();
    const requestedPage = params.page || 1;
    const requestedLimit = params.limit || 20;

    queryParams.append('page', requestedPage.toString());
    queryParams.append('limit', requestedLimit.toString());

    if (params.search) queryParams.append('search', params.search);

    // Helper to append array or string params
    const appendParam = (key: string, value?: string | string[]) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(v => {
                if (v) queryParams.append(key, v);
            });
        } else {
            queryParams.append(key, value);
        }
    };

    appendParam('status', params.status);
    appendParam('lifeCycleStatusCode', params.lifeCycleStatusCode);
    appendParam('priority', params.priority);
    appendParam('orderStatus', params.orderStatus);

    if (params.executorUserId && params.executorUserId !== 'all') queryParams.append('executorUserId', params.executorUserId);
    if (params.reviewerUserId && params.reviewerUserId !== 'all') queryParams.append('reviewerUserId', params.reviewerUserId);
    if (params.assignedUserId) queryParams.append('assignedUserId', params.assignedUserId);

    // Use appendParam for these to handle arrays if they ever become arrays, 
    // and to benefit from the 'all' check logic if added there (optional)
    if (params.customerId && params.customerId !== 'all') appendParam('customerId', params.customerId);
    if (params.processId && params.processId !== 'all') appendParam('processId', params.processId);
    if (params.locationId && params.locationId !== 'all') appendParam('locationId', params.locationId);

    if (params.createdFrom) queryParams.append('createdFrom', params.createdFrom);
    if (params.createdTo) queryParams.append('createdTo', params.createdTo);

    const queryString = queryParams.toString();
    const url = queryString ? `/process/runs?${queryString}` : '/process/runs';

    const { data: res, headers } = await apiRequestWithHeaders<any>(url);

    // Extract runs array from response
    let runsArray: any[] = [];
    if (res.data && Array.isArray(res.data)) {
        runsArray = res.data;
    } else if (Array.isArray(res)) {
        runsArray = res;
    }

    const total = parseInt(headers.get('x-total-count') || String(runsArray.length), 10);
    const page = parseInt(headers.get('x-page') || String(requestedPage), 10);
    const limit = parseInt(headers.get('x-limit') || String(requestedLimit), 10);
    const totalPages = parseInt(headers.get('x-total-pages') || '1', 10);
    const totalEstimatedAmount = parseFloat(headers.get('x-total-estimated-amount') || '0');
    const totalQuantity = parseInt(headers.get('x-total-quantity') || '0', 10);

    return {
        runs: runsArray,
        total,
        page,
        limit,
        totalPages,
        totalEstimatedAmount,
        totalQuantity
    };
}

export async function getRunById(processRunId: string): Promise<any> {
    return apiRequest<any>(`/process/runs/${processRunId}`);
}