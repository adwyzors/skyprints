import { ProcessDto } from "@/dto/process/process.dto"
import { Process } from "../../model/process.model"
import { mapRunDtoToModel } from "../run/run.mapper"

export function mapProcessDtoToModel(
    dto: ProcessDto
): Process {
    return {
        id: dto.id,
        processId: dto.processId,
        status: dto.statusCode,
        minRuns: dto.minRuns,
        maxRuns: dto.maxRuns,
        runs: dto.runs.map(mapRunDtoToModel),
        processName: dto.process?.name || null
    }
}
