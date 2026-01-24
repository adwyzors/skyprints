import { ProcessRun } from "./run.model";

export interface Order {
    id: string;
    code: string;
    quantity: number;
    status: string;
    jobCode: string;
    totalProcesses: number;
    completedProcesses: number;
    createdAt: Date;
    images: string[];

    customer: {
        id: string;
        code: string;
        name: string;
    };

    processes: OrderProcess[];
}

export interface OrderProcess {
    id: string;
    processId: string;
    name: string;
    status: string;
    runs: ProcessRun[];
}
