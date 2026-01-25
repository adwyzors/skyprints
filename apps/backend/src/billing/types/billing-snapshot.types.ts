export type OrderBillingInputs =
    Record<string, Record<string, number>>;

export function isOrderBillingInputs(
    value: unknown
): value is OrderBillingInputs {
    if (!value || typeof value !== "object") {
        return false;
    }

    for (const run of Object.values(value as Record<string, unknown>)) {
        if (!run || typeof run !== "object") {
            return false;
        }

        for (const field of Object.values(run as Record<string, unknown>)) {
            if (typeof field !== "number" || !Number.isFinite(field)) {
                return false;
            }
        }
    }

    return true;
}
