export interface Run {
    id: string; // runId
    runNumber: number;
    statusCode: string;
    lifeCycleStatusCode: string;
    configStatus?: string;
    displayName: string;
    fields?: Record<string, any>;
    createdAt: string;

    // Added processName
    orderProcess: {
        name: string;
        order: {
            id: string;
            code: string;
            customer: {
                name: string;
            };
        };
        totalRuns: number;
        lifecycleCompletedRuns: number;
        remainingRuns: number;
    };

    runTemplate?: {
        name: string;
    };
    executor?: {
        name: string;
    };
    reviewer?: {
        name: string;
    };
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
