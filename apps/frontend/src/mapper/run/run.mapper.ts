import { RunDto } from "@/dto/run/run.dto"
import { Run } from "../../model/run.model"

export function mapRunDtoToModel(
    dto: RunDto
): Run {
    return {
        id: dto.id,
        displayName: dto.displayName,
        runNumber: dto.runNumber,
        status: dto.statusCode,
        fields: dto.fields,
        locationId: dto.locationId
    }
}
