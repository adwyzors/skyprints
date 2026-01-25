import { Inject, Injectable } from '@nestjs/common';
import type { WorkflowEngine } from './interfaces/workflow-engine.interface';
import { ContextLogger } from '../common/logger/context.logger';

export interface OutboxPort {
    add(event: {
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: unknown;
    }): Promise<void>;
}

export const WORKFLOW_ENGINE = Symbol('WORKFLOW_ENGINE');
export const OUTBOX_PORT = Symbol('OUTBOX_PORT');

@Injectable()
export class WorkflowService {
    private readonly logger = new ContextLogger(WorkflowService.name);

    constructor(
        @Inject(WORKFLOW_ENGINE)
        private readonly engine: WorkflowEngine,

        @Inject(OUTBOX_PORT)
        private readonly outbox: OutboxPort,
    ) { }

    async validateAndCreateEvent(
        params: {
            entityType: string;
            entityId: string;
        },
        dto: {
            fromStatusCode: string;
            toStatusCode: string;
            context?: Record<string, unknown>;
        },
    ): Promise<void> {
        this.logger.debug(
            `Workflow transition request | entity=${params.entityType} | id=${params.entityId}`,
        );

        await this.engine.validateTransition(
            params.entityType,
            dto.fromStatusCode,
            dto.toStatusCode,
            dto.context ?? {},
        );

        await this.outbox.add({
            aggregateType: params.entityType,
            aggregateId: params.entityId,
            eventType: 'STATUS_TRANSITION_REQUESTED',
            payload: {
                fromStatusCode: dto.fromStatusCode,
                toStatusCode: dto.toStatusCode,
                context: dto.context ?? {},
            },
        });

        this.logger.log(
            `Outbox event created | STATUS_TRANSITION_REQUESTED | ${params.entityId}`,
        );
    }
}
