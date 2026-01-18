import { OrderSummaryDto } from '@app/contracts';

export function toOrderSummary(order: any): OrderSummaryDto {
    return {
        id: order.id,
        quantity: order.quantity,
        status: order.statusCode,
        createdAt: order.createdAt.toISOString(),
        code: order.code,

        customer: {
            id: order.customer.id,
            code: order.customer.code,
            name: order.customer.name,
        },

        processes: order.processes.map((op: any) => ({
            id: op.id,
            name: op.process.name,
            status: op.statusCode,

            runs: op.runs.map((run: any) => ({
                id: run.id,
                runNumber: run.runNumber,
                displayName: run.displayName,

                configStatus: run.statusCode,
                lifecycleStatus: run.lifeCycleStatusCode,

                lifecycle: buildLifecycleProgress(
                    run.runTemplate.lifecycleWorkflowType.statuses,
                    run.lifeCycleStatusCode,
                ),

                values: run.fields,

                fields: run.runTemplate.fields,
            })),
        })),
    };


}
type LifecycleStatus = {
    code: string;
    isInitial: boolean;
    isTerminal: boolean;
};

function buildLifecycleProgress(
    statuses: LifecycleStatus[],
    currentCode: string,
) {
    let hasReachedCurrent = false;

    return statuses.map(s => {
        // current step
        if (s.code === currentCode) {
            hasReachedCurrent = true;

            return {
                code: s.code,
                completed: s.isTerminal, // ✅ terminal = completed
            };
        }

        return {
            code: s.code,
            completed: !hasReachedCurrent, // only steps BEFORE current are completed
        };
    });
}
