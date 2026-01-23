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

export async function uploadProcessRunImages(
  orderProcessId: string,
  processRunId: string,
  files: File[],
) {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('files', file); // IMPORTANT: must be "files"
  });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/order-process/${orderProcessId}/runs/${processRunId}/images`,
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      message: 'Failed to upload process run images',
    }));
    throw new Error(error.message);
  }

  return res.json();
}

