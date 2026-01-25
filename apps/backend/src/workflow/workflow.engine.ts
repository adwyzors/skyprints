import {
    BadRequestException,
    Injectable
} from '@nestjs/common';
import { WorkflowEngine } from './interfaces/workflow-engine.interface';
import { evalCondition } from './utils/eval-condition';
import { WorkflowRepository } from './workflow.repository';
import { ContextLogger } from '../common/logger/context.logger';

@Injectable()
export class DynamicWorkflowEngine implements WorkflowEngine {
    private readonly logger = new ContextLogger(DynamicWorkflowEngine.name);

    constructor(
        private readonly repo: WorkflowRepository,
    ) { }

    async validateTransition(
        workflowTypeCode: string,
        fromStatusCode: string,
        toStatusCode: string,
        context: Record<string, unknown>,
    ): Promise<void> {
        this.logger.debug(
            `Validating transition | type=${workflowTypeCode} | ${fromStatusCode} → ${toStatusCode}`,
        );

        const workflowType =
            await this.repo.findWorkflowTypeByCode(workflowTypeCode);

        if (!workflowType || !workflowType.isActive) {
            this.logger.warn(
                `Inactive or missing workflow type: ${workflowTypeCode}`,
            );
            throw new BadRequestException('Invalid workflow type');
        }

        const transition = await this.repo.findTransitionByCodes({
            workflowTypeId: workflowType.id,
            fromStatusCode,
            toStatusCode,
        });

        if (!transition) {
            this.logger.warn(
                `Transition not allowed | ${fromStatusCode} → ${toStatusCode}`,
            );
            throw new BadRequestException('Invalid status transition');
        }

        if (transition.condition) {
            this.logger.debug(
                `Evaluating transition condition: ${transition.condition}`,
            );

            const result = evalCondition(
                transition.condition,
                context ?? {},
            );

            if (!result) {
                this.logger.warn(
                    `Transition condition failed | ${transition.condition}`,
                );
                throw new BadRequestException(
                    'Transition condition failed',
                );
            }
        }

        this.logger.log(
            `Transition validated | ${fromStatusCode} → ${toStatusCode}`,
        );
    }
}
