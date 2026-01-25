import { Module } from '@nestjs/common';
import { DynamicWorkflowEngine } from './workflow.engine';
import { WorkflowRepository } from './workflow.repository';
import { OUTBOX_PORT, WORKFLOW_ENGINE, WorkflowService } from './workflow.service';

@Module({
    providers: [
        WorkflowService,
        {
            provide: WORKFLOW_ENGINE,
            useClass: DynamicWorkflowEngine,
        },
        DynamicWorkflowEngine,
        WorkflowRepository,
        {
            provide: OUTBOX_PORT,
            useValue: {
                add: async () => Promise.resolve(),
            },
        },
    ],
})
export class WorkflowModule { }