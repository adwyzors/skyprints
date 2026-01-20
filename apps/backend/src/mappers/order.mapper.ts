import { OrderSummaryDto } from '@app/contracts';

export function toOrderSummary(order: any): OrderSummaryDto {
    return {
        id: order.id,
        quantity: order.quantity,
        status: order.statusCode,
        createdAt: order.createdAt.toISOString(),
        code: order.code,
        jobCode: order.jobCode,
        totalProcesses: order.totalProcesses,
        completedProcesses: order.completedProcesses,

        customer: {
            id: order.customer.id,
            code: order.customer.code,
            name: order.customer.name,
        },

        processes: order.processes.map((op: any) => ({
            id: op.id,
            name: op.process.name,
            processId: op.process.id,
            status: op.statusCode,

            totalRuns: op.totalRuns,
            completedRuns: op.lifecycleCompletedRuns,

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

/* =========================================================
 * LIFECYCLE VISUALIZATION HELPER
 * ========================================================= */

type LifecycleStatus = {
    code: string;
    isInitial: boolean;
    isTerminal: boolean;
};

function buildLifecycleProgress(
    statuses: LifecycleStatus[],
    currentCode: string,
) {
    let reachedCurrent = false;

    return statuses.map(s => {
        if (s.code === currentCode) {
            reachedCurrent = true;
            return {
                code: s.code,
                completed: s.isTerminal,
            };
        }

        return {
            code: s.code,
            completed: !reachedCurrent,
        };
    });
}
