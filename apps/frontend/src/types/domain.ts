// types/domain.ts
export type OrderStatus = "PENDING" | "PRODUCTION_READY" | "COMPLETED";

export type ProcessRunStatus =
  | "TODO"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "HALTED"
  | "COMPLETED";


export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  productionReady: boolean;
  completed: boolean;
}

export interface ProcessRun {
  id: string;
  orderId: string;
  orderNumber: string;
  processName: string; // eg: Screen Printing
  runNumber: number;   // 1, 2, 3
  status: ProcessRunStatus;
  createdAt: string;
  assignedManager?: {
    name: string;
    location: string;
    assignedAt: string;
  };
  details: {
    printType: string;
    fabricColor: string;
    colors: number;
    quantity: number;
  };
}
