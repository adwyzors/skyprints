import { apiRequest } from "./api.service";

export async function configureRun(
    orderId: string,
    processId: string,
    runId: string,
    fields: Record<string, any>,
    images?: File[]
) {
    const formData = new FormData();
    formData.append('fields', JSON.stringify(fields));

    if (images && images.length > 0) {
        images.forEach((image) => {
            formData.append('images', image);
        });
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/process/${processId}/runs/${runId}/configure`, {
        method: "POST",
        body: formData,
        credentials: 'include',
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to configure run' }));
        throw new Error(error.message || 'Failed to configure run');
    }

    return res.json();
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
            body: JSON.stringify({ fields }),
        }
    );
}