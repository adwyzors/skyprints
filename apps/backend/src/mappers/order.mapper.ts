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
    useOrderImageForRuns: order.useOrderImageForRuns || false,
    isTest: order.isTest || false,
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

      runs: op.runs.map((run: any) => {
        const runFields = run.fields || {};
        const runImages =
          runFields.images && runFields.images.length > 0
            ? runFields.images
            : order.useOrderImageForRuns
              ? order.images
              : [];

        return {
          id: run.id,
          runNumber: run.runNumber,
          displayName: run.displayName,
          comments: run.comments,

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

          claimedBy: run.claimedByUser
            ? {
                id: run.claimedByUser.id,
                name: run.claimedByUser.name,
              }
            : null,

          location: run.location
            ? {
                id: run.location.id,
                name: run.location.name,
                code: run.location.code,
              }
            : null,

          preProductionLocation: run.preProductionLocation
            ? {
                id: run.preProductionLocation.id,
                name: run.preProductionLocation.name,
                code: run.preProductionLocation.code,
              }
            : null,

          postProductionLocation: run.postProductionLocation
            ? {
                id: run.postProductionLocation.id,
                name: run.postProductionLocation.name,
                code: run.postProductionLocation.code,
              }
            : null,

          lifecycle: buildLifecycleProgress(
            run.runTemplate.lifecycleWorkflowType.statuses,
            run.lifeCycleStatusCode,
            run.lifecycleHistories,
            run.stageHistories,
          ),
          lifecycleHistory: (run.lifecycleHistories || []).map((h: any) => ({
            statusCode: h.statusCode,
            expectedDate: h.expectedDate?.toISOString() || null,
            completedAt: h.completedAt?.toISOString() || null,
            createdAt: h.createdAt.toISOString(),
          })),

          values: {
            ...runFields,
            images: runImages,
          },
          fields: run.runTemplate.fields,
          billingFormula: run.runTemplate.billingFormula,
        };
      }),
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
  histories: any[] = [],
  stageHistories: any[] = [],
) {
  let reachedCurrent = false;

  const managerByCode = new Map(
    stageHistories.map((h) => [h.lifecycleStage.code, h.manager]),
  );

  return statuses.map((s) => {
    const history = histories.find((h) => h.statusCode === s.code);
    const manager = managerByCode.get(s.code) ?? null;

    if (s.code === currentCode) {
      reachedCurrent = true;
      return {
        code: s.code,
        completed: s.isTerminal,
        expectedDate: history?.expectedDate?.toISOString() || null,
        completedAt: history?.completedAt?.toISOString() || null,
        manager,
      };
    }

    return {
      code: s.code,
      completed: !reachedCurrent,
      expectedDate: history?.expectedDate?.toISOString() || null,
      completedAt: history?.completedAt?.toISOString() || null,
      manager,
    };
  });
}
