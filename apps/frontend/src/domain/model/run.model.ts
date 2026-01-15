export interface ProcessRun {
    id: string;
    runNumber: number;
    displayName: string;
    configStatus: string;
    lifecycleStatus: string;
    values: Record<string, unknown>;
    fields: RunField[];
}

export interface RunField {
    key: string;
    type: string;
    required: boolean;
}
