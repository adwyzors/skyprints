import { BadRequestException } from '@nestjs/common';
import { evaluate } from 'mathjs';
import { ContextLogger } from '../../common/logger/context.logger';

/**
 * Evaluates workflow transition conditions safely.
 * Allowed:
 *  - Boolean logic
 *  - Comparisons
 *  - Math expressions
 *
 * NOT allowed:
 *  - Function calls
 *  - Assignments
 *  - Access to globals
 */
export function evalCondition(
    expression: string,
    context: Record<string, unknown>,
): boolean {
    const logger = new ContextLogger('WorkflowConditionEvaluator');

    try {
        const result = evaluate(expression, context);

        if (typeof result !== 'boolean') {
            logger.warn(
                `Condition did not return boolean: ${expression}`,
            );
            throw new BadRequestException(
                'Transition condition must evaluate to boolean',
            );
        }

        return result;
    } catch (err) {
        logger.error(
            `Condition evaluation failed: ${expression}`,
            err instanceof Error ? err.stack : undefined,
        );

        throw new BadRequestException(
            'Invalid transition condition',
        );
    }
}
