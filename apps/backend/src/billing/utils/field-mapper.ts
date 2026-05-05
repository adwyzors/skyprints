export function normalizeFieldKey(key: string): string {
    return key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function extractNumericVariables(
    values: Record<string, unknown>
): Record<string, number> {
    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(values)) {
        const normalizedKey = normalizeFieldKey(key);

        if (typeof value === "number" && Number.isFinite(value)) {
            result[normalizedKey] = value;
        } else if (typeof value === "string") {
            // Attempt to parse string as number
            const cleaned = value.replace(/[^0-9.-]+/g, '');
            const parsed = parseFloat(cleaned);
            if (!isNaN(parsed) && Number.isFinite(parsed)) {
                result[normalizedKey] = parsed;
            }
        }
    }

    return result;
}
