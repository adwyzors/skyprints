import { RunDefDto } from "@/dto/run/run.dto"
import { RunDef } from "../../model/run.model"
import { ProcessRunDto } from "@/dto/run/process.run.dto"
import { ProcessRun } from "@/model/process.run.model"

export function mapProcessRunDtoToModel(
    dto: ProcessRunDto
): ProcessRun {
    return {
        id: dto.id,
        displayName: dto.displayName,
        runNumber: dto.runNumber,
        statusCode: dto.statusCode,
        fields: dto.fields,
        locationId: dto.locationId,
        assignedToId: dto.assignedToId,
        completedAt: dto.completedAt,
        createdAt: dto.createdAt,
        startedAt: dto.startedAt,
        runTemplateId: dto.runTemplateId,
        statusVersion: dto.statusVersion,
        processId: dto.orderProcessId,
        runTemplate:dto.runTemplate,

    }
}


export function mapRunDefDtoToModel(
    dto: RunDefDto
): RunDef {
    return {
        id: dto.id,
        displayName: dto.displayName,
        createdAt: dto.createdAt,
        processId: dto.processId,
        runTemplate: dto.runTemplate,
        runTemplateId: dto.runTemplateId,
        sortOrder: dto.sortOrder
    }
}
