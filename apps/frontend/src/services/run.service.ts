import { apiRequest } from "./api.service";

export async function configureRun(
    orderId: string,
    processId: string,
    runId: string,
    fields: Record<string, any>,
    images?: string[],
    executorId?: string,
    reviewerId?: string
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