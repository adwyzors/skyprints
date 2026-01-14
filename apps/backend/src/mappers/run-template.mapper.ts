import { RunTemplateDetailDto } from '../../../packages/contracts/dist/run-template.read.contract';


export function toRunTemplateDetail(
    template: any,
): RunTemplateDetailDto {
    return {
        id: template.id,
        name: template.name,
        fields: template.fields,
        lifecycle: template.lifecycleWorkflowType.statuses
            .sort((a, b) => a.createdAt - b.createdAt)
            .map(s => s.code),
    };
}
