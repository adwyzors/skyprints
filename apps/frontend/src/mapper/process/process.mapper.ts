// src/mapper/process/process.mapper.ts
import { OrderProcessDto, ProcessDto } from "@/dto/process/process.dto";
import { OrderProcess, Process } from "@/model/process.model";
import { mapProcessRunDtoToModel, mapRunDefDtoToModel } from "../run/run.mapper";

export function mapProcessDtoToModel(dto: ProcessDto): Process {
    return {
        id: dto.id,
        description: dto.description,
        isEnabled: dto.isEnabled,
        name: dto.name,
        runDefs: dto.runDefs.map(mapRunDefDtoToModel),
    };
}

export function mapOrderProcessDtoToModel(dto: OrderProcessDto): OrderProcess {
    return {
        id: dto.id,
        createdAt: dto.createdAt,
        maxRuns: dto.maxRuns,
        minRuns: dto.minRuns,
        orderId: dto.orderId,
        processId: dto.processId,
        processName: dto.process.name,
        runs: dto.runs.map(mapProcessRunDtoToModel),
        statusCode: dto.statusCode,
    };
}
