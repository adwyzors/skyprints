// ONE run of a process
export interface ProcessRunConfig {
  runNumber: number;
  fields: Record<string, string | number>;
}

// ONE process with N runs
export interface ProcessConfig {
  processName: string;
  runs: ProcessRunConfig[];
}

// Order in planning stage
export interface PlanningOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  productionReady: boolean;
  createdAt: string;
  processes: ProcessConfig[];
}

// Payload used by CreateOrderModal
export interface NewOrderPayload {
  customerName: string;
  customerCode: string;
  quantity: number;
  processes: ProcessConfig[];
}
