import { ProcessDetailDto, ProcessSummaryDto } from '@app/contracts';


export function toProcessDetail(process: any): ProcessDetailDto {
    return {
        id: process.id,
        name: process.name,
        description: process.description,

        runs: process.runDefs
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(r => ({
                runTemplateId: r.runTemplateId,
                displayName: r.displayName,
                sortOrder: r.sortOrder,
            })),
    };
}

export function toProcessSummary(
    process: any,
): ProcessSummaryDto {
    return {
        id: process.id,
        name: process.name,
        description: process.description ?? null,
        runCount: process.runDefs.length,
    };
}
