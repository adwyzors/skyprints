import { ProcessRun } from "./run.model";

export interface Order {
    id: string;
    code: string;
    quantity: number;
    status: string;
    createdAt: Date;

    customer: {
        id: string;
        code: string;
        name: string;
    };

    processes: OrderProcess[];
}

export interface OrderProcess {
    id: string;
    name: string;
    status: string;
    runs: ProcessRun[];
}
