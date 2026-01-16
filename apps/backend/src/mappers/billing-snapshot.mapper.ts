export function toBillingSnapshotDto(db: any) {
    return {
        version: db.version,
        isLatest: db.isLatest,

        total: {
            amount: db.result.toString(),
            currency: db.currency,
        },

        inputs: Object.entries(db.inputs).map(
            ([runId, values]) => ({
                runId,
                values: values as Record<string, number>,
            })
        ),

        calculationType:
            db.source === "RECALCULATION"
                ? "RECALCULATED"
                : "INITIAL",

        createdAt: db.createdAt.toISOString(),
    };
}
