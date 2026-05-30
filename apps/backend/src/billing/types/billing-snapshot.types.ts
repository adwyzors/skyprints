export type OrderBillingInputs =
    Record<string, Record<string, number>>;

export function isOrderBillingInputs(
    value: unknown
): value is OrderBillingInputs {
    if (!value || typeof value !== "object") {
        return false;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    
    for (const [key, val] of entries) {
        // Skip metadata keys
        if (key.startsWith('__')) continue;

        // If it's a nested object (Run ID -> Fields)
        if (val && typeof val === "object" && !Array.isArray(val)) {
            for (const [fieldKey, fieldVal] of Object.entries(val as Record<string, unknown>)) {
                if (fieldKey.startsWith('__')) continue;
                
                // Allow numbers or numeric strings
                if (typeof fieldVal !== "number" && typeof fieldVal !== "string") {
                    return false;
                }
            }
        } 
        // If it's a flat object (Field -> Value)
        else if (typeof val !== "number" && typeof val !== "string") {
            return false;
        }
    }

    return true;
}
