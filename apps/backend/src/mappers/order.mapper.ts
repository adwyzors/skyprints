import { OrderSummaryDto } from '@app/contracts';

export function toOrderSummary(order: any): OrderSummaryDto {
    return {
        id: order.id,
        quantity: order.quantity,
        status: order.statusCode,
        createdAt: order.createdAt.toISOString(),
        code: order.code,
        jobCode: order.jobCode,
        images: order.images || [],
        totalProcesses: order.totalProcesses,
        completedProcesses: order.completedProcesses,

        // ✅ CREATED / ASSIGNED USER
        createdBy: order.createdBy
            ? {
                id: order.createdBy.id,
                name: order.createdBy.name,
            }
            : null,

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

                executor: run.executor
                    ? {
                        id: run.executor.id,
                        name: run.executor.name,
                    }
                    : null,

                reviewer: run.reviewer
                    ? {
                        id: run.reviewer.id,
                        name: run.reviewer.name,
                    }
                    : null,

                location: run.location
                    ? {
                        id: run.location.id,
                        name: run.location.name,
                        code: run.location.code,
                    }
                    : null,

                lifecycle: buildLifecycleProgress(
                    run.runTemplate.lifecycleWorkflowType.statuses,
                    run.lifeCycleStatusCode,
                ),

                values: run.fields,
                fields: run.runTemplate.fields,
                billingFormula: run.runTemplate.billingFormula,
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
