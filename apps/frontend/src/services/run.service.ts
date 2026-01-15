import { apiRequest } from "./api.service";

export async function configureRun(
    orderId: string,
    processId: string,
    runId: string,
    fields: Record<string, string | number | null>
) {
    apiRequest<unknown>(
        `/process/${processId}/runs/${runId}/configure`,
        {
            method: "POST",
            body: JSON.stringify({ fields }),
        }
    );
}