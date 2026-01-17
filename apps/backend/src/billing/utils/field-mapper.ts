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
        }
    }

    return result;
}
