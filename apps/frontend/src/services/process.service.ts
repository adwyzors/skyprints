import { mapProcessDetailDto, mapProcessSummaryDto } from "@/domain/mapper/process/process.mapper";
import { ProcessDetail, ProcessSummary } from "@/domain/model/process.model";
import { ProcessDetailDto, ProcessDetailSchema, ProcessSummaryDto, ProcessSummarySchema } from "@app/contracts";
import { apiRequest } from "./api.service";

export async function getProcesses(): Promise<ProcessSummary[]> {
    const res = await apiRequest<ProcessSummaryDto[]>("/process");

    const dto = ProcessSummarySchema.array().parse(res);

    return dto.map(mapProcessSummaryDto);
}

export async function getProcessById(
    processId: string
): Promise<ProcessDetail> {
    const res = await apiRequest<ProcessDetailDto>(`/process/${processId}`);

    const dto = ProcessDetailSchema.parse(res);

    return mapProcessDetailDto(dto);
}
