// domain/model/process.model.ts

export interface ProcessSummary {
    id: string;
    name: string;
    description?: string;
    runCount: number;
}

export interface ProcessRunDefinition {
    id: string;
    displayName: string;
    sortOrder: number;
    templateName: string;
    fields: any[];
}

export interface ProcessDetail {
    id: string;
    name: string;
    description?: string;
    runs: ProcessRunDefinition[];
}
