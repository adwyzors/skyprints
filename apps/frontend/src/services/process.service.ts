import { Process } from "@/model/process.model";
import { apiRequest } from "./api.service";
import { ProcessDtoArraySchema, ProcessDtoSchema } from "@/dto/process/process.dto";
import { mapProcessDtoToModel } from "@/mapper/process/process.mapper";

export async function getProcesses(): Promise<Process[]> {
    const res = await apiRequest<unknown[]>("/process");

    const dto = ProcessDtoArraySchema.parse(res);

    return dto.map(mapProcessDtoToModel);
}

//export async function getProcesses(): Promise<Process[]> {
//    const res = await apiRequest<unknown[]>("/process");

//    const dto = ProcessDtoArraySchema.parse(res);

//    return dto.map(mapProcessDtoToModel);
//}
