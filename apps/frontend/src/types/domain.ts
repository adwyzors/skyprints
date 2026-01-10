// @/types/domain.ts
//DONT USE THIS FILE
export interface RunTemplateField {
    key: string;
    type: string;
    required: boolean;
}

export interface ProcessRun {
    id: string;
    runNumber: number;
    statusCode: string;

    // Values user fills (null allowed from API)
    fields: Record<string, string | number | null>;

    locationId?: string | null;
    assignedToId?: string | null;

    runTemplate: {
        fields: RunTemplateField[]; // ✅ FIXED (array, not tuple)
    };
}

export interface Process {
    id: string;
    name: string;

    process: {
        name: string;
    };

    quantity: number;
    runs: ProcessRun[];
}

export interface Order {
    id: string;
    orderCode: string;
    customerId: string;

    customer: {
        id: string;
        name: string;
        code: string;
    };

    quantity: number;
    statusCode: string;
    createdAt: string;

    billedAt?: string | null;
    billingTotal?: number | null;
    originalTotal?: number | null;

    processes: Process[];
}
