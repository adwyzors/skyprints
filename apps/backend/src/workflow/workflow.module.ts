import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { DynamicWorkflowEngine } from './workflow.engine';
import { WorkflowRepository } from './workflow.repository';
import { OUTBOX_PORT, WORKFLOW_ENGINE, WorkflowService } from './workflow.service';

@Module({
    imports: [OutboxModule],
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