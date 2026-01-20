import {
    ProcessDetailDto,
    ProcessSummaryDto,
} from '@app/contracts';

export function toProcessDetail(process: any): ProcessDetailDto {
    const sortedRunDefs = process.runDefs
        .slice()
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    return {
        id: process.id,
        name: process.name,
        description: process.description,

        totalRunDefinitions: sortedRunDefs.length,

        runs: sortedRunDefs.map((r: any) => ({
            id: r.id,
            displayName: r.displayName,
            sortOrder: r.sortOrder,
            runTemplate: {
                id: r.runTemplate.id,
                name: r.runTemplate.name,
                fields: r.runTemplate.fields,
            },
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
