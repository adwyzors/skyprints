import {
    ProcessDetailDto,
    ProcessSummaryDto,
} from "@app/contracts";

import {
    ProcessDetail,
    ProcessRunDefinition,
    ProcessSummary,
} from "@/domain/model/process.model";

/* =====================================================
 * SUMMARY
 * ===================================================== */

export const mapProcessSummaryDto = (
    dto: ProcessSummaryDto
): ProcessSummary => ({
    id: dto.id,
    name: dto.name,
    description: dto.description ?? undefined,
    runCount: dto.runCount,
});

/* =====================================================
 * DETAIL
 * ===================================================== */

export const mapProcessDetailDto = (
    dto: ProcessDetailDto
): ProcessDetail => ({
    id: dto.id,
    name: dto.name,
    description: dto.description ?? undefined,
    runs: dto.runs.map(mapProcessRunDefinitionDto),
});

/* =====================================================
 * RUN DEFINITION
 * ===================================================== */

const mapProcessRunDefinitionDto = (
    dto: ProcessDetailDto["runs"][number]
): ProcessRunDefinition => ({
    id: dto.id,
    displayName: dto.displayName,
    sortOrder: dto.sortOrder,
    templateName: dto.runTemplate.name,
    fields: dto.runTemplate.fields,
});
