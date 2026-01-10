import { Process } from "@/model/process.model";
import { apiRequest } from "./api.service";
import { ProcessDtoSchema } from "@/dto/process/process.dto";
import { mapProcessDtoToModel } from "@/mapper/process/process.mapper";

export async function getProcesses(): Promise<Process[]> {
    const res = await apiRequest<unknown[]>("/process");

    const dto = ProcessDtoSchema.array().parse(res);

    return dto.map(mapProcessDtoToModel);
}
